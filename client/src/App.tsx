import { Routes, Route, Navigate } from "react-router-dom";

import Homepage from "./pages/Homepage.tsx";
import BookingPage from "./pages/BookingPage.tsx";
import AdminPage from "./pages/AdminPage.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/book" element={<BookingPage />} />
      <Route path="/admin" element={<AdminPage />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
