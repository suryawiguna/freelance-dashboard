import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./components/Toast";
import { UpdateBanner } from "./components/UpdateBanner";
import { AuthProvider } from "./features/auth/AuthContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
      <UpdateBanner />
    </ToastProvider>
  </StrictMode>,
);
