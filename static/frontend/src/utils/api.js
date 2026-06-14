const DEFAULT_DEV_API_BASE_URL = "http://localhost:5000";
const DEFAULT_PROD_API_BASE_URL = "https://wecast.onrender.com";

/** Static hosts must never be used as API base — /api/* returns empty 200 or HTML. */
const STATIC_FRONTEND_HOSTS = new Set([
  "wecastsa.com",
  "www.wecastsa.com",
  "wecast-frontend.onrender.com",
]);

/** App JWT storage key (login + cover/finalize). */
export const AUTH_TOKEN_STORAGE_KEY = "token";

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

/** Read app JWT saved at login. */
export function getStoredAuthToken() {
  if (typeof window === "undefined") return "";
  const sessionToken = (window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim();
  if (sessionToken) return sessionToken;

  const legacyToken = (window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim();
  if (legacyToken) {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, legacyToken);
  }
  return legacyToken;
}

/** Save app JWT after successful login for this browser session only. */
export function storeAuthToken(token) {
  const value = String(token || "").trim();
  if (!value || typeof window === "undefined") return "";
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, value);
  window.dispatchEvent(
    new StorageEvent("storage", { key: AUTH_TOKEN_STORAGE_KEY, newValue: value })
  );
  return value;
}

/** Attach Bearer token when present (cross-origin Render API). */
export function getAuthHeaders(extraHeaders = {}) {
  const headers = { ...(extraHeaders || {}) };
  const token = getStoredAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Authenticated fetch: credentials + Bearer when a session token exists.
 */
export async function apiFetch(path, options = {}) {
  const { headers: optionHeaders, body, ...rest } = options;
  const headers = getAuthHeaders(optionHeaders || {});
  const token = getStoredAuthToken();
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    credentials: "include",
    ...rest,
    body,
    headers,
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const msg =
      (data && data.error) ||
      (typeof data === "string" && !data.trim().startsWith("<")
        ? data
        : "Request failed");
    const err = new Error(msg);
    err.status = res.status;
    err.code = data && data.code;
    err.data = data;
    throw err;
  }

  return data;
}
