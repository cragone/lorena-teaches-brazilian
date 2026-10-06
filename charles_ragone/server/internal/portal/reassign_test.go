package portal

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/db"
	"github.com/cragone/lorena-teaches-brazilian/charles_ragone/server/internal/models"
)

func TestReassignRotationAssignment(t *testing.T) {
	gdb, err := db.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	a := &api{db: gdb}
	u1 := models.User{Username: "one", Email: "1@x.com"}
	u2 := models.User{Username: "two", Email: "2@x.com"}
	gdb.Create(&u1)
	gdb.Create(&u2)
	m1 := models.RotationMember{UserID: u1.ID, Position: 1, Active: true}
	m2 := models.RotationMember{UserID: u2.ID, Position: 2, Active: true}
	gdb.Create(&m1)
	gdb.Create(&m2)
	pr := models.PaymentRequest{UserID: &u1.ID, Category: "property_management", AmountCents: 100, Source: "manual", Status: models.PaymentStatusPending}
	gdb.Create(&pr)
	as := models.RotationAssignment{Month: "2026-10", RotationMemberID: m1.ID, MemberPosition: 1, Resolution: models.RotationResolutionCharged, PaymentRequestID: &pr.ID}
	gdb.Create(&as)

	call := func(body string) int {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPatch, "/", strings.NewReader(body))
		c.Params = gin.Params{{Key: "id", Value: "1"}}
		a.ReassignRotationAssignment(c)
		return w.Code
	}

	if code := call(`{"rotation_member_id":2}`); code != 200 {
		t.Fatalf("reassign: %d", code)
	}
	var got models.RotationAssignment
	gdb.First(&got, as.ID)
	if got.RotationMemberID != m2.ID || got.MemberPosition != 2 || got.Resolution != "pending" || got.PaymentRequestID != nil {
		t.Fatalf("bad assignment: %+v", got)
	}
	gdb.First(&pr, pr.ID)
	if pr.Status != models.PaymentStatusCanceled {
		t.Fatalf("old charge not canceled: %s", pr.Status)
	}

	// A paid charge blocks reassignment.
	paid := models.PaymentRequest{UserID: &u2.ID, Category: "property_management", AmountCents: 100, Source: "manual", Status: models.PaymentStatusSucceeded}
	gdb.Create(&paid)
	gdb.Model(&got).Updates(map[string]any{"payment_request_id": paid.ID, "resolution": "charged"})
	if code := call(`{"rotation_member_id":1}`); code != 409 {
		t.Fatalf("paid reassign: %d", code)
	}
}
