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

func (a *api) MyPaymentMethod(c *gin.Context) {
	user := currentUser(c)
	if user.StripeCustomerID == nil {
		c.JSON(http.StatusOK, gin.H{"has_payment_method": false})
		return
	}
	has, err := a.stripe.HasDefaultPaymentMethod(c.Request.Context(), *user.StripeCustomerID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "stripe_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"has_payment_method": has})
}

// CreateSetupIntent starts the "save a card" flow for the logged-in user.
func (a *api) CreateSetupIntent(c *gin.Context) {
	user := currentUser(c)
	customerID, err := a.ensureStripeCustomer(c.Request.Context(), user)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "stripe_error"})
		return
	}

	clientSecret, err := a.stripe.CreateSetupIntent(c.Request.Context(), customerID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "stripe_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"client_secret": clientSecret})
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
