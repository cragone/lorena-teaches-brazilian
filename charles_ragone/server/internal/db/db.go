package db

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"github.com/pressly/goose/v3"
	"gorm.io/gorm"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/migrations"
)

func Open(dataDir string) (*gorm.DB, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	dbPath := filepath.Join(dataDir, "charles.sqlite")
	gormDB, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	if err := migrate(gormDB); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return gormDB, nil
}

func migrate(gormDB *gorm.DB) error {
	sqlDB, err := gormDB.DB()
	if err != nil {
		return fmt.Errorf("unwrap sql.DB: %w", err)
	}

	goose.SetBaseFS(migrations.FS)
	if err := goose.SetDialect("sqlite3"); err != nil {
		return fmt.Errorf("set dialect: %w", err)
	}

	return goose.Up(sqlDB, ".")
}
