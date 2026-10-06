package portal

import (
	"time"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

type rotationMemberDTO struct {
	ID       uint   `json:"id"`
	UserID   uint   `json:"user_id"`
	Username string `json:"username,omitempty"`
	Position int    `json:"position"`
	Active   bool   `json:"active"`
}

func toRotationMemberDTO(m models.RotationMember, username string) rotationMemberDTO {
	return rotationMemberDTO{ID: m.ID, UserID: m.UserID, Username: username, Position: m.Position, Active: m.Active}
}

func toRotationMemberDTOs(rows []models.RotationMember, usernames map[uint]string) []rotationMemberDTO {
	dtos := make([]rotationMemberDTO, len(rows))
	for i, m := range rows {
		dtos[i] = toRotationMemberDTO(m, usernames[m.UserID])
	}
	return dtos
}

type rotationSettingsDTO struct {
	AmountCents int64  `json:"amount_cents"`
	Currency    string `json:"currency"`
}

func toRotationSettingsDTO(s models.RotationSettings) rotationSettingsDTO {
	return rotationSettingsDTO{AmountCents: s.AmountCents, Currency: s.Currency}
}

type rotationAssignmentDTO struct {
	ID               uint      `json:"id"`
	RotationMemberID uint      `json:"rotation_member_id"`
	Month            string    `json:"month"`
	UserID           uint      `json:"user_id"`
	Username         string    `json:"username,omitempty"`
	Resolution       string    `json:"resolution"`
	Notes            string    `json:"notes,omitempty"`
	PaymentRequestID *uint     `json:"payment_request_id,omitempty"`
	PaymentStatus    string    `json:"payment_status,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
}

// toRotationAssignmentDTOs joins each assignment to its member's username
// and, for charged assignments, the linked payment request's live status —
// the assignment itself never stores a "paid" flag, to avoid a second
// source of truth alongside payment_requests.status.
func (a *api) toRotationAssignmentDTOs(rows []models.RotationAssignment) ([]rotationAssignmentDTO, error) {
	if len(rows) == 0 {
		return []rotationAssignmentDTO{}, nil
	}

	memberIDs := make([]uint, 0, len(rows))
	prIDs := make([]uint, 0, len(rows))
	for _, r := range rows {
		memberIDs = append(memberIDs, r.RotationMemberID)
		if r.PaymentRequestID != nil {
			prIDs = append(prIDs, *r.PaymentRequestID)
		}
	}

	var members []models.RotationMember
	if err := a.db.Where("id IN ?", memberIDs).Find(&members).Error; err != nil {
		return nil, err
	}
	memberByID := make(map[uint]models.RotationMember, len(members))
	for _, m := range members {
		memberByID[m.ID] = m
	}

	usernames := a.usernameMap()

	statusByPR := map[uint]string{}
	if len(prIDs) > 0 {
		var prs []models.PaymentRequest
		if err := a.db.Where("id IN ?", prIDs).Find(&prs).Error; err != nil {
			return nil, err
		}
		for _, pr := range prs {
			statusByPR[pr.ID] = pr.Status
		}
	}

	dtos := make([]rotationAssignmentDTO, len(rows))
	for i, r := range rows {
		member := memberByID[r.RotationMemberID]
		dto := rotationAssignmentDTO{
			ID:               r.ID,
			Month:            r.Month,
			RotationMemberID: r.RotationMemberID,
			UserID:           member.UserID,
			Username:         usernames[member.UserID],
			Resolution:       r.Resolution,
			Notes:            r.Notes,
			PaymentRequestID: r.PaymentRequestID,
			CreatedAt:        r.CreatedAt,
		}
		if r.PaymentRequestID != nil {
			dto.PaymentStatus = statusByPR[*r.PaymentRequestID]
		}
		dtos[i] = dto
	}
	return dtos, nil
}
