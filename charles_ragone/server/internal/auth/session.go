package auth

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

const SessionTTL = 30 * 24 * time.Hour

var ErrInvalidSession = errors.New("invalid session")

// CreateSession issues a new opaque session token for userID and persists
// its hash.
func CreateSession(db *gorm.DB, userID uint, userAgent, ip string) (string, time.Time, error) {
	token, err := GenerateToken()
	if err != nil {
		return "", time.Time{}, err
	}

	now := time.Now()
	expiresAt := now.Add(SessionTTL)
	session := models.Session{
		TokenHash:  HashToken(token),
		UserID:     userID,
		CreatedAt:  now,
		LastSeenAt: now,
		ExpiresAt:  expiresAt,
		UserAgent:  userAgent,
		IP:         ip,
	}
	if err := db.Create(&session).Error; err != nil {
		return "", time.Time{}, err
	}

	return token, expiresAt, nil
}

// LookupSession resolves a raw session token to its user, rejecting
// expired sessions and disabled/deleted users.
func LookupSession(db *gorm.DB, token string) (*models.User, error) {
	var session models.Session
	if err := db.Where("token_hash = ?", HashToken(token)).First(&session).Error; err != nil {
		return nil, ErrInvalidSession
	}
	if session.ExpiresAt.Before(time.Now()) {
		return nil, ErrInvalidSession
	}

	var user models.User
	if err := db.First(&user, session.UserID).Error; err != nil {
		return nil, ErrInvalidSession
	}
	if user.DisabledAt != nil {
		return nil, ErrInvalidSession
	}

	db.Model(&session).Update("last_seen_at", time.Now())

	return &user, nil
}

// DeleteSession removes a single session by its raw token (used on logout).
func DeleteSession(db *gorm.DB, token string) error {
	return db.Where("token_hash = ?", HashToken(token)).Delete(&models.Session{}).Error
}

// DeleteAllSessionsForUser revokes every session belonging to a user (used
// when an admin disables an account or resets its password).
func DeleteAllSessionsForUser(db *gorm.DB, userID uint) error {
	return db.Where("user_id = ?", userID).Delete(&models.Session{}).Error
}
