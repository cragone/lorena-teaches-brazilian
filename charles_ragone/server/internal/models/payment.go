package models

// Payment categories an admin can schedule or request. Kept as plain
// strings (validated here, not via a DB CHECK) so adding one later is a
// one-line change, not a migration.
const (
	CategoryRent               = "rent"
	CategoryWifi               = "wifi"
	CategoryNationalGrid       = "national_grid"
	CategoryOther              = "other"
	CategoryPropertyManagement = "property_management"
)

func ValidCategory(category string) bool {
	switch category {
	case CategoryRent, CategoryWifi, CategoryNationalGrid, CategoryOther, CategoryPropertyManagement:
		return true
	default:
		return false
	}
}

const (
	PaymentSourceManual    = "manual"
	PaymentSourceRecurring = "recurring"
)

const (
	PaymentStatusPending    = "pending"
	PaymentStatusProcessing = "processing"
	PaymentStatusSucceeded  = "succeeded"
	PaymentStatusFailed     = "failed"
	PaymentStatusCanceled   = "canceled"
)
