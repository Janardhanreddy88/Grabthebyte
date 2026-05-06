import React from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react"; // 🦅 1. Import Sentry
import App from "./App.tsx";
import "./index.css";

// =====================================================================
// 🦅 2. SENTRY INITIALIZATION (The Flight Recorder)
// =====================================================================
Sentry.init({
  // Pulls your secret DSN safely from your .env file
  dsn: import.meta.env.VITE_SENTRY_DSN,
  
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  
  // Performance Monitoring: Captures 100% of transactions for performance tracking
  tracesSampleRate: 1.0, 
  
  // Session Replay: Records video of 10% of normal users, but 100% of users who experience a crash!
  replaysSessionSampleRate: 0.1, 
  replaysOnErrorSampleRate: 1.0, 
});
// =====================================================================

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);