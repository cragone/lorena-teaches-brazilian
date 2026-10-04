package portal

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/auth"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/config"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

const contextUserKey = "portal_user"
const contextCSRFKey = "portal_csrf_token"

// RequireAuth resolves the session cookie to a user and aborts with 401 if
// it's missing, invalid, or expired.
func RequireAuth(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie(sessionCookieName)
		if err != nil || token == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		user, err := auth.LookupSession(db, token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		c.Set(contextUserKey, user)
		c.Next()
	}
}

// RequireAdmin must run after RequireAuth. It aborts with 403 if the
// resolved user isn't an admin.
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		user := currentUser(c)
		if user == nil || user.Role != models.RoleAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Next()
	}
}

// EnsureCSRFCookie makes sure every request carries a CSRF cookie, issuing
// one if absent, and stashes its value for handlers to echo back in JSON
// response bodies (the frontend learns the CSRF token only from response
// bodies, never from document.cookie, since the cookie is HttpOnly).
func EnsureCSRFCookie(cfg config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie(csrfCookieName)
		if err != nil || token == "" {
			token, err = auth.GenerateToken()
			if err != nil {
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
				return
			}
			setCookie(c, cfg, csrfCookieName, token, true)
		}

		c.Set(contextCSRFKey, token)
		c.Next()
	}
}

// CSRFProtect enforces the double-submit cookie pattern on mutating
// requests: the X-CSRF-Token header must match the portal_csrf cookie.
func CSRFProtect() gin.HandlerFunc {
	unsafeMethods := map[string]bool{
		http.MethodPost:   true,
		http.MethodPut:    true,
		http.MethodPatch:  true,
		http.MethodDelete: true,
	}

	return func(c *gin.Context) {
		if !unsafeMethods[c.Request.Method] {
			c.Next()
			return
		}

		cookieToken, err := c.Cookie(csrfCookieName)
		headerToken := c.GetHeader("X-CSRF-Token")
		if err != nil || cookieToken == "" || headerToken == "" || cookieToken != headerToken {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "csrf"})
			return
		}

		c.Next()
	}
}

func currentUser(c *gin.Context) *models.User {
	value, ok := c.Get(contextUserKey)
	if !ok {
		return nil
	}
	user, ok := value.(*models.User)
	if !ok {
		return nil
	}
	return user
}

func currentCSRFToken(c *gin.Context) string {
	value, _ := c.Get(contextCSRFKey)
	token, _ := value.(string)
	return token
}

func setCookie(c *gin.Context, cfg config.Config, name, value string, httpOnly bool) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(name, value, int(auth.SessionTTL.Seconds()), "/", "", cfg.CookieSecure, httpOnly)
}

func clearCookie(c *gin.Context, cfg config.Config, name string) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(name, "", -1, "/", "", cfg.CookieSecure, true)
}
