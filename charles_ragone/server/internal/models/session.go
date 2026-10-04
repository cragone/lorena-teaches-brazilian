package models

import "time"

// Session is a server-side record backing an opaque portal session cookie.
// Only the hash of the session token is ever stored.
type Session struct {
	ID         uint `gorm:"primaryKey"`
	TokenHash  string
	UserID     uint
	CreatedAt  time.Time
	LastSeenAt time.Time
	ExpiresAt  time.Time
	UserAgent  string
	IP         string
}

func (Session) TableName() string { return "sessions" }
