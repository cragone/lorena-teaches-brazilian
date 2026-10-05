package portal

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

// RotationSchedule returns the rotation member list and recent/current
// assignments to any authenticated user, so the frontend can show a
// "whose month is it" widget. Unlike every other non-admin endpoint, this
// intentionally exposes other users' usernames — the rotation only ever
// has the 3 co-owners in it, and knowing who's up this month is the whole
// point of the feature.
func (a *api) RotationSchedule(c *gin.Context) {
	if err := a.ensureRotationAssignmentsThroughCurrentMonth(); err != nil && !errors.Is(err, errNoActiveRotationMembers) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	var members []models.RotationMember
	if err := a.db.Where("active = ?", true).Order("position asc").Find(&members).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	var rows []models.RotationAssignment
	if err := a.db.Order("month desc").Limit(3).Find(&rows).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	dtos, err := a.toRotationAssignmentDTOs(rows)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"members":     toRotationMemberDTOs(members, a.usernameMap()),
		"assignments": dtos,
	})
}
