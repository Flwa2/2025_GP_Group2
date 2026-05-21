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

const AUTH_TOKEN_KEYS = ["token", "wecastToken", "authToken", "appToken"];
let authTokenBootstrapPromise = null;

/** App JWT from email/social login (required for cross-origin API on wecast.onrender.com). */
export function getStoredAuthToken() {
  if (typeof window === "undefined") return "";
  for (const key of AUTH_TOKEN_KEYS) {
    const value = (
      window.localStorage.getItem(key) ||
      window.sessionStorage.getItem(key) ||
      ""
    ).trim();
    if (value) return value;
  }
  return "";
}

function storeAuthToken(token) {
  const value = String(token || "").trim();
  if (!value || typeof window === "undefined") return "";
  window.localStorage.setItem("token", value);
  window.sessionStorage.removeItem("token");
  return value;
}

async function bootstrapAuthTokenFromSession() {
  if (typeof window === "undefined") return "";

  const existing = getStoredAuthToken();
  if (existing) return existing;

  if (!authTokenBootstrapPromise) {
    authTokenBootstrapPromise = fetch(`${API_BASE}/api/auth/session-token`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "apiFetch" }),
    })
      .then(async (res) => {
        const contentType = res.headers.get("content-type") || "";
        const data = contentType.includes("application/json")
          ? await res.json()
          : {};
        if (!res.ok || !data?.token) return "";
        return storeAuthToken(data.token);
      })
      .catch(() => "")
      .finally(() => {
        authTokenBootstrapPromise = null;
      });
  }

  return authTokenBootstrapPromise;
}

/** Merge Authorization Bearer + any extra headers (skip Content-Type for FormData). */
export function getAuthHeaders(extraHeaders = {}) {
  const headers = { ...(extraHeaders || {}) };
  const token = getStoredAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function getAuthHeadersForRequest(extraHeaders = {}) {
  let headers = getAuthHeaders(extraHeaders);
  if (!headers.Authorization) {
    const token = await bootstrapAuthTokenFromSession();
    if (token) {
      headers = { ...(extraHeaders || {}), Authorization: `Bearer ${token}` };
    }
  }
  return headers;
}

/**
 * Authenticated fetch: credentials (session cookie) + Bearer JWT (cross-origin).
 */
export async function apiFetch(path, options = {}) {
  const { headers: optionHeaders, body, ...rest } = options;
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;
  const headers = await getAuthHeadersForRequest(optionHeaders || {});

  if (isFormData) {
    delete headers["Content-Type"];
  }

  const res = await fetch(`${API_BASE}${path}`, {
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
    throw new Error(msg);
  }

  return data;
}
