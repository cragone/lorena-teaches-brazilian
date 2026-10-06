package portal

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

// MyPayments returns the recurring payments and payment requests (pending
// and historical) addressed to the logged-in user or to a unit they belong
// to — never anyone else's rows.
func (a *api) MyPayments(c *gin.Context) {
	user := currentUser(c)

	unitIDs := a.userUnitIDs(user.ID)

	var recurring []models.RecurringPayment
	a.db.Where("user_id = ? OR unit_id IN ?", user.ID, unitIDs).Order("id desc").Find(&recurring)

	var requests []models.PaymentRequest
	a.db.Where("user_id = ? OR unit_id IN ?", user.ID, unitIDs).Order("id desc").Find(&requests)

	var units []models.Unit
	a.db.Where("id IN ?", unitIDs).Order("name").Find(&units)

	c.JSON(http.StatusOK, gin.H{
		"recurring_payments": a.toRecurringPaymentDTOs(recurring),
		"payment_requests":   a.toPaymentRequestDTOs(requests),
		"units":              toUnitDTOs(units, nil),
	})
}

// PayPaymentRequest creates (or re-creates, after a prior failure) a
// PaymentIntent for one of the caller's own pending requests, returning a
// client secret for the frontend to confirm via the Payment Element.
func (a *api) PayPaymentRequest(c *gin.Context) {
	user := currentUser(c)

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
	if !a.canAccessRequest(user.ID, pr) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	if pr.Status != models.PaymentStatusPending && pr.Status != models.PaymentStatusFailed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "not_payable"})
		return
	}

	customerID, err := a.ensureStripeCustomer(c.Request.Context(), user)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "stripe_error"})
		return
	}

	clientSecret, paymentIntentID, err := a.stripe.CreatePaymentIntentForTenant(c.Request.Context(), customerID, pr.AmountCents, pr.Currency, map[string]string{
		"payment_request_id": c.Param("id"),
		"paid_by_user_id":    strconv.FormatUint(uint64(user.ID), 10),
		"category":           pr.Category,
	})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "stripe_error"})
		return
	}

	a.db.Model(&pr).Updates(map[string]any{
		"paid_by_id":               user.ID,
		"status":                   models.PaymentStatusProcessing,
		"stripe_payment_intent_id": paymentIntentID,
		"failure_reason":           "",
	})

	c.JSON(http.StatusOK, gin.H{"client_secret": clientSecret})
}

// SyncPaymentRequest reconciles a payment_requests row against Stripe's
// current view of its PaymentIntent. The frontend calls this right after
// stripe.confirmPayment() resolves, so the UI reflects "succeeded"
// immediately instead of waiting on the async webhook — which, for a local
// dev server with nothing forwarding Stripe events to it, never arrives.
func (a *api) SyncPaymentRequest(c *gin.Context) {
	user := currentUser(c)

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
	if !a.canAccessRequest(user.ID, pr) {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}
	if pr.StripePaymentIntentID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "not_payable"})
		return
	}

	pi, err := a.stripe.GetPaymentIntent(c.Request.Context(), *pr.StripePaymentIntentID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "stripe_error"})
		return
	}

	a.applyPaymentIntentStatus(pi.ID, mapPaymentIntentStatus(pi.Status), pi.LastPaymentError)

	a.db.First(&pr, pr.ID)
	c.JSON(http.StatusOK, gin.H{"payment_request": a.toPaymentRequestDTOs([]models.PaymentRequest{pr})[0]})
}

// ensureStripeCustomer returns the user's Stripe customer id, creating one
// (and persisting it) on first use.
func (a *api) ensureStripeCustomer(ctx context.Context, user *models.User) (string, error) {
	if user.StripeCustomerID != nil {
		return *user.StripeCustomerID, nil
	}

	customerID, err := a.stripe.CreateCustomer(ctx, user.Email, user.Username)
	if err != nil {
		return "", err
	}
	if err := a.db.Model(user).Update("stripe_customer_id", customerID).Error; err != nil {
		return "", err
	}
	user.StripeCustomerID = &customerID
	return customerID, nil
}

// userUnitIDs returns the ids of every unit the user belongs to.
func (a *api) userUnitIDs(userID uint) []uint {
	ids := []uint{}
	a.db.Model(&models.UnitMember{}).Where("user_id = ?", userID).Pluck("unit_id", &ids)
	return ids
}

// canAccessRequest reports whether the user may pay/sync a request: it is
// addressed to them, or to a unit they belong to.
func (a *api) canAccessRequest(userID uint, pr models.PaymentRequest) bool {
	if pr.UserID != nil && *pr.UserID == userID {
		return true
	}
	if pr.UnitID == nil {
		return false
	}
	var count int64
	a.db.Model(&models.UnitMember{}).Where("unit_id = ? AND user_id = ?", *pr.UnitID, userID).Count(&count)
	return count > 0
}
