const AUTH_REDIRECT_KEY = "wecast:authRedirect";
const PENDING_PREVIEW_SAVE_KEY = "wecast:pendingPreviewSave";
const PENDING_PREVIEW_DRAFT_KEY = "wecast:pendingPreviewDraft";

function getStorage(kind) {
  if (typeof window === "undefined") return null;
  return kind === "local" ? window.localStorage : window.sessionStorage;
}

function readStorageValue(key, preferLocal = false) {
  const storages = preferLocal ? ["local", "session"] : ["session", "local"];
  for (const kind of storages) {
    const storage = getStorage(kind);
    if (!storage) continue;
    try {
      const value = storage.getItem(key);
      if (value) return value;
    } catch {
      // Ignore unavailable storage and continue with the next fallback.
    }
  }
  return "";
}

function writeStorageValue(key, value, localOnly = false) {
  const kinds = localOnly ? ["local"] : ["session", "local"];
  for (const kind of kinds) {
    const storage = getStorage(kind);
    if (!storage) continue;
    try {
      storage.setItem(key, value);
    } catch {
      // Ignore unavailable storage and continue with the next fallback.
    }
  }
}

function removeStorageValue(key, localOnly = false) {
  const kinds = localOnly ? ["local"] : ["session", "local"];
  for (const kind of kinds) {
    const storage = getStorage(kind);
    if (!storage) continue;
    try {
      storage.removeItem(key);
    } catch {
      // Ignore unavailable storage and continue with the next fallback.
    }
  }
}

function parseStoredJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function readHashRedirectParams(hash = "") {
  const resolvedHash =
    hash || (typeof window !== "undefined" ? window.location.hash || "" : "");
  const qs = resolvedHash.includes("?") ? resolvedHash.split("?")[1] : "";
  const params = new URLSearchParams(qs);
  return {
    redirect: params.get("redirect") || "",
    id: params.get("id") || "",
    from: params.get("from") || "",
  };
}

export function storeAuthRedirectIntent(intent = {}) {
  const payload = {
    redirect: intent.redirect || "",
    id: intent.id || "",
    from: intent.from || "",
  };
  if (!payload.redirect) return;
  writeStorageValue(AUTH_REDIRECT_KEY, JSON.stringify(payload));
}

export function getAuthRedirectIntent() {
  const hashIntent = readHashRedirectParams();
  if (hashIntent.redirect) {
    storeAuthRedirectIntent(hashIntent);
    return hashIntent;
  }

  return (
    parseStoredJson(readStorageValue(AUTH_REDIRECT_KEY)) || {
      redirect: "",
      id: "",
      from: "",
    }
  );
}

export function clearAuthRedirectIntent() {
  removeStorageValue(AUTH_REDIRECT_KEY);
}

export function queuePendingPreviewSave(intent = {}) {
  writeStorageValue(
    PENDING_PREVIEW_SAVE_KEY,
    JSON.stringify({
      id: intent.id || "",
      from: intent.from || "",
      requestedAt: intent.requestedAt || Date.now(),
    })
  );
}

export function getPendingPreviewSave() {
  return parseStoredJson(readStorageValue(PENDING_PREVIEW_SAVE_KEY)) || null;
}

export function clearPendingPreviewSave() {
  removeStorageValue(PENDING_PREVIEW_SAVE_KEY);
}

export function storePendingPreviewDraft(draft = {}) {
  writeStorageValue(
    PENDING_PREVIEW_DRAFT_KEY,
    JSON.stringify(draft),
    true
  );
}

export function getPendingPreviewDraft() {
  return parseStoredJson(readStorageValue(PENDING_PREVIEW_DRAFT_KEY, true));
}

export function clearPendingPreviewDraft() {
  removeStorageValue(PENDING_PREVIEW_DRAFT_KEY, true);
}

export function isUserAuthenticated() {
  if (typeof window === "undefined") return false;
  try {
    return !!(localStorage.getItem("token") || sessionStorage.getItem("token"));
  } catch {
    return false;
  }
}

/** Build login/signup hash preserving ?redirect=… query params from the current URL. */
export function preserveRedirectQueryForRoute(route = "login") {
  const { redirect, id, from } = readHashRedirectParams();
  if (!redirect) return `#/${route}`;
  const qs = new URLSearchParams({ redirect });
  if (id) qs.set("id", id);
  if (from) qs.set("from", from);
  return `#/${route}?${qs.toString()}`;
}

export function resolvePostAuthRedirectHash({ redirect = "", id = "", from = "" } = {}) {
  if (redirect === "edit") return "#/edit";
  if (redirect === "create") return "#/create";
  if (redirect === "episodes") return "#/episodes";
  if (redirect === "preview") {
    const fromSuffix = from ? `&from=${encodeURIComponent(from)}` : "";
    if (id) return `#/preview?id=${encodeURIComponent(id)}${fromSuffix}`;
    return from ? `#/preview?from=${encodeURIComponent(from)}` : "#/preview";
  }
  return "#/";
}

export function redirectAfterAuth() {
  const intent = getAuthRedirectIntent();
  clearAuthRedirectIntent();
  window.location.hash = resolvePostAuthRedirectHash(intent);
}

/** Guest-safe navigation to Cast Studio (Episodes library). */
export function navigateToCastStudio() {
  if (isUserAuthenticated()) {
    window.location.hash = "#/episodes";
    return;
  }
  storeAuthRedirectIntent({ redirect: "episodes" });
  window.location.hash = "#/login?redirect=episodes";
}

/**
 * Returns true when Cast Studio may render; otherwise redirects guest to login.
 */
export function guardCastStudioRoute() {
  if (isUserAuthenticated()) return true;
  storeAuthRedirectIntent({ redirect: "episodes" });
  window.location.hash = "#/login?redirect=episodes";
  return false;
}
