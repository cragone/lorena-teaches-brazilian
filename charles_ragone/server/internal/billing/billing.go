// Package billing wraps the Stripe API calls the payments portal needs,
// keeping every direct dependency on the Stripe SDK in one place.
package billing

import (
	"context"
	"errors"

	stripe "github.com/stripe/stripe-go/v83"
	"github.com/stripe/stripe-go/v83/customer"
	"github.com/stripe/stripe-go/v83/paymentintent"
	"github.com/stripe/stripe-go/v83/setupintent"
	"github.com/stripe/stripe-go/v83/webhook"
)

// cardOnly restricts Elements/Intents to cards. Recurring off-session
// charges only work reliably with a reusable method like a card, so every
// flow (saving a method, paying a one-off request) is kept to that one type
// for consistency.
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

// CreateSetupIntent starts a flow for a customer to save a reusable card.
func (c *Client) CreateSetupIntent(ctx context.Context, customerID string) (clientSecret string, err error) {
	if !c.Enabled() {
		return "", ErrDisabled
	}
	params := &stripe.SetupIntentParams{
		Customer:           new(customerID),
		PaymentMethodTypes: cardOnly,
		Usage:              new("off_session"),
	}
	params.Context = ctx
	si, err := setupintent.New(params)
	if err != nil {
		return "", err
	}
	return si.ClientSecret, nil
}

// HasDefaultPaymentMethod reports whether a customer has a saved card set
// as their default invoice payment method.
func (c *Client) HasDefaultPaymentMethod(ctx context.Context, customerID string) (bool, error) {
	id, err := c.DefaultPaymentMethodID(ctx, customerID)
	if err != nil {
		return false, err
	}
	return id != "", nil
}

// DefaultPaymentMethodID returns a customer's default payment method id, or
// "" if they have none saved.
func (c *Client) DefaultPaymentMethodID(ctx context.Context, customerID string) (string, error) {
	if !c.Enabled() {
		return "", ErrDisabled
	}
	params := &stripe.CustomerParams{}
	params.Context = ctx
	params.AddExpand("invoice_settings.default_payment_method")
	cust, err := customer.Get(customerID, params)
	if err != nil {
		return "", err
	}
	if cust.InvoiceSettings == nil || cust.InvoiceSettings.DefaultPaymentMethod == nil {
		return "", nil
	}
	return cust.InvoiceSettings.DefaultPaymentMethod.ID, nil
}

// CreateOffSessionPaymentIntent charges a customer's saved default payment
// method immediately, with no further customer interaction, for a
// scheduler-driven recurring payment.
func (c *Client) CreateOffSessionPaymentIntent(ctx context.Context, customerID, paymentMethodID string, amountCents int64, currency, idempotencyKey string, metadata map[string]string) (*stripe.PaymentIntent, error) {
	if !c.Enabled() {
		return nil, ErrDisabled
	}
	params := &stripe.PaymentIntentParams{
		Amount:        new(amountCents),
		Currency:      new(currency),
		Customer:      new(customerID),
		PaymentMethod: new(paymentMethodID),
		Confirm:       new(true),
		OffSession:    new(true),
		Metadata:      metadata,
	}
	params.Context = ctx
	params.SetIdempotencyKey(idempotencyKey)
	return paymentintent.New(params)
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

// DeclineMessage extracts a human-readable reason from a Stripe API error,
// falling back to the plain error text for anything else.
func DeclineMessage(err error) string {
	var stripeErr *stripe.Error
	if errors.As(err, &stripeErr) && stripeErr.Msg != "" {
		return stripeErr.Msg
	}
	return err.Error()
}
