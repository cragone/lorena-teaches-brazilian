package httpx

import (
	"io/fs"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

var hashedAssetPattern = regexp.MustCompile(`(?i)\.(js|css|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot)$`)

// ServeSPA mirrors nginx.conf's try_files behavior: serve a static file if
// it exists, otherwise fall back to the given HTML entry point for
// client-side routing (e.g. "index.html" for the main site, "portal.html"
// for the payments portal).
//
// The fallback is served by reading it directly rather than delegating to
// http.FileServer, because net/http's file server special-cases any request
// literally named "index.html" with a 301 redirect to its containing
// directory — which would misfire here since "fallback" isn't necessarily
// named "index.html".
func ServeSPA(distFS fs.FS, fallback string) gin.HandlerFunc {
	fileServer := http.FileServer(http.FS(distFS))

	serveFallback := func(c *gin.Context) {
		data, err := fs.ReadFile(distFS, fallback)
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	}

	return func(c *gin.Context) {
		reqPath := strings.TrimPrefix(c.Request.URL.Path, "/")
		if reqPath == "" {
			serveFallback(c)
			return
		}

		if _, err := fs.Stat(distFS, reqPath); err != nil {
			serveFallback(c)
			return
		}
		if hashedAssetPattern.MatchString(reqPath) {
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		}

		fileServer.ServeHTTP(c.Writer, c.Request)
	}
}
