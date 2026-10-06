package portal

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

// MyPayments returns the logged-in user's own recurring payments and
// payment requests (pending and historical) — never another user's rows.
func (a *api) MyPayments(c *gin.Context) {
	user := currentUser(c)

	var recurring []models.RecurringPayment
	a.db.Where("user_id = ?", user.ID).Order("id desc").Find(&recurring)

	var requests []models.PaymentRequest
	a.db.Where("user_id = ?", user.ID).Order("id desc").Find(&requests)

	usernames := map[uint]string{user.ID: user.Username}
	c.JSON(http.StatusOK, gin.H{
		"recurring_payments": toRecurringPaymentDTOs(recurring, usernames),
		"payment_requests":   toPaymentRequestDTOs(requests, usernames),
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
	if pr.UserID != user.ID {
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
		"category":           pr.Category,
	})
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "stripe_error"})
		return
	}

	a.db.Model(&pr).Updates(map[string]any{
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
	if pr.UserID != user.ID {
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
	c.JSON(http.StatusOK, gin.H{"payment_request": toPaymentRequestDTO(pr, user.Username)})
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
