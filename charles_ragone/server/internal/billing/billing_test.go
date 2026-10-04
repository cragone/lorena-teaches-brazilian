package billing

import (
	"testing"

	"github.com/stripe/stripe-go/v83/webhook"
)

func TestVerifyWebhookSignature(t *testing.T) {
	const secret = "whsec_test_secret"
	payload := []byte(`{"id":"evt_test","object":"event","api_version":"2025-10-29.clover","type":"payment_intent.succeeded","data":{"object":{"id":"pi_test","object":"payment_intent","status":"succeeded"}}}`)

	signed := webhook.GenerateTestSignedPayload(&webhook.UnsignedPayload{
		Payload: payload,
		Secret:  secret,
	})

	c := New("")

	event, err := c.VerifyWebhookSignature(signed.Payload, signed.Header, secret)
	if err != nil {
		t.Fatalf("expected a valid signature, got error: %v", err)
	}
	if event.Type != "payment_intent.succeeded" {
		t.Fatalf("unexpected event type: %s", event.Type)
	}

	if _, err := c.VerifyWebhookSignature(signed.Payload, signed.Header, "whsec_wrong_secret"); err == nil {
		t.Fatal("expected an error when verifying against the wrong secret")
	}
}
