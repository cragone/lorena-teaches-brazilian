package main

import (
	"io/fs"
	"log"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/config"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/db"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/router"
	webassets "github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/web"
)

func main() {
	cfg := config.Load()

	gormDB, err := db.Open(cfg.DataDir)
	if err != nil {
		log.Fatalf("db init: %v", err)
	}

	distFS, err := fs.Sub(webassets.DistFS, "dist")
	if err != nil {
		log.Fatalf("embed fs: %v", err)
	}

	engine := router.New(distFS, gormDB, cfg)

	log.Printf("charles-ragone server listening on :%s", cfg.Port)
	if err := engine.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server exited: %v", err)
	}
}
