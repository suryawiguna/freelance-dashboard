import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { ToastProvider } from "./components/Toast";
import { UpdateBanner } from "./components/UpdateBanner";
import { AuthProvider } from "./features/auth/AuthContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ConfirmProvider>
      <UpdateBanner />
    </ToastProvider>
  </StrictMode>,
);
