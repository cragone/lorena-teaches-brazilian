package models

import "time"

// PaymentEvent is a raw Stripe webhook audit log, also used to deduplicate
// deliveries via its unique StripeEventID.
type PaymentEvent struct {
	ID            uint `gorm:"primaryKey"`
	StripeEventID string
	Type          string
	Payload       string
	CreatedAt     time.Time
}

func (PaymentEvent) TableName() string { return "payment_events" }
