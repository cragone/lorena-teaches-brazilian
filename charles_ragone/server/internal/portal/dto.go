package portal

import (
	"time"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

type userDTO struct {
	ID         uint       `json:"id"`
	Username   string     `json:"username"`
	Email      string     `json:"email"`
	Role       string     `json:"role"`
	DisabledAt *time.Time `json:"disabled_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

func toUserDTO(u models.User) userDTO {
	return userDTO{
		ID:         u.ID,
		Username:   u.Username,
		Email:      u.Email,
		Role:       u.Role,
		DisabledAt: u.DisabledAt,
		CreatedAt:  u.CreatedAt,
	}
}

func toUserDTOs(users []models.User) []userDTO {
	dtos := make([]userDTO, len(users))
	for i, u := range users {
		dtos[i] = toUserDTO(u)
	}
	return dtos
}
