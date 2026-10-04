package models

import "time"

// PaymentRequest is the unified payments ledger: both admin-sent manual
// one-off asks and the charges a RecurringPayment generates each cycle land
// here as a single row each.
type PaymentRequest struct {
	ID                    uint `gorm:"primaryKey"`
	UserID                uint
	Category              string
	AmountCents           int64
	Currency              string
	Description           string
	Source                string
	RecurringPaymentID    *uint
	StripePaymentIntentID *string
	Status                string
	FailureReason         string
	CreatedByID           *uint
	CreatedAt             time.Time
	UpdatedAt             time.Time
	PaidAt                *time.Time
}

func (PaymentRequest) TableName() string { return "payment_requests" }
