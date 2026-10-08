package portal

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/scheduler"
)

type createRecurringPaymentRequest struct {
	UserID      uint   `json:"user_id"`
	UnitID      uint   `json:"unit_id"`
	Category    string `json:"category"`
	AmountCents int64  `json:"amount_cents"`
	DayOfMonth  int    `json:"day_of_month"`
}

type updateRecurringPaymentRequest struct {
	Active      *bool  `json:"active"`
	AmountCents *int64 `json:"amount_cents"`
	DayOfMonth  *int   `json:"day_of_month"`
}

type createPaymentRequestRequest struct {
	UserID      uint   `json:"user_id"`
	UnitID      uint   `json:"unit_id"`
	Category    string `json:"category"`
	AmountCents int64  `json:"amount_cents"`
	Description string `json:"description"`
}

func (a *api) ListRecurringPayments(c *gin.Context) {
	var rows []models.RecurringPayment
	if err := a.db.Order("id desc").Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"recurring_payments": a.toRecurringPaymentDTOs(rows)})
}

func (a *api) CreateRecurringPayment(c *gin.Context) {
	var req createRecurringPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	if !models.ValidCategory(req.Category) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_category"})
		return
	}
	if req.AmountCents <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_amount"})
		return
	}
	if req.DayOfMonth < 1 || req.DayOfMonth > 28 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_day_of_month"})
		return
	}

	userID, unitID, p, ok := a.resolveChargeTarget(c, req.UserID, req.UnitID)
	if !ok {
		return
	}

	admin := currentUser(c)
	rp := models.RecurringPayment{
		UserID:      userID,
		UnitID:      unitID,
		Category:    req.Category,
		AmountCents: req.AmountCents,
		Currency:    "usd",
		DayOfMonth:  req.DayOfMonth,
		Active:      true,
		NextRunAt:   scheduler.NextRunAt(req.DayOfMonth, time.Now()),
		CreatedByID: admin.ID,
	}
	if err := a.db.Create(&rp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"recurring_payment": toRecurringPaymentDTO(rp, p)})
}

func (a *api) UpdateRecurringPayment(c *gin.Context) {
	rp, ok := a.loadRecurringPaymentParam(c)
	if !ok {
		return
	}

	var req updateRecurringPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}

	updates := map[string]any{}
	if req.Active != nil {
		updates["active"] = *req.Active
	}
	if req.AmountCents != nil {
		if *req.AmountCents <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_amount"})
			return
		}
		updates["amount_cents"] = *req.AmountCents
	}
	if req.DayOfMonth != nil {
		if *req.DayOfMonth < 1 || *req.DayOfMonth > 28 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_day_of_month"})
			return
		}
		updates["day_of_month"] = *req.DayOfMonth
		updates["next_run_at"] = scheduler.NextRunAt(*req.DayOfMonth, time.Now())
	}
	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no_changes"})
		return
	}

	if err := a.db.Model(&rp).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	a.db.First(&rp, rp.ID)

	c.JSON(http.StatusOK, gin.H{"recurring_payment": a.toRecurringPaymentDTOs([]models.RecurringPayment{rp})[0]})
}

func (a *api) DeleteRecurringPayment(c *gin.Context) {
	rp, ok := a.loadRecurringPaymentParam(c)
	if !ok {
		return
	}
	if err := a.db.Delete(&rp).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (a *api) loadRecurringPaymentParam(c *gin.Context) (models.RecurringPayment, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return models.RecurringPayment{}, false
	}
	var rp models.RecurringPayment
	if err := a.db.First(&rp, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return models.RecurringPayment{}, false
	}
	return rp, true
}

func (a *api) ListPaymentRequests(c *gin.Context) {
	query := a.db.Order("id desc")
	if userID := c.Query("user_id"); userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	var rows []models.PaymentRequest
	if err := query.Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"payment_requests": a.toPaymentRequestDTOs(rows)})
}

func (a *api) CreatePaymentRequest(c *gin.Context) {
	var req createPaymentRequestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	if !models.ValidCategory(req.Category) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_category"})
		return
	}
	if req.AmountCents <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_amount"})
		return
	}

	userID, unitID, p, ok := a.resolveChargeTarget(c, req.UserID, req.UnitID)
	if !ok {
		return
	}

	admin := currentUser(c)
	pr, err := a.createManualPaymentRequest(userID, unitID, req.Category, req.AmountCents, req.Description, admin.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"payment_request": toPaymentRequestDTO(pr, p, "")})
}

func (a *api) DeletePaymentRequest(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}

	var pr models.PaymentRequest
	if err := a.db.First(&pr, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}

	if err := a.db.Delete(&pr).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.Status(http.StatusNoContent)
}

// createManualPaymentRequest creates a one-off payment request, shared by
// the generic admin "send a request" flow and any feature-specific flow
// (e.g. the rotation charge) that needs the same row shape.
func (a *api) createManualPaymentRequest(userID, unitID *uint, category string, amountCents int64, description string, createdByID uint) (models.PaymentRequest, error) {
	pr := models.PaymentRequest{
		UserID:      userID,
		UnitID:      unitID,
		Category:    category,
		AmountCents: amountCents,
		Currency:    "usd",
		Description: description,
		Source:      models.PaymentSourceManual,
		Status:      models.PaymentStatusPending,
		CreatedByID: &createdByID,
	}
	err := a.db.Create(&pr).Error
	return pr, err
}

// resolveChargeTarget validates that exactly one of userID/unitID was given
// and that it exists, writing the error response itself otherwise.
func (a *api) resolveChargeTarget(c *gin.Context, userID, unitID uint) (*uint, *uint, payer, bool) {
	if (userID == 0) == (unitID == 0) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_or_unit_required"})
		return nil, nil, payer{}, false
	}
	if unitID != 0 {
		var unit models.Unit
		if err := a.db.First(&unit, unitID).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "unit_not_found"})
			return nil, nil, payer{}, false
		}
		return nil, &unit.ID, payer{UnitName: unit.Name}, true
	}
	var user models.User
	if err := a.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
		return nil, nil, payer{}, false
	}
	return &user.ID, nil, payer{Username: user.Username}, true
}
