package portal

import (
	"time"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

type recurringPaymentDTO struct {
	ID          uint       `json:"id"`
	UserID      uint       `json:"user_id"`
	Username    string     `json:"username,omitempty"`
	Category    string     `json:"category"`
	AmountCents int64      `json:"amount_cents"`
	Currency    string     `json:"currency"`
	DayOfMonth  int        `json:"day_of_month"`
	Active      bool       `json:"active"`
	NextRunAt   time.Time  `json:"next_run_at"`
	LastRunAt   *time.Time `json:"last_run_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

func toRecurringPaymentDTO(rp models.RecurringPayment, username string) recurringPaymentDTO {
	return recurringPaymentDTO{
		ID:          rp.ID,
		UserID:      rp.UserID,
		Username:    username,
		Category:    rp.Category,
		AmountCents: rp.AmountCents,
		Currency:    rp.Currency,
		DayOfMonth:  rp.DayOfMonth,
		Active:      rp.Active,
		NextRunAt:   rp.NextRunAt,
		LastRunAt:   rp.LastRunAt,
		CreatedAt:   rp.CreatedAt,
	}
}

func toRecurringPaymentDTOs(rows []models.RecurringPayment, usernames map[uint]string) []recurringPaymentDTO {
	dtos := make([]recurringPaymentDTO, len(rows))
	for i, rp := range rows {
		dtos[i] = toRecurringPaymentDTO(rp, usernames[rp.UserID])
	}
	return dtos
}

type paymentRequestDTO struct {
	ID            uint       `json:"id"`
	UserID        uint       `json:"user_id"`
	Username      string     `json:"username,omitempty"`
	Category      string     `json:"category"`
	AmountCents   int64      `json:"amount_cents"`
	Currency      string     `json:"currency"`
	Description   string     `json:"description"`
	Source        string     `json:"source"`
	Status        string     `json:"status"`
	FailureReason string     `json:"failure_reason,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	PaidAt        *time.Time `json:"paid_at,omitempty"`
}

func toPaymentRequestDTO(pr models.PaymentRequest, username string) paymentRequestDTO {
	return paymentRequestDTO{
		ID:            pr.ID,
		UserID:        pr.UserID,
		Username:      username,
		Category:      pr.Category,
		AmountCents:   pr.AmountCents,
		Currency:      pr.Currency,
		Description:   pr.Description,
		Source:        pr.Source,
		Status:        pr.Status,
		FailureReason: pr.FailureReason,
		CreatedAt:     pr.CreatedAt,
		PaidAt:        pr.PaidAt,
	}
}

func toPaymentRequestDTOs(rows []models.PaymentRequest, usernames map[uint]string) []paymentRequestDTO {
	dtos := make([]paymentRequestDTO, len(rows))
	for i, pr := range rows {
		dtos[i] = toPaymentRequestDTO(pr, usernames[pr.UserID])
	}
	return dtos
}

// usernameMap loads every user's username for attaching to admin payment
// list responses. The portal's user base is small enough that loading it
// in full is simpler than a per-row join.
func (a *api) usernameMap() map[uint]string {
	var users []models.User
	a.db.Select("id", "username").Find(&users)
	m := make(map[uint]string, len(users))
	for _, u := range users {
		m[u.ID] = u.Username
	}
	return m
}
