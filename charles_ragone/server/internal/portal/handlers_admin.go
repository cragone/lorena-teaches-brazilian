package portal

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/auth"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

type updateRoleRequest struct {
	Role string `json:"role"`
}

type setDisabledRequest struct {
	Disabled bool `json:"disabled"`
}

type adminResetPasswordRequest struct {
	NewPassword string `json:"new_password"`
}

func (a *api) ListUsers(c *gin.Context) {
	var users []models.User
	if err := a.db.Order("id").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": toUserDTOs(users)})
}

func (a *api) UpdateUserRole(c *gin.Context) {
	target, ok := a.loadUserParam(c)
	if !ok {
		return
	}

	var req updateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil || (req.Role != models.RoleUser && req.Role != models.RoleAdmin) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_role"})
		return
	}

	if target.Role == models.RoleAdmin && req.Role == models.RoleUser {
		var adminCount int64
		a.db.Model(&models.User{}).Where("role = ?", models.RoleAdmin).Count(&adminCount)
		if adminCount <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot_demote_last_admin"})
			return
		}
	}

	if err := a.db.Model(&target).Update("role", req.Role).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	target.Role = req.Role
	c.JSON(http.StatusOK, gin.H{"user": toUserDTO(target)})
}

func (a *api) SetUserDisabled(c *gin.Context) {
	target, ok := a.loadUserParam(c)
	if !ok {
		return
	}

	var req setDisabledRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}

	var disabledAt *time.Time
	if req.Disabled {
		now := time.Now()
		disabledAt = &now
	}

	if err := a.db.Model(&target).Update("disabled_at", disabledAt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	if req.Disabled {
		_ = auth.DeleteAllSessionsForUser(a.db, target.ID)
	}
	target.DisabledAt = disabledAt
	c.JSON(http.StatusOK, gin.H{"user": toUserDTO(target)})
}

func (a *api) AdminResetPassword(c *gin.Context) {
	target, ok := a.loadUserParam(c)
	if !ok {
		return
	}

	var req adminResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	if err := auth.ValidatePassword(req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	if err := a.db.Model(&target).Update("password_hash", hash).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	_ = auth.DeleteAllSessionsForUser(a.db, target.ID)

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (a *api) loadUserParam(c *gin.Context) (models.User, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return models.User{}, false
	}

	var user models.User
	if err := a.db.First(&user, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return models.User{}, false
	}
	return user, true
}
