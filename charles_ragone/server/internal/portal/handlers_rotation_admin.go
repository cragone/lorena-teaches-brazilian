package portal

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

// errNoActiveRotationMembers signals that the rotation can't advance
// because the admin has deactivated every member. Callers degrade
// gracefully (an empty/warning response) rather than failing the request.
var errNoActiveRotationMembers = errors.New("rotation: no active members")

type addRotationMemberRequest struct {
	UserID uint `json:"user_id"`
}

type updateRotationMemberRequest struct {
	Active *bool `json:"active"`
}

type reorderRotationMembersRequest struct {
	MemberIDs []uint `json:"member_ids"`
}

type updateRotationSettingsRequest struct {
	AmountCents *int64 `json:"amount_cents"`
}

type resolveRotationAssignmentRequest struct {
	Notes string `json:"notes"`
}

func (a *api) ListRotationMembers(c *gin.Context) {
	var rows []models.RotationMember
	if err := a.db.Order("active desc, position asc").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"members": toRotationMemberDTOs(rows, a.usernameMap())})
}

func (a *api) AddRotationMember(c *gin.Context) {
	var req addRotationMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.UserID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}

	var target models.User
	if err := a.db.First(&target, req.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
		return
	}

	var existing models.RotationMember
	err := a.db.Where("user_id = ?", req.UserID).First(&existing).Error
	switch {
	case err == nil && existing.Active:
		c.JSON(http.StatusConflict, gin.H{"error": "already_a_member"})
		return
	case err == nil && !existing.Active:
		nextPos, perr := a.nextRotationPosition()
		if perr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
			return
		}
		if err := a.db.Model(&existing).Updates(map[string]any{"active": true, "position": nextPos}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
			return
		}
		a.db.First(&existing, existing.ID)
		c.JSON(http.StatusOK, gin.H{"member": toRotationMemberDTO(existing, target.Username)})
		return
	case !errors.Is(err, gorm.ErrRecordNotFound):
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	nextPos, err := a.nextRotationPosition()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	member := models.RotationMember{UserID: req.UserID, Position: nextPos, Active: true}
	if err := a.db.Create(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"member": toRotationMemberDTO(member, target.Username)})
}

func (a *api) nextRotationPosition() (int, error) {
	var result struct{ Max int }
	if err := a.db.Model(&models.RotationMember{}).Select("COALESCE(MAX(position), 0) as max").Scan(&result).Error; err != nil {
		return 0, err
	}
	return result.Max + 1, nil
}

func (a *api) UpdateRotationMember(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var member models.RotationMember
	if err := a.db.First(&member, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}

	var req updateRotationMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	if req.Active == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no_changes"})
		return
	}

	updates := map[string]any{"active": *req.Active}
	if *req.Active && !member.Active {
		nextPos, perr := a.nextRotationPosition()
		if perr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
			return
		}
		updates["position"] = nextPos
	}
	if err := a.db.Model(&member).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	a.db.First(&member, member.ID)

	var owner models.User
	a.db.Select("username").First(&owner, member.UserID)
	c.JSON(http.StatusOK, gin.H{"member": toRotationMemberDTO(member, owner.Username)})
}

func (a *api) ReorderRotationMembers(c *gin.Context) {
	var req reorderRotationMembersRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.MemberIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}

	var active []models.RotationMember
	if err := a.db.Where("active = ?", true).Find(&active).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	if len(active) != len(req.MemberIDs) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "member_set_mismatch"})
		return
	}
	activeSet := make(map[uint]bool, len(active))
	for _, m := range active {
		activeSet[m.ID] = true
	}
	for _, id := range req.MemberIDs {
		if !activeSet[id] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "member_set_mismatch"})
			return
		}
	}

	err := a.db.Transaction(func(tx *gorm.DB) error {
		for i, id := range req.MemberIDs {
			if err := tx.Model(&models.RotationMember{}).Where("id = ?", id).Update("position", i+1).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	var rows []models.RotationMember
	a.db.Order("active desc, position asc").Find(&rows)
	c.JSON(http.StatusOK, gin.H{"members": toRotationMemberDTOs(rows, a.usernameMap())})
}

func (a *api) GetRotationSettings(c *gin.Context) {
	settings, err := a.loadRotationSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"settings": toRotationSettingsDTO(settings)})
}

func (a *api) UpdateRotationSettings(c *gin.Context) {
	var req updateRotationSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	if req.AmountCents == nil || *req.AmountCents <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_amount"})
		return
	}
	if err := a.db.Model(&models.RotationSettings{}).Where("id = 1").Update("amount_cents", *req.AmountCents).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	settings, err := a.loadRotationSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"settings": toRotationSettingsDTO(settings)})
}

func (a *api) loadRotationSettings() (models.RotationSettings, error) {
	var settings models.RotationSettings
	err := a.db.First(&settings, 1).Error
	return settings, err
}

func (a *api) ListRotationAssignments(c *gin.Context) {
	warning := ""
	if err := a.ensureRotationAssignmentsThroughCurrentMonth(); err != nil {
		if errors.Is(err, errNoActiveRotationMembers) {
			warning = "no_active_members"
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
			return
		}
	}

	var rows []models.RotationAssignment
	if err := a.db.Order("month desc").Limit(24).Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	dtos, err := a.toRotationAssignmentDTOs(rows)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	resp := gin.H{"assignments": dtos}
	if warning != "" {
		resp["warning"] = warning
	}
	c.JSON(http.StatusOK, resp)
}

// ensureRotationAssignmentsThroughCurrentMonth lazily backfills any missing
// months (including the current one) up to today, each computed from the
// successor of the previous month's assignee within the current active
// member list. This is what makes "whose month is it" correct even if the
// admin hasn't opened the app in a while, or members were added/removed.
func (a *api) ensureRotationAssignmentsThroughCurrentMonth() error {
	currentMonth := time.Now().Format("2006-01")

	var latest models.RotationAssignment
	err := a.db.Order("month desc").First(&latest).Error
	hasLatest := err == nil
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if hasLatest && latest.Month >= currentMonth {
		return nil
	}

	startMonth := currentMonth
	if hasLatest {
		startMonth = nextMonthKey(latest.Month)
	}

	for month := startMonth; month <= currentMonth; month = nextMonthKey(month) {
		member, err := a.nextRotationAssignee(hasLatest, latest)
		if err != nil {
			return err
		}
		assignment := models.RotationAssignment{
			Month:            month,
			RotationMemberID: member.ID,
			MemberPosition:   member.Position,
			Resolution:       models.RotationResolutionPending,
		}
		if err := a.db.Create(&assignment).Error; err != nil {
			return err
		}
		latest = assignment
		hasLatest = true
	}
	return nil
}

// nextRotationAssignee picks the next active member after the last
// assignment's snapshotted position, wrapping to the lowest-position active
// member if there isn't one. Comparing against the snapshot (not the
// member's current position) keeps this correct even if that member was
// later deactivated or the active list was reordered.
func (a *api) nextRotationAssignee(hasLatest bool, latest models.RotationAssignment) (models.RotationMember, error) {
	var active []models.RotationMember
	if err := a.db.Where("active = ?", true).Order("position asc").Find(&active).Error; err != nil {
		return models.RotationMember{}, err
	}
	if len(active) == 0 {
		return models.RotationMember{}, errNoActiveRotationMembers
	}
	if !hasLatest {
		return active[0], nil
	}
	for _, m := range active {
		if m.Position > latest.MemberPosition {
			return m, nil
		}
	}
	return active[0], nil
}

func nextMonthKey(month string) string {
	t, err := time.Parse("2006-01", month)
	if err != nil {
		return month
	}
	return t.AddDate(0, 1, 0).Format("2006-01")
}

func monthLabel(month string) string {
	t, err := time.Parse("2006-01", month)
	if err != nil {
		return month
	}
	return t.Format("January 2006")
}

func (a *api) loadRotationAssignmentParam(c *gin.Context) (models.RotationAssignment, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return models.RotationAssignment{}, false
	}
	var assignment models.RotationAssignment
	if err := a.db.First(&assignment, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return models.RotationAssignment{}, false
	}
	return assignment, true
}

// RecordRotationWork waives the month's charge: the assignee did the work
// themselves, so no payment request is created.
func (a *api) RecordRotationWork(c *gin.Context) {
	assignment, ok := a.loadRotationAssignmentParam(c)
	if !ok {
		return
	}
	if assignment.Resolution != models.RotationResolutionPending {
		c.JSON(http.StatusConflict, gin.H{"error": "already_resolved"})
		return
	}

	var req resolveRotationAssignmentRequest
	_ = c.ShouldBindJSON(&req)

	if err := a.db.Model(&assignment).Updates(map[string]any{
		"resolution": models.RotationResolutionWaived,
		"notes":      req.Notes,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	a.respondRotationAssignment(c, assignment.ID)
}

// ChargeRotationAssignment creates a payment request for the assignee,
// reusing the same manual-request creation path as the generic admin
// "send a request" flow. The owner pays it themselves, in-portal, exactly
// like any other pending request.
func (a *api) ChargeRotationAssignment(c *gin.Context) {
	assignment, ok := a.loadRotationAssignmentParam(c)
	if !ok {
		return
	}
	if assignment.Resolution != models.RotationResolutionPending {
		c.JSON(http.StatusConflict, gin.H{"error": "already_resolved"})
		return
	}

	var member models.RotationMember
	if err := a.db.First(&member, assignment.RotationMemberID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	settings, err := a.loadRotationSettings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	admin := currentUser(c)
	description := "Property management – " + monthLabel(assignment.Month)
	pr, err := a.createManualPaymentRequest(&member.UserID, nil, models.CategoryPropertyManagement, settings.AmountCents, description, admin.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	if err := a.db.Model(&assignment).Updates(map[string]any{
		"resolution":         models.RotationResolutionCharged,
		"payment_request_id": pr.ID,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	a.respondRotationAssignment(c, assignment.ID)
}

// ResetRotationAssignment is an escape hatch for a wrong click: it's
// blocked once the linked payment request has actually succeeded, since
// that money has already moved.
func (a *api) ResetRotationAssignment(c *gin.Context) {
	assignment, ok := a.loadRotationAssignmentParam(c)
	if !ok {
		return
	}
	if assignment.Resolution == models.RotationResolutionPending {
		c.JSON(http.StatusConflict, gin.H{"error": "not_resolved"})
		return
	}
	if assignment.PaymentRequestID != nil {
		var pr models.PaymentRequest
		if err := a.db.First(&pr, *assignment.PaymentRequestID).Error; err == nil && pr.Status == models.PaymentStatusSucceeded {
			c.JSON(http.StatusConflict, gin.H{"error": "already_paid"})
			return
		}
	}
	if err := a.db.Model(&assignment).Updates(map[string]any{
		"resolution":         models.RotationResolutionPending,
		"notes":              "",
		"payment_request_id": nil,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	a.respondRotationAssignment(c, assignment.ID)
}

func (a *api) respondRotationAssignment(c *gin.Context, id uint) {
	var assignment models.RotationAssignment
	if err := a.db.First(&assignment, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	dtos, err := a.toRotationAssignmentDTOs([]models.RotationAssignment{assignment})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"assignment": dtos[0]})
}
