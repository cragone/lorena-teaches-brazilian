package main

import (
	"context"
	"io/fs"
	"log"

	"github.com/joho/godotenv"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/billing"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/config"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/db"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/router"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/scheduler"
	webassets "github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/web"
)

func main() {
	_ = godotenv.Load() // best-effort; production has no .env and relies on real env vars

	cfg := config.Load()

	gormDB, err := db.Open(cfg.DataDir)
	if err != nil {
		log.Fatalf("db init: %v", err)
	}

	distFS, err := fs.Sub(webassets.DistFS, "dist")
	if err != nil {
		log.Fatalf("embed fs: %v", err)
	}

	stripeClient := billing.New(cfg.StripeSecretKey)
	go scheduler.Run(context.Background(), gormDB)

	engine := router.New(distFS, gormDB, cfg, stripeClient)

	log.Printf("charles-ragone server listening on :%s", cfg.Port)
	if err := engine.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server exited: %v", err)
	}
}
