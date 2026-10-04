package auth

import (
	"errors"
	"net/mail"
	"strings"
)

var (
	ErrInvalidUsername = errors.New("username must be between 3 and 32 characters")
	ErrInvalidEmail    = errors.New("email is not valid")
	ErrInvalidPassword = errors.New("password must be at least 8 characters")
)

func ValidateUsername(username string) error {
	username = strings.TrimSpace(username)
	if len(username) < 3 || len(username) > 32 {
		return ErrInvalidUsername
	}
	return nil
}

func ValidateEmail(email string) error {
	if _, err := mail.ParseAddress(email); err != nil {
		return ErrInvalidEmail
	}
	return nil
}

func ValidatePassword(password string) error {
	if len(password) < 8 {
		return ErrInvalidPassword
	}
	return nil
}
