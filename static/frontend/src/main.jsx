// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { API_BASE } from "./utils/api";

if (import.meta.env.PROD && typeof console !== "undefined") {
  console.info("[WeCast] Public site:", window.location.origin, "| API:", API_BASE);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
      <App />
  </React.StrictMode>
);
