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

/** Single canonical key — must match Login.jsx storeAuthenticatedSession. */
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

let authTokenBootstrapPromise = null;

/** App JWT from login (required for cross-origin API on wecast.onrender.com). */
export function getStoredAuthToken() {
  if (typeof window === "undefined") return "";
  const fromLocal = (window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim();
  if (fromLocal) return fromLocal;
  return (window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || "").trim();
}

/** Persist app JWT — always localStorage so apiFetch can attach Bearer on wecastsa.com → onrender.com. */
export function storeAuthToken(token) {
  const value = String(token || "").trim();
  if (!value || typeof window === "undefined") return "";
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, value);
  window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, value);
  window.dispatchEvent(
    new StorageEvent("storage", { key: AUTH_TOKEN_STORAGE_KEY, newValue: value })
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
    }, 3000);
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

/**
 * Resolve Bearer token before any authenticated API call.
 */
export async function ensureAuthTokenForApi(force = false) {
  let token = getStoredAuthToken();
  if (token && !force) return token;
  token = await bootstrapAuthTokenFromSession(Boolean(force));
  return token || "";
}

function buildRequestHeaders(extraHeaders = {}, token = "") {
  const headers = new Headers();
  const plain = extraHeaders || {};
  Object.entries(plain).forEach(([key, value]) => {
    if (value != null && value !== "") {
      headers.set(key, String(value));
    }
  });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

/** Merge Authorization Bearer + any extra headers (skip Content-Type for FormData). */
export function getAuthHeaders(extraHeaders = {}) {
  const token = getStoredAuthToken();
  return buildRequestHeaders(extraHeaders, token);
}

function logApiFetchAuth(url, token) {
  if (typeof console === "undefined") return;
  console.log("[apiFetch auth]", {
    url,
    hasToken: Boolean(token),
    tokenPreview: token ? token.slice(0, 12) : null,
    storageKey: AUTH_TOKEN_STORAGE_KEY,
    localStorageHasToken: Boolean(
      typeof window !== "undefined" &&
        window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    ),
  });
}

function isAuthIdentityMissingError(data, status) {
  if (status !== 401) return false;
  if (!data || typeof data !== "object") return false;
  return (
    data.code === "auth_identity_missing" ||
    data.code === "not_logged_in" ||
    String(data.error || "").toLowerCase().includes("log in again") ||
    String(data.error || "").toLowerCase().includes("not logged in")
  );
}

/**
 * Authenticated fetch: credentials + mandatory Bearer JWT (cross-origin Render API).
 * options.auth === false skips Bearer (public endpoints only).
 */
export async function apiFetch(path, options = {}, attempt = 0) {
  const {
    headers: optionHeaders,
    body,
    auth = true,
    ...rest
  } = options;

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  let token = "";
  if (auth) {
    token = getStoredAuthToken();
    if (!token) {
      token = await bootstrapAuthTokenFromSession(attempt > 0);
    }
    if (!token) {
      token = await bootstrapAuthTokenFromFirebase();
    }
    if (!token) {
      const url = `${API_BASE}${path}`;
      logApiFetchAuth(url, "");
      throw new Error("Please log in again.");
    }
  }

  const headers = buildRequestHeaders(optionHeaders || {}, auth ? token : "");
  if (isFormData) {
    headers.delete("Content-Type");
  }

  const url = `${API_BASE}${path}`;
  logApiFetchAuth(url, token);

  const res = await fetch(url, {
    method: rest.method || "GET",
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
    auth &&
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

/** Call once on app load so existing Firebase sessions get localStorage.token before cover/finalize. */
export function installAuthTokenBootstrap() {
  if (typeof window === "undefined" || !auth) return () => {};

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    if (getStoredAuthToken()) return;
    try {
      await ensureAuthTokenForApi(true);
    } catch (err) {
      console.warn("[WeCast] auth token bootstrap failed:", err?.message || err);
    }
  });

  if (getStoredAuthToken()) {
    console.log("[apiFetch auth] startup", {
      hasToken: true,
      tokenPreview: getStoredAuthToken().slice(0, 12),
    });
  }

  return unsubscribe;
}
