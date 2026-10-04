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
	c.JSON(http.StatusOK, gin.H{"recurring_payments": toRecurringPaymentDTOs(rows, a.usernameMap())})
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

	var target models.User
	if err := a.db.First(&target, req.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
		return
	}
	if target.StripeCustomerID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_has_no_payment_method"})
		return
	}
	hasPM, err := a.stripe.HasDefaultPaymentMethod(c.Request.Context(), *target.StripeCustomerID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "stripe_error"})
		return
	}
	if !hasPM {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_has_no_payment_method"})
		return
	}

	admin := currentUser(c)
	rp := models.RecurringPayment{
		UserID:      target.ID,
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
	c.JSON(http.StatusCreated, gin.H{"recurring_payment": toRecurringPaymentDTO(rp, target.Username)})
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

	var owner models.User
	a.db.Select("username").First(&owner, rp.UserID)
	c.JSON(http.StatusOK, gin.H{"recurring_payment": toRecurringPaymentDTO(rp, owner.Username)})
}

func (a *api) CancelRecurringPayment(c *gin.Context) {
	rp, ok := a.loadRecurringPaymentParam(c)
	if !ok {
		return
	}
	if err := a.db.Model(&rp).Update("active", false).Error; err != nil {
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
	c.JSON(http.StatusOK, gin.H{"payment_requests": toPaymentRequestDTOs(rows, a.usernameMap())})
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

	var target models.User
	if err := a.db.First(&target, req.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
		return
	}

	admin := currentUser(c)
	pr := models.PaymentRequest{
		UserID:      target.ID,
		Category:    req.Category,
		AmountCents: req.AmountCents,
		Currency:    "usd",
		Description: req.Description,
		Source:      models.PaymentSourceManual,
		Status:      models.PaymentStatusPending,
		CreatedByID: &admin.ID,
	}
	if err := a.db.Create(&pr).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"payment_request": toPaymentRequestDTO(pr, target.Username)})
}
