// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { API_BASE, getStoredAuthToken, installAuthTokenBootstrap } from "./utils/api";

if (typeof console !== "undefined") {
  console.info("[WeCast] Public site:", window.location.origin, "| API:", API_BASE);
  console.info("[apiFetch auth] startup check", {
    hasToken: Boolean(getStoredAuthToken()),
    tokenPreview: getStoredAuthToken() ? getStoredAuthToken().slice(0, 12) : null,
  });
}

installAuthTokenBootstrap();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
      <App />
  </React.StrictMode>
);
