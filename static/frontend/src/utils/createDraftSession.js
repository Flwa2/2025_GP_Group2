/**
 * Ephemeral create-wizard state in sessionStorage. Cleared after the user leaves
 * the create journey and stays away longer than CREATE_DRAFT_TIMEOUT_MS.
 *
 * Root cause fixed elsewhere: lease sync must run in App *before* CreatePro renders
 * so useState/readSessionJson does not read stale keys (parent useEffect runs too late).
 */

export const CREATE_DRAFT_LEAVE_AT_KEY = "wecast:createDraftLeaveAt";
export const EDIT_FROM_CREATE_KEY = "wecast:editFromCreate";
export const FINALIZE_FROM_CREATE_KEY = "wecast:createFinalizeJourney";

/** Keys removed by clearCreateFlowSessionStorage (wizard + edit mirrors + handoff). */
export const CREATE_FLOW_SESSION_KEYS = [
  "editData",
  "currentStep",
  "forceStep",
  "guestEditDraft",
  "wecast_preview",
  "preview_from",
  "studioCreateDraft",
  "editScriptStyle",
  "editSpeakersCount",
  "editSpeakers",
  "editDescription",
];

/** Every key touched by stale cleanup (includes internal lease flags). */
export const CREATE_FLOW_ALL_PURGED_KEYS = [
  ...CREATE_FLOW_SESSION_KEYS,
  EDIT_FROM_CREATE_KEY,
  FINALIZE_FROM_CREATE_KEY,
  CREATE_DRAFT_LEAVE_AT_KEY,
];

export const CREATE_DRAFT_TIMEOUT_MS = 20_000;

const DEBUG =
  typeof import.meta !== "undefined" &&
  Boolean(import.meta.env && import.meta.env.DEV);

function devLog(...args) {
  if (DEBUG && typeof console !== "undefined" && console.log) {
    console.log("[create-lease]", ...args);
  }
}

let lastSyncedHash = "";

function isAuthenticated() {
  try {
    return !!(
      window.localStorage?.getItem("token") || window.sessionStorage?.getItem("token")
    );
  } catch {
    return false;
  }
}

/**
 * Same rule as App: the Create wizard mounts only with guest=true or auth.
 * Used to decide whether to purge stale draft when landing on /create.
 */
export function isCreateRouteSurface(hash) {
  const h = String(hash || "");
  if (!h.startsWith("#/create")) return false;
  return h.includes("guest=true") || isAuthenticated();
}

function previewFromParams(hash) {
  const q = String(hash || "").split("?")[1] || "";
  const from = new URLSearchParams(q).get("from") || "";
  if (from) return String(from).trim();
  try {
    return String(window.sessionStorage.getItem("preview_from") || "").trim();
  } catch {
    return "";
  }
}

/**
 * Surfaces where create-wizard sessionStorage should stay alive (no leave timer).
 * Any #/create URL counts so the countdown does not run while the hash is still /create
 * (including bare #/create before guest login, etc.).
 * Preview/finalize/edit count only when opened from the create wizard.
 */
export function isProtectedCreateJourneyHash(hash) {
  const h = String(hash || "");
  if (!h.startsWith("#/")) return false;
  if (h.startsWith("#/create")) return true;
  if (h.startsWith("#/preview")) {
    const from = previewFromParams(h);
    return from === "create" || from === "studio_create";
  }
  if (h.startsWith("#/finalize")) {
    try {
      return window.sessionStorage.getItem(FINALIZE_FROM_CREATE_KEY) === "1";
    } catch {
      return false;
    }
  }
  if (h.startsWith("#/edit")) {
    try {
      return window.sessionStorage.getItem(EDIT_FROM_CREATE_KEY) === "1";
    } catch {
      return false;
    }
  }
  return false;
}

export function markEditNavigationFromCreate() {
  try {
    window.sessionStorage.setItem(EDIT_FROM_CREATE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function markFinalizeNavigationFromCreate() {
  try {
    window.sessionStorage.setItem(FINALIZE_FROM_CREATE_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearCreateFlowSessionStorage() {
  const removed = [];
  try {
    for (const key of CREATE_FLOW_SESSION_KEYS) {
      if (window.sessionStorage.getItem(key) != null) {
        removed.push(key);
      }
      window.sessionStorage.removeItem(key);
    }
    for (const key of [EDIT_FROM_CREATE_KEY, FINALIZE_FROM_CREATE_KEY, CREATE_DRAFT_LEAVE_AT_KEY]) {
      if (window.sessionStorage.getItem(key) != null) {
        removed.push(key);
      }
      window.sessionStorage.removeItem(key);
    }
    devLog("stale cleanup: removed keys:", removed.length ? removed.join(", ") : "(none set)");
  } catch {
    /* ignore */
  }
}

/**
 * Call whenever the route hash changes (App render + CreatePro effects).
 * Sets leave timestamp when exiting the journey; purges wizard storage on stale return to /create.
 */
export function syncCreateDraftLease(hash) {
  if (typeof window === "undefined" || !window.sessionStorage) return;

  const h = String(hash || "");
  const prev = lastSyncedHash;
  const protectedBefore = prev ? isProtectedCreateJourneyHash(prev) : false;
  const protectedNow = isProtectedCreateJourneyHash(h);

  if (protectedNow) {
    if (h.startsWith("#/create") && isCreateRouteSurface(h)) {
      const leaveRaw = window.sessionStorage.getItem(CREATE_DRAFT_LEAVE_AT_KEY);
      const leaveAt = leaveRaw ? Number(leaveRaw) : 0;
      const elapsed = leaveAt && Number.isFinite(leaveAt) ? Date.now() - leaveAt : 0;
      if (leaveAt && Number.isFinite(leaveAt) && elapsed > CREATE_DRAFT_TIMEOUT_MS) {
        devLog(
          "stale return to create: purging (leaveAt ms ago=",
          Math.round(elapsed),
          "threshold=",
          CREATE_DRAFT_TIMEOUT_MS,
          ")"
        );
        clearCreateFlowSessionStorage();
      }
    }
    try {
      window.sessionStorage.removeItem(CREATE_DRAFT_LEAVE_AT_KEY);
    } catch {
      /* ignore */
    }
    lastSyncedHash = h;
    return;
  }

  if (protectedBefore) {
    try {
      const ts = Date.now();
      window.sessionStorage.setItem(CREATE_DRAFT_LEAVE_AT_KEY, String(ts));
      devLog("leave journey → set leave timestamp", ts, "from", prev, "to", h);
    } catch {
      /* ignore */
    }
  }

  if (prev.startsWith("#/edit") && !h.startsWith("#/edit")) {
    try {
      window.sessionStorage.removeItem(EDIT_FROM_CREATE_KEY);
    } catch {
      /* ignore */
    }
  }
  if (prev.startsWith("#/finalize") && !h.startsWith("#/finalize")) {
    try {
      window.sessionStorage.removeItem(FINALIZE_FROM_CREATE_KEY);
    } catch {
      /* ignore */
    }
  }

  lastSyncedHash = h;
}
