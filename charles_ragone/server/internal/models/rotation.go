package models

import "time"

// RotationMember is a co-owner eligible for the property-manager rotation.
// Position is a monotonic counter (never reused) so removing a member never
// requires renumbering the rest, and re-adding one later rejoins at the end
// of the current order rather than resuming their old slot.
type RotationMember struct {
	ID        uint `gorm:"primaryKey"`
	UserID    uint
	Position  int
	Active    bool
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (RotationMember) TableName() string { return "rotation_members" }

// RotationSettings is a singleton row (id=1) holding the admin-configurable
// charge amount for a month where the assignee didn't do the work.
type RotationSettings struct {
	ID          uint `gorm:"primaryKey"`
	AmountCents int64
	Currency    string
	UpdatedAt   time.Time
}

func (RotationSettings) TableName() string { return "rotation_settings" }

const (
	RotationResolutionPending = "pending"
	RotationResolutionWaived  = "waived"
	RotationResolutionCharged = "charged"
)

// RotationAssignment is one calendar month's property-manager turn.
// MemberPosition snapshots the assignee's RotationMember.Position at
// assignment time, so the next month's assignee can still be computed
// correctly even if that member is later deactivated or the active list is
// reordered. Whether a "charged" assignment has actually been paid is read
// live from the linked PaymentRequest's status, never stored here.
type RotationAssignment struct {
	ID               uint `gorm:"primaryKey"`
	Month            string
	RotationMemberID uint
	MemberPosition   int
	Resolution       string
	Notes            string
	PaymentRequestID *uint
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

func (RotationAssignment) TableName() string { return "rotation_assignments" }
