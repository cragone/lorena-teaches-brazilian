import { Routes, Route, Navigate } from "react-router-dom";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Billing from "./pages/Billing";
import AdminUsers from "./pages/AdminUsers";
import RecurringPayments from "./pages/admin/RecurringPayments";
import PaymentRequests from "./pages/admin/PaymentRequests";
import Units from "./pages/admin/Units";
import Rotation from "./pages/admin/Rotation";

export default function PortalApp() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/billing" element={<Billing />} />

        <Route element={<RequireAdmin />}>
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/units" element={<Units />} />
          <Route path="/admin/recurring-payments" element={<RecurringPayments />} />
          <Route path="/admin/payment-requests" element={<PaymentRequests />} />
          <Route path="/admin/rotation" element={<Rotation />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
