package portal

import (
	"time"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

// payer names the owner of a charge: a user, or a unit shared by several.
type payer struct {
	Username string
	UnitName string
}

type recurringPaymentDTO struct {
	ID          uint       `json:"id"`
	UserID      *uint      `json:"user_id,omitempty"`
	Username    string     `json:"username,omitempty"`
	UnitID      *uint      `json:"unit_id,omitempty"`
	UnitName    string     `json:"unit_name,omitempty"`
	Category    string     `json:"category"`
	AmountCents int64      `json:"amount_cents"`
	Currency    string     `json:"currency"`
	DayOfMonth  int        `json:"day_of_month"`
	Active      bool       `json:"active"`
	NextRunAt   time.Time  `json:"next_run_at"`
	LastRunAt   *time.Time `json:"last_run_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

func toRecurringPaymentDTO(rp models.RecurringPayment, p payer) recurringPaymentDTO {
	return recurringPaymentDTO{
		ID:          rp.ID,
		UserID:      rp.UserID,
		Username:    p.Username,
		UnitID:      rp.UnitID,
		UnitName:    p.UnitName,
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

func (a *api) toRecurringPaymentDTOs(rows []models.RecurringPayment) []recurringPaymentDTO {
	usernames, unitNames := a.usernameMap(), a.unitNameMap()
	dtos := make([]recurringPaymentDTO, len(rows))
	for i, rp := range rows {
		dtos[i] = toRecurringPaymentDTO(rp, lookupPayer(rp.UserID, rp.UnitID, usernames, unitNames))
	}
	return dtos
}

type paymentRequestDTO struct {
	ID            uint       `json:"id"`
	UserID        *uint      `json:"user_id,omitempty"`
	Username      string     `json:"username,omitempty"`
	UnitID        *uint      `json:"unit_id,omitempty"`
	UnitName      string     `json:"unit_name,omitempty"`
	PaidBy        string     `json:"paid_by,omitempty"`
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

func toPaymentRequestDTO(pr models.PaymentRequest, p payer, paidBy string) paymentRequestDTO {
	return paymentRequestDTO{
		ID:            pr.ID,
		UserID:        pr.UserID,
		Username:      p.Username,
		UnitID:        pr.UnitID,
		UnitName:      p.UnitName,
		PaidBy:        paidBy,
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

func (a *api) toPaymentRequestDTOs(rows []models.PaymentRequest) []paymentRequestDTO {
	usernames, unitNames := a.usernameMap(), a.unitNameMap()
	dtos := make([]paymentRequestDTO, len(rows))
	for i, pr := range rows {
		paidBy := ""
		if pr.PaidByID != nil {
			paidBy = usernames[*pr.PaidByID]
		}
		dtos[i] = toPaymentRequestDTO(pr, lookupPayer(pr.UserID, pr.UnitID, usernames, unitNames), paidBy)
	}
	return dtos
}

func lookupPayer(userID, unitID *uint, usernames, unitNames map[uint]string) payer {
	var p payer
	if userID != nil {
		p.Username = usernames[*userID]
	}
	if unitID != nil {
		p.UnitName = unitNames[*unitID]
	}
	return p
}

// usernameMap loads every user's username for attaching to payment list
// responses. The portal's user base is small enough that loading it in
// full is simpler than a per-row join.
func (a *api) usernameMap() map[uint]string {
	var users []models.User
	a.db.Select("id", "username").Find(&users)
	m := make(map[uint]string, len(users))
	for _, u := range users {
		m[u.ID] = u.Username
	}
	return m
}

func (a *api) unitNameMap() map[uint]string {
	var units []models.Unit
	a.db.Select("id", "name").Find(&units)
	m := make(map[uint]string, len(units))
	for _, u := range units {
		m[u.ID] = u.Name
	}
	return m
}
