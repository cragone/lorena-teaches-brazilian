package portal

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

type unitMemberDTO struct {
	UserID   uint   `json:"user_id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

type unitDTO struct {
	ID      uint            `json:"id"`
	Name    string          `json:"name"`
	Members []unitMemberDTO `json:"members"`
}

// toUnitDTOs builds unit responses; members maps unit id to its members
// (nil omits them, as on the tenant-facing list).
func toUnitDTOs(units []models.Unit, members map[uint][]unitMemberDTO) []unitDTO {
	dtos := make([]unitDTO, len(units))
	for i, u := range units {
		m := members[u.ID]
		if m == nil {
			m = []unitMemberDTO{}
		}
		dtos[i] = unitDTO{ID: u.ID, Name: u.Name, Members: m}
	}
	return dtos
}

func (a *api) loadUnitDTOs(units []models.Unit) []unitDTO {
	var rows []models.UnitMember
	a.db.Order("id").Find(&rows)
	var users []models.User
	a.db.Find(&users)
	byID := make(map[uint]models.User, len(users))
	for _, u := range users {
		byID[u.ID] = u
	}
	members := map[uint][]unitMemberDTO{}
	for _, r := range rows {
		u := byID[r.UserID]
		members[r.UnitID] = append(members[r.UnitID], unitMemberDTO{UserID: u.ID, Username: u.Username, Email: u.Email})
	}
	return toUnitDTOs(units, members)
}

func (a *api) ListUnits(c *gin.Context) {
	var units []models.Unit
	if err := a.db.Order("name").Find(&units).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"units": a.loadUnitDTOs(units)})
}

func (a *api) CreateUnit(c *gin.Context) {
	var req struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_name"})
		return
	}
	unit := models.Unit{Name: strings.TrimSpace(req.Name)}
	if err := a.db.Create(&unit).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "name_taken"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"unit": a.loadUnitDTOs([]models.Unit{unit})[0]})
}

// DeleteUnit refuses while charges reference the unit, so payment history
// never loses its owner.
func (a *api) DeleteUnit(c *gin.Context) {
	unit, ok := a.loadUnitParam(c)
	if !ok {
		return
	}
	var charges int64
	a.db.Model(&models.PaymentRequest{}).Where("unit_id = ?", unit.ID).Count(&charges)
	var schedules int64
	a.db.Model(&models.RecurringPayment{}).Where("unit_id = ?", unit.ID).Count(&schedules)
	if charges+schedules > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "unit_has_charges"})
		return
	}
	a.db.Where("unit_id = ?", unit.ID).Delete(&models.UnitMember{})
	if err := a.db.Delete(&unit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (a *api) AddUnitMember(c *gin.Context) {
	unit, ok := a.loadUnitParam(c)
	if !ok {
		return
	}
	var req struct {
		UserID uint `json:"user_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.UserID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	var user models.User
	if err := a.db.First(&user, req.UserID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found"})
		return
	}
	var existing int64
	a.db.Model(&models.UnitMember{}).Where("unit_id = ? AND user_id = ?", unit.ID, user.ID).Count(&existing)
	if existing > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "already_member"})
		return
	}
	if err := a.db.Create(&models.UnitMember{UnitID: unit.ID, UserID: user.ID}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"unit": a.loadUnitDTOs([]models.Unit{unit})[0]})
}

func (a *api) RemoveUnitMember(c *gin.Context) {
	unit, ok := a.loadUnitParam(c)
	if !ok {
		return
	}
	userID, err := strconv.ParseUint(c.Param("user_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	a.db.Where("unit_id = ? AND user_id = ?", unit.ID, uint(userID)).Delete(&models.UnitMember{})
	c.Status(http.StatusNoContent)
}

func (a *api) loadUnitParam(c *gin.Context) (models.Unit, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return models.Unit{}, false
	}
	var unit models.Unit
	if err := a.db.First(&unit, uint(id)).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return models.Unit{}, false
	}
	return unit, true
}
