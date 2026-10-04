package portal

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// StripeConfig exposes the publishable key so the frontend never needs it
// baked in at build time — it's fetched at runtime instead.
func (a *api) StripeConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"publishable_key": a.cfg.StripePublishableKey})
}
