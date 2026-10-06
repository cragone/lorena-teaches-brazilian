package portal

import (
	"io/fs"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/billing"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/config"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/httpx"
)

// api holds the shared dependencies for portal handlers.
type api struct {
	db     *gorm.DB
	cfg    config.Config
	stripe *billing.Client
}

// New builds the self-contained engine serving yates.charlesragone.com:
// the auth/admin JSON API plus the portal SPA fallback.
func New(db *gorm.DB, cfg config.Config, distFS fs.FS, stripeClient *billing.Client) *gin.Engine {
	a := &api{db: db, cfg: cfg, stripe: stripeClient}

	engine := gin.New()
	engine.Use(gin.Recovery(), httpx.SecurityHeaders())

	// Stripe webhooks aren't browser requests: no CSRF cookie, no session,
	// and the raw body must reach the handler untouched for signature
	// verification, so this is registered before EnsureCSRFCookie runs.
	engine.POST("/api/webhooks/stripe", a.StripeWebhook)

	engine.Use(EnsureCSRFCookie(cfg))

	engine.GET("/api/stripe/config", a.StripeConfig)

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
	admin.GET("/payments/recurring", a.ListRecurringPayments)
	admin.POST("/payments/recurring", CSRFProtect(), a.CreateRecurringPayment)
	admin.PATCH("/payments/recurring/:id", CSRFProtect(), a.UpdateRecurringPayment)
	admin.DELETE("/payments/recurring/:id", CSRFProtect(), a.CancelRecurringPayment)
	admin.GET("/payments/requests", a.ListPaymentRequests)
	admin.POST("/payments/requests", CSRFProtect(), a.CreatePaymentRequest)
	admin.DELETE("/payments/requests/:id", CSRFProtect(), a.DeletePaymentRequest)
	admin.GET("/rotation/members", a.ListRotationMembers)
	admin.POST("/rotation/members", CSRFProtect(), a.AddRotationMember)
	admin.PATCH("/rotation/members/:id", CSRFProtect(), a.UpdateRotationMember)
	admin.PUT("/rotation/members/order", CSRFProtect(), a.ReorderRotationMembers)
	admin.GET("/rotation/settings", a.GetRotationSettings)
	admin.PATCH("/rotation/settings", CSRFProtect(), a.UpdateRotationSettings)
	admin.GET("/rotation/assignments", a.ListRotationAssignments)
	admin.POST("/rotation/assignments/:id/waive", CSRFProtect(), a.RecordRotationWork)
	admin.POST("/rotation/assignments/:id/charge", CSRFProtect(), a.ChargeRotationAssignment)
	admin.POST("/rotation/assignments/:id/reset", CSRFProtect(), a.ResetRotationAssignment)

	payments := engine.Group("/api/payments", RequireAuth(db))
	payments.GET("/me", a.MyPayments)
	payments.POST("/requests/:id/pay", CSRFProtect(), a.PayPaymentRequest)
	payments.POST("/requests/:id/sync", CSRFProtect(), a.SyncPaymentRequest)

	rotation := engine.Group("/api/rotation", RequireAuth(db))
	rotation.GET("/schedule", a.RotationSchedule)

	engine.NoRoute(httpx.ServeSPA(distFS, "portal.html"))

	return engine
}
