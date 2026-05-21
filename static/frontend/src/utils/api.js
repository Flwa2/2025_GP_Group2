const DEFAULT_DEV_API_BASE_URL = "http://localhost:5000";
const DEFAULT_PROD_API_BASE_URL = "https://wecast.onrender.com";

/** Static hosts must never be used as API base — /api/* returns empty 200 or HTML. */
const STATIC_FRONTEND_HOSTS = new Set([
  "wecastsa.com",
  "www.wecastsa.com",
  "wecast-frontend.onrender.com",
]);

function normalizeApiBaseUrl(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function isStaticFrontendHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return STATIC_FRONTEND_HOSTS.has(host);
  } catch {
    return false;
  }
}

function resolveApiBaseUrl() {
  const configured = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  const fallback = import.meta.env.DEV
    ? DEFAULT_DEV_API_BASE_URL
    : DEFAULT_PROD_API_BASE_URL;

  if (!configured) {
    return fallback;
  }

  if (!import.meta.env.DEV && isStaticFrontendHost(configured)) {
    if (typeof console !== "undefined") {
      console.error(
        "[WeCast] VITE_API_BASE_URL points at the static frontend host. API calls must use the Flask backend.",
        { configured, using: fallback }
      );
    }
    return fallback;
  }

  return configured;
}

export const API_BASE = resolveApiBaseUrl();
