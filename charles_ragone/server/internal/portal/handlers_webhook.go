package portal

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	stripe "github.com/stripe/stripe-go/v83"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

// StripeWebhook receives payment_intent/setup_intent events, finalizing the
// matching payment_requests row. It's unauthenticated (webhooks aren't
// browser requests) and relies on the Stripe-Signature header instead.
func (a *api) StripeWebhook(c *gin.Context) {
	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}

	event, err := a.stripe.VerifyWebhookSignature(payload, c.GetHeader("Stripe-Signature"), a.cfg.StripeWebhookSecret)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}

	logEvent := models.PaymentEvent{
		StripeEventID: event.ID,
		Type:          string(event.Type),
		Payload:       string(payload),
	}
	if err := a.db.Create(&logEvent).Error; err != nil {
		// Most likely the unique stripe_event_id constraint: we've already
		// processed this delivery. Ack it so Stripe stops retrying.
		c.Status(http.StatusOK)
		return
	}

	switch event.Type {
	case stripe.EventTypePaymentIntentSucceeded:
		a.finalizePaymentIntent(event, models.PaymentStatusSucceeded)
	case stripe.EventTypePaymentIntentPaymentFailed:
		a.finalizePaymentIntent(event, models.PaymentStatusFailed)
	}

	c.Status(http.StatusOK)
}

func (a *api) finalizePaymentIntent(event stripe.Event, status string) {
	if event.Data == nil {
		return
	}
	var pi stripe.PaymentIntent
	if err := json.Unmarshal(event.Data.Raw, &pi); err != nil {
		return
	}

	a.applyPaymentIntentStatus(pi.ID, status, pi.LastPaymentError)
}

// applyPaymentIntentStatus persists a PaymentIntent's outcome onto its
// payment_requests row, used by both the webhook (the source of truth) and
// the client-driven sync endpoint (an immediate check that doesn't depend
// on a webhook ever arriving).
func (a *api) applyPaymentIntentStatus(paymentIntentID, status string, lastErr *stripe.Error) {
	updates := map[string]any{"status": status}
	switch {
	case status == models.PaymentStatusSucceeded:
		updates["paid_at"] = time.Now()
		updates["failure_reason"] = ""
	case lastErr != nil:
		updates["failure_reason"] = lastErr.Msg
	}

	a.db.Model(&models.PaymentRequest{}).Where("stripe_payment_intent_id = ?", paymentIntentID).Updates(updates)
}

// mapPaymentIntentStatus translates a Stripe PaymentIntent status into our
// own payment_requests status. Only a terminal Stripe status maps to
// something other than "processing": everything mid-flight (requires
// action/confirmation, an async ACH debit still clearing, etc.) stays
// "processing" until Stripe resolves it one way or the other.
func mapPaymentIntentStatus(s stripe.PaymentIntentStatus) string {
	switch s {
	case stripe.PaymentIntentStatusSucceeded:
		return models.PaymentStatusSucceeded
	case stripe.PaymentIntentStatusCanceled:
		return models.PaymentStatusCanceled
	case stripe.PaymentIntentStatusRequiresPaymentMethod:
		return models.PaymentStatusFailed
	default:
		return models.PaymentStatusProcessing
	}
}
