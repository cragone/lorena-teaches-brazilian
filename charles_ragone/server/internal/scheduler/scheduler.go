// Package scheduler drives recurring payments: a ticking goroutine that
// finds due RecurringPayment rows and generates a pending PaymentRequest for
// each one. It no longer charges anything itself — the tenant pays the
// generated request manually, in-portal, via the same on-session flow used
// for any other payment request.
package scheduler

import (
	"context"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

const tickInterval = time.Hour

// Run drives the recurring-payment loop until ctx is canceled. Call it in
// its own goroutine.
func Run(ctx context.Context, db *gorm.DB) {
	processDue(db)

	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			processDue(db)
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

func processDue(db *gorm.DB) {
	var due []models.RecurringPayment
	if err := db.Where("active = ? AND next_run_at <= ?", true, time.Now()).Find(&due).Error; err != nil {
		log.Printf("scheduler: query due recurring payments: %v", err)
		return
	}
	for _, rp := range due {
		processOne(db, rp)
	}
}

func processOne(db *gorm.DB, rp models.RecurringPayment) {
	now := time.Now()

	request := models.PaymentRequest{
		UserID:             rp.UserID,
		UnitID:             rp.UnitID,
		Category:           rp.Category,
		AmountCents:        rp.AmountCents,
		Currency:           rp.Currency,
		Description:        fmt.Sprintf("Scheduled %s payment", rp.Category),
		Source:             models.PaymentSourceRecurring,
		RecurringPaymentID: &rp.ID,
		Status:             models.PaymentStatusPending,
	}

	if err := db.Create(&request).Error; err != nil {
		log.Printf("scheduler: recurring payment %d: record payment request: %v", rp.ID, err)
	}

	updates := map[string]any{"next_run_at": NextRunAt(rp.DayOfMonth, now), "last_run_at": now}
	if err := db.Model(&rp).Updates(updates).Error; err != nil {
		log.Printf("scheduler: recurring payment %d: advance schedule: %v", rp.ID, err)
	}
}
