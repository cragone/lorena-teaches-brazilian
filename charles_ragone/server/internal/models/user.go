package models

import (
	"time"

	"gorm.io/gorm"
)

// User backs login for the yates.charlesragone.com payments portal.
type User struct {
	ID               uint `gorm:"primaryKey"`
	Username         string
	Email            string
	PasswordHash     string `json:"-"`
	Role             string
	DisabledAt       *time.Time
	StripeCustomerID *string
	CreatedAt        time.Time
	UpdatedAt        time.Time
	DeletedAt        gorm.DeletedAt `gorm:"index"`
}

const (
	RoleUser  = "user"
	RoleAdmin = "admin"
)

func (User) TableName() string { return "users" }
