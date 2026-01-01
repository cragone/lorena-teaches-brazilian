import { Routes, Route, Navigate } from "react-router-dom";

import Homepage from "./pages/Homepage.tsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
