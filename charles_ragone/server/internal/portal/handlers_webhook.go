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

	updates := map[string]any{"status": status}
	switch {
	case status == models.PaymentStatusSucceeded:
		updates["paid_at"] = time.Now()
		updates["failure_reason"] = ""
	case pi.LastPaymentError != nil:
		updates["failure_reason"] = pi.LastPaymentError.Msg
	}

	a.db.Model(&models.PaymentRequest{}).Where("stripe_payment_intent_id = ?", pi.ID).Updates(updates)
}
