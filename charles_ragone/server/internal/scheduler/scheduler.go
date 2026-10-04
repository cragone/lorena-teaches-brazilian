// Package scheduler drives recurring payments: a ticking goroutine that
// finds due RecurringPayment rows and charges them through billing.Client.
package scheduler

import (
	"context"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/billing"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

const tickInterval = time.Hour

// Run drives the recurring-payment loop until ctx is canceled. Call it in
// its own goroutine.
func Run(ctx context.Context, db *gorm.DB, stripeClient *billing.Client) {
	if !stripeClient.Enabled() {
		log.Println("scheduler: STRIPE_SECRET_KEY not set, recurring payments are disabled")
		return
	}

	processDue(db, stripeClient)

	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			processDue(db, stripeClient)
		}
	}
}

// NextRunAt computes the next occurrence of dayOfMonth on or after from,
// landing in the current month if that day hasn't passed yet this month.
func NextRunAt(dayOfMonth int, from time.Time) time.Time {
	year, month, day := from.Date()
	next := time.Date(year, month, dayOfMonth, 0, 0, 0, 0, from.Location())
	if day > dayOfMonth {
		next = next.AddDate(0, 1, 0)
	}
	return next
}

func processDue(db *gorm.DB, stripeClient *billing.Client) {
	var due []models.RecurringPayment
	if err := db.Where("active = ? AND next_run_at <= ?", true, time.Now()).Find(&due).Error; err != nil {
		log.Printf("scheduler: query due recurring payments: %v", err)
		return
	}
	for _, rp := range due {
		processOne(db, stripeClient, rp)
	}
}

func processOne(db *gorm.DB, stripeClient *billing.Client, rp models.RecurringPayment) {
	ctx := context.Background()
	now := time.Now()

	var user models.User
	if err := db.First(&user, rp.UserID).Error; err != nil {
		log.Printf("scheduler: recurring payment %d: load user: %v", rp.ID, err)
		return
	}

	request := models.PaymentRequest{
		UserID:             rp.UserID,
		Category:           rp.Category,
		AmountCents:        rp.AmountCents,
		Currency:           rp.Currency,
		Description:        fmt.Sprintf("Scheduled %s payment", rp.Category),
		Source:             models.PaymentSourceRecurring,
		RecurringPaymentID: &rp.ID,
	}

	idempotencyKey := fmt.Sprintf("recurring-%d-%s", rp.ID, now.Format("2006-01"))
	chargeRecurringPayment(ctx, stripeClient, &user, rp, idempotencyKey, &request)

	if err := db.Create(&request).Error; err != nil {
		log.Printf("scheduler: recurring payment %d: record payment request: %v", rp.ID, err)
	}

	updates := map[string]any{"next_run_at": NextRunAt(rp.DayOfMonth, now), "last_run_at": now}
	if err := db.Model(&rp).Updates(updates).Error; err != nil {
		log.Printf("scheduler: recurring payment %d: advance schedule: %v", rp.ID, err)
	}
}

func chargeRecurringPayment(ctx context.Context, stripeClient *billing.Client, user *models.User, rp models.RecurringPayment, idempotencyKey string, request *models.PaymentRequest) {
	if user.StripeCustomerID == nil {
		request.Status = models.PaymentStatusFailed
		request.FailureReason = "no payment method on file"
		return
	}

	paymentMethodID, err := stripeClient.DefaultPaymentMethodID(ctx, *user.StripeCustomerID)
	if err != nil {
		request.Status = models.PaymentStatusFailed
		request.FailureReason = billing.DeclineMessage(err)
		return
	}
	if paymentMethodID == "" {
		request.Status = models.PaymentStatusFailed
		request.FailureReason = "no payment method on file"
		return
	}

	pi, err := stripeClient.CreateOffSessionPaymentIntent(ctx, *user.StripeCustomerID, paymentMethodID, rp.AmountCents, rp.Currency, idempotencyKey, map[string]string{
		"recurring_payment_id": fmt.Sprintf("%d", rp.ID),
		"category":             rp.Category,
	})
	if err != nil {
		request.Status = models.PaymentStatusFailed
		request.FailureReason = billing.DeclineMessage(err)
		return
	}

	request.StripePaymentIntentID = &pi.ID
	switch pi.Status {
	case "succeeded":
		request.Status = models.PaymentStatusSucceeded
		now := time.Now()
		request.PaidAt = &now
	case "processing":
		request.Status = models.PaymentStatusProcessing
	default:
		request.Status = models.PaymentStatusFailed
		request.FailureReason = string(pi.Status)
	}
}
