package models

import "time"

// Unit is an apartment or house. Charges can be addressed to a unit, and
// any of its members may pay them.
type Unit struct {
	ID        uint `gorm:"primaryKey"`
	Name      string
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (Unit) TableName() string { return "units" }

// UnitMember links a user to a unit.
type UnitMember struct {
	ID        uint `gorm:"primaryKey"`
	UnitID    uint
	UserID    uint
	CreatedAt time.Time
}

func (UnitMember) TableName() string { return "unit_members" }
