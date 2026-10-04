package config

import "os"

type Config struct {
	Port    string
	DataDir string

	CookieSecure bool

	StripeSecretKey      string
	StripePublishableKey string
	StripeWebhookSecret  string
}

func Load() Config {
	return Config{
		Port:    getenv("PORT", "80"),
		DataDir: getenv("DATA_DIR", "./data"),

		CookieSecure: getenv("COOKIE_SECURE", "true") == "true",

		StripeSecretKey:      getenv("STRIPE_SECRET_KEY", ""),
		StripePublishableKey: getenv("STRIPE_PUBLISHABLE_KEY", ""),
		StripeWebhookSecret:  getenv("STRIPE_WEBHOOK_SECRET", ""),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
