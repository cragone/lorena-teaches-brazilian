package models

import "time"

// RecurringPayment is an admin-configured scheduled charge (e.g. monthly
// rent) against a tenant's saved Stripe payment method.
type RecurringPayment struct {
	ID          uint `gorm:"primaryKey"`
	UserID      *uint
	UnitID      *uint
	Category    string
	AmountCents int64
	Currency    string
	DayOfMonth  int
	Active      bool
	NextRunAt   time.Time
	LastRunAt   *time.Time
	CreatedByID uint
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (RecurringPayment) TableName() string { return "recurring_payments" }
