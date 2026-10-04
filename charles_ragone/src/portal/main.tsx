import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "../index.css";
import { AuthProvider } from "./AuthContext";
import PortalApp from "./PortalApp";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <PortalApp />
    </AuthProvider>
  </BrowserRouter>,
);
