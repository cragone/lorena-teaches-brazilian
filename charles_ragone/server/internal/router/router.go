package router

import (
	"io/fs"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/config"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/handlers"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/httpx"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/portal"
)

const PortalHost = "yates.charlesragone.com"

func New(distFS fs.FS, gormDB *gorm.DB, cfg config.Config) *gin.Engine {
	engine := gin.New()
	engine.Use(gin.Recovery(), httpx.SecurityHeaders())

	// Shared across every host: charlesragone.com, www, and yates.
	engine.GET("/api/health", handlers.Health)

	// Everything else is dispatched by Host header. Anything that isn't
	// exactly the portal host (including localhost/bare IPs/misconfigured
	// clients) falls through to the real site, not the portal.
	spa := httpx.ServeSPA(distFS, "index.html")
	portalEngine := portal.New(gormDB, cfg, distFS)
	engine.NoRoute(func(c *gin.Context) {
		if normalizeHost(c.Request.Host) == PortalHost {
			portalEngine.ServeHTTP(c.Writer, c.Request)
			return
		}
		spa(c)
	})

	return engine
}

func normalizeHost(host string) string {
	if i := strings.IndexByte(host, ':'); i != -1 {
		host = host[:i]
	}
	return strings.ToLower(host)
}
