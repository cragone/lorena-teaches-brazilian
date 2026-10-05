// Package billing wraps the Stripe API calls the payments portal needs,
// keeping every direct dependency on the Stripe SDK in one place.
package billing

import (
	"context"
	"errors"

	stripe "github.com/stripe/stripe-go/v83"
	"github.com/stripe/stripe-go/v83/customer"
	"github.com/stripe/stripe-go/v83/paymentintent"
	"github.com/stripe/stripe-go/v83/webhook"
)

// cardOnly restricts Elements/Intents to cards, kept as the one supported
// method for consistency across every on-session payment flow.
var cardOnly = []*string{new("card")}

type Client struct {
	secretKey string
}

// New builds a billing client. An empty secretKey is valid — Enabled()
// reports false and every call returns ErrDisabled, so the rest of the app
// can run with payments simply turned off.
func New(secretKey string) *Client {
	if secretKey != "" {
		stripe.Key = secretKey
	}
	return &Client{secretKey: secretKey}
}

func (c *Client) Enabled() bool { return c.secretKey != "" }

var ErrDisabled = errors.New("billing: STRIPE_SECRET_KEY not configured")

// CreateCustomer creates a new Stripe Customer for a portal user.
func (c *Client) CreateCustomer(ctx context.Context, email, name string) (string, error) {
	if !c.Enabled() {
		return "", ErrDisabled
	}
	params := &stripe.CustomerParams{
		Email: new(email),
		Name:  new(name),
	}
	params.Context = ctx
	cust, err := customer.New(params)
	if err != nil {
		return "", err
	}
	return cust.ID, nil
}

// CreatePaymentIntentForTenant creates a PaymentIntent for a tenant to
// confirm themselves client-side (via the Payment Element), returning its
// client secret and id.
func (c *Client) CreatePaymentIntentForTenant(ctx context.Context, customerID string, amountCents int64, currency string, metadata map[string]string) (clientSecret, paymentIntentID string, err error) {
	if !c.Enabled() {
		return "", "", ErrDisabled
	}
	params := &stripe.PaymentIntentParams{
		Amount:             new(amountCents),
		Currency:           new(currency),
		Customer:           new(customerID),
		PaymentMethodTypes: cardOnly,
		SetupFutureUsage:   new("off_session"),
		Metadata:           metadata,
	}
	params.Context = ctx
	pi, err := paymentintent.New(params)
	if err != nil {
		return "", "", err
	}
	return pi.ClientSecret, pi.ID, nil
}

// VerifyWebhookSignature checks a Stripe webhook request's signature and
// decodes its event.
func (c *Client) VerifyWebhookSignature(payload []byte, signatureHeader, webhookSecret string) (stripe.Event, error) {
	if webhookSecret == "" {
		return stripe.Event{}, errors.New("billing: STRIPE_WEBHOOK_SECRET not configured")
	}
	return webhook.ConstructEvent(payload, signatureHeader, webhookSecret)
}
