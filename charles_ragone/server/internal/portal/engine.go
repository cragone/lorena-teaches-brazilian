package portal

import (
	"io/fs"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/config"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/httpx"
)

// api holds the shared dependencies for portal handlers.
type api struct {
	db  *gorm.DB
	cfg config.Config
}

// New builds the self-contained engine serving yates.charlesragone.com:
// the auth/admin JSON API plus the portal SPA fallback.
func New(db *gorm.DB, cfg config.Config, distFS fs.FS) *gin.Engine {
	a := &api{db: db, cfg: cfg}

	engine := gin.New()
	engine.Use(gin.Recovery(), httpx.SecurityHeaders(), EnsureCSRFCookie(cfg))

	auth := engine.Group("/api/auth")
	auth.GET("/csrf", a.IssueCSRF)
	auth.POST("/register", CSRFProtect(), a.Register)
	auth.POST("/login", CSRFProtect(), a.Login)
	auth.GET("/me", RequireAuth(db), a.Me)
	auth.POST("/logout", RequireAuth(db), CSRFProtect(), a.Logout)

	admin := engine.Group("/api/admin", RequireAuth(db), RequireAdmin())
	admin.GET("/users", a.ListUsers)
	admin.PATCH("/users/:id/role", CSRFProtect(), a.UpdateUserRole)
	admin.PATCH("/users/:id/disabled", CSRFProtect(), a.SetUserDisabled)
	admin.PATCH("/users/:id/password", CSRFProtect(), a.AdminResetPassword)

	engine.NoRoute(httpx.ServeSPA(distFS, "portal.html"))

	return engine
}
