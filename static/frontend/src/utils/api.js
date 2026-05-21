import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebaseClient";

const DEFAULT_DEV_API_BASE_URL = "http://localhost:5000";
const DEFAULT_PROD_API_BASE_URL = "https://wecast.onrender.com";

/** Static hosts must never be used as API base — /api/* returns empty 200 or HTML. */
const STATIC_FRONTEND_HOSTS = new Set([
  "wecastsa.com",
  "www.wecastsa.com",
  "wecast-frontend.onrender.com",
]);

/** Must match Login.jsx / socialAuth.js storage key. */
const AUTH_TOKEN_KEYS = ["token", "wecastToken", "authToken", "appToken"];

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

/** Persist app JWT where apiFetch can always read it (cross-origin Render API). */
export function storeAuthToken(token) {
  const value = String(token || "").trim();
  if (!value || typeof window === "undefined") return "";
  window.localStorage.setItem("token", value);
  window.sessionStorage.setItem("token", value);
  window.dispatchEvent(
    new StorageEvent("storage", { key: "token", newValue: value })
  );
  return value;
}

function getFirebaseUserForAuthBootstrap() {
  if (auth?.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (user) => {
      if (settled) return;
      settled = true;
      resolve(user || null);
    };
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        finish(user);
      },
      () => {
        unsubscribe();
        finish(null);
      }
    );
    window.setTimeout(() => {
      unsubscribe();
      finish(auth?.currentUser || null);
    }, 2500);
  });
}

async function getFirebaseIdTokenForBootstrap() {
  try {
    const firebaseUser = await getFirebaseUserForAuthBootstrap();
    if (!firebaseUser?.getIdToken) return "";
    return (await firebaseUser.getIdToken(true)) || "";
  } catch {
    return "";
  }
}

async function bootstrapAuthTokenFromSession(force = false) {
  if (typeof window === "undefined") return "";

  const existing = getStoredAuthToken();
  if (existing && !force) return existing;

  if (!authTokenBootstrapPromise || force) {
    authTokenBootstrapPromise = (async () => {
      const firebaseIdToken = await getFirebaseIdTokenForBootstrap();
      const res = await fetch(`${API_BASE}/api/auth/session-token`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "apiFetch",
          idToken: firebaseIdToken || undefined,
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await res.json()
        : {};
      if (res.ok && data?.token) {
        return storeAuthToken(data.token);
      }
      return bootstrapAuthTokenFromFirebase();
    })().finally(() => {
      authTokenBootstrapPromise = null;
    });
  }

  return authTokenBootstrapPromise;
}

async function bootstrapAuthTokenFromFirebase() {
  try {
    const idToken = await getFirebaseIdTokenForBootstrap();
    if (!idToken) return "";

    const res = await fetch(`${API_BASE}/api/firebase-email-login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await res.json()
      : {};
    if (!res.ok || !data?.token) return "";
    return storeAuthToken(data.token);
  } catch {
    return "";
  }
}

/**
 * Ensure a Bearer token exists before cover/finalize/account API calls.
 */
export async function ensureAuthTokenForApi(force = false) {
  const existing = getStoredAuthToken();
  if (existing && !force) return existing;
  return bootstrapAuthTokenFromSession(force);
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

function logApiFetchAuth(url, token) {
  if (typeof console === "undefined") return;
  console.log("[apiFetch auth]", {
    url,
    hasToken: Boolean(token),
    tokenPreview: token ? token.slice(0, 12) : null,
  });
}

function isAuthIdentityMissingError(data, status) {
  if (status !== 401) return false;
  if (!data || typeof data !== "object") return false;
  return (
    data.code === "auth_identity_missing" ||
    String(data.error || "").toLowerCase().includes("log in again")
  );
}

/**
 * Authenticated fetch: credentials (session cookie) + Bearer JWT (cross-origin).
 */
export async function apiFetch(path, options = {}, attempt = 0) {
  const { headers: optionHeaders, body, ...rest } = options;
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;
  const headers = await getAuthHeadersForRequest(optionHeaders || {});
  const token = String(headers.Authorization || "").replace(/^Bearer\s+/i, "");
  const url = `${API_BASE}${path}`;

  if (isFormData) {
    delete headers["Content-Type"];
  }

  logApiFetchAuth(url, token);

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

  if (
    !res.ok &&
    attempt === 0 &&
    isAuthIdentityMissingError(data, res.status)
  ) {
    const refreshed = await bootstrapAuthTokenFromSession(true);
    if (refreshed) {
      return apiFetch(path, options, attempt + 1);
    }
  }

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
