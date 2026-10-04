package portal

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/auth"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

type registerRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginRequest struct {
	UsernameOrEmail string `json:"username_or_email"`
	Password        string `json:"password"`
}

// IssueCSRF primes the CSRF cookie (EnsureCSRFCookie already ran) and
// returns its value so a not-yet-authenticated client can learn it.
func (a *api) IssueCSRF(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"csrf_token": currentCSRFToken(c)})
}

func (a *api) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}

	if err := auth.ValidateUsername(req.Username); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := auth.ValidateEmail(req.Email); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := auth.ValidatePassword(req.Password); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	user := models.User{
		Username:     strings.TrimSpace(req.Username),
		Email:        strings.ToLower(strings.TrimSpace(req.Email)),
		PasswordHash: hash,
		Role:         models.RoleUser,
	}
	if err := a.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "username_or_email_taken"})
		return
	}

	a.startSession(c, user)
	c.JSON(http.StatusCreated, gin.H{"user": toUserDTO(user), "csrf_token": currentCSRFToken(c)})
}

func (a *api) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}

	identifier := strings.TrimSpace(req.UsernameOrEmail)
	var user models.User
	err := a.db.Where("username = ? OR email = ?", identifier, strings.ToLower(identifier)).First(&user).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
			return
		}
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_credentials"})
		return
	}
	if !auth.VerifyPassword(user.PasswordHash, req.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_credentials"})
		return
	}
	if user.DisabledAt != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "account_disabled"})
		return
	}

	a.startSession(c, user)
	c.JSON(http.StatusOK, gin.H{"user": toUserDTO(user), "csrf_token": currentCSRFToken(c)})
}

func (a *api) Me(c *gin.Context) {
	user := currentUser(c)
	c.JSON(http.StatusOK, gin.H{"user": toUserDTO(*user), "csrf_token": currentCSRFToken(c)})
}

func (a *api) Logout(c *gin.Context) {
	if token, err := c.Cookie(sessionCookieName); err == nil && token != "" {
		_ = auth.DeleteSession(a.db, token)
	}
	clearCookie(c, a.cfg, sessionCookieName)
	c.Status(http.StatusNoContent)
}

func (a *api) startSession(c *gin.Context, user models.User) {
	token, _, err := auth.CreateSession(a.db, user.ID, c.Request.UserAgent(), c.ClientIP())
	if err != nil {
		return
	}
	setCookie(c, a.cfg, sessionCookieName, token, true)
}
