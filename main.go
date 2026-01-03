package main

import (
	"embed"
	"io/fs"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Embed index.html and all assets
//
//go:embed index.html assets/*
var embeddedFiles embed.FS

func main() {
	r := gin.Default()

	// Serve embedded assets
	assetsFS, err := fs.Sub(embeddedFiles, "assets")
	if err != nil {
		panic(err)
	}
	r.StaticFS("/assets", http.FS(assetsFS))

	// Serve embedded index.html
	r.GET("/", func(c *gin.Context) {
		data, err := embeddedFiles.ReadFile("index.html")
		if err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})

	// SPA fallback
	r.NoRoute(func(c *gin.Context) {
		data, err := embeddedFiles.ReadFile("index.html")
		if err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})

	r.Run(":8080")
}
