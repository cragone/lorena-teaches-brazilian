package config

import "os"

type Config struct {
	Port    string
	DataDir string

	CookieSecure bool
}

func Load() Config {
	return Config{
		Port:    getenv("PORT", "80"),
		DataDir: getenv("DATA_DIR", "./data"),

		CookieSecure: getenv("COOKIE_SECURE", "true") == "true",
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
