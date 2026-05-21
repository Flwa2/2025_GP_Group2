import {
  browserLocalPersistence,
  browserSessionPersistence,
  getRedirectResult,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";

import { ensureFirebaseClientReady } from "../firebaseClient";
import { API_BASE } from "./api";
import {
  describeFirebaseIdToken,
  isPlausibleFirebaseIdToken,
  logFirebaseAuthAttempt,
} from "./firebaseAuthDebug";

function storeAuthSession({ token, user, remember = true }) {
  const tokenStorage = remember ? localStorage : sessionStorage;
  const otherTokenStorage = remember ? sessionStorage : localStorage;

  tokenStorage.setItem("token", token);
  otherTokenStorage.removeItem("token");

  const serializedUser = JSON.stringify(user);
  tokenStorage.setItem("user", serializedUser);
  otherTokenStorage.removeItem("user");

  window.dispatchEvent(
    new StorageEvent("storage", { key: "token", newValue: token })
  );
}

function mapFirebaseAuthError(error, providerLabel) {
  const code = error?.code || "";
  const currentHost =
    typeof window !== "undefined" ? window.location.hostname : "this domain";

  if (code === "auth/popup-blocked") {
    return `${providerLabel} login popup was blocked. We'll try a full-page redirect instead.`;
  }
  if (code === "auth/popup-closed-by-user") {
    return `${providerLabel} login popup was closed before finishing. Please try again.`;
  }
  if (code === "auth/cancelled-popup-request") {
    return `Another ${providerLabel} login is already in progress.`;
  }
  if (code === "auth/account-exists-with-different-credential") {
    return "An account already exists with the same email using a different sign-in method.";
  }
  if (code === "auth/unauthorized-domain") {
    return `Firebase Authentication blocked ${currentHost}. This must be fixed in Firebase Console, not in app code. Add ${currentHost} to Firebase Auth > Settings > Authorized domains, then try ${providerLabel} again.`;
  }
  if (code === "auth/operation-not-allowed") {
    return `${providerLabel} sign-in is not enabled in Firebase Authentication. Enable the ${providerLabel} provider in Firebase Auth first.`;
  }
  if (code === "auth/app-not-authorized" || code === "auth/invalid-api-key") {
    return `Firebase Authentication is not configured correctly for ${providerLabel}. Check the Firebase web app config and authorized domains, then try again.`;
  }
  if (code === "auth/network-request-failed") {
    return `We couldn't reach Firebase while starting ${providerLabel} sign-in. Check your connection and try again.`;
  }

  return error?.message || `${providerLabel} login failed. Please try again.`;
}

function providerLabelFromId(providerId) {
  const raw = String(providerId || "").trim().toLowerCase();
  if (raw.includes("github")) {
    return "GitHub";
  }
  if (raw.includes("google")) {
    return "Google";
  }
  return "OAuth";
}

const PENDING_SOCIAL_REDIRECT_KEY = "wecast:pendingSocialRedirect";

async function exchangeFirebaseUser({
  user,
  providerLabel,
  remember,
}) {
  const firebaseIdToken = await user.getIdToken(true);
  const tokenDiagnostics = describeFirebaseIdToken(firebaseIdToken);
  logFirebaseAuthAttempt("social-login getIdToken result", {
    providerLabel,
    uid: user?.uid || "",
    ...tokenDiagnostics,
  });

  if (!isPlausibleFirebaseIdToken(firebaseIdToken)) {
    throw new Error(
      `${providerLabel} sign-in did not produce a valid Firebase JWT. Hard refresh and try again.`
    );
  }

  const res = await fetch(`${API_BASE}/api/social-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      idToken: firebaseIdToken,
      email: user.email || "",
      name: user.displayName || "",
    }),
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    console.debug("[WeCast auth] social-login failed", {
      status: res.status,
      contentType,
      providerLabel,
      error: data?.error || data?.message,
      code: data?.code,
    });
    throw new Error(
      data?.message ||
        data?.error ||
        `${providerLabel} login failed (server ${res.status}).`
    );
  }

  if (!data.token || !data.user) {
    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    console.debug("[WeCast auth] social-login invalid payload", {
      status: res.status,
      contentType,
      providerLabel,
      hasToken: Boolean(data.token),
      hasUser: Boolean(data.user),
      keys: Object.keys(data || {}),
    });
    throw new Error(
      `The server did not return a valid ${providerLabel} sign-in (missing token or user). ` +
        "Check Render backend Firebase Admin credentials and CORS."
    );
  }

  storeAuthSession({ token: data.token, user: data.user, remember });
  sessionStorage.removeItem(PENDING_SOCIAL_REDIRECT_KEY);
}

async function setAuthPersistence(auth, remember) {
  const persistence = remember
    ? browserLocalPersistence
    : browserSessionPersistence;

  await setPersistence(auth, persistence);
}

export function hasPendingSocialRedirect() {
  return sessionStorage.getItem(PENDING_SOCIAL_REDIRECT_KEY) === "1";
}

export async function completePendingSocialRedirect({
  auth,
  remember = true,
}) {
  if (!hasPendingSocialRedirect()) {
    return false;
  }

  ensureFirebaseClientReady();
  await setAuthPersistence(auth, remember);
  let result;
  try {
    result = await getRedirectResult(auth);
  } catch (error) {
    throw new Error(
      mapFirebaseAuthError(
        error,
        providerLabelFromId(error?.customData?.providerId)
      )
    );
  }

  if (!result?.user) {
    sessionStorage.removeItem(PENDING_SOCIAL_REDIRECT_KEY);
    return false;
  }

  const providerId =
    result.providerId || result.user.providerData?.[0]?.providerId || "OAuth";
  const providerLabel = providerLabelFromId(providerId);
  await exchangeFirebaseUser({
    user: result.user,
    providerLabel,
    remember,
  });
  return true;
}

export async function authenticateWithSocialProvider({
  auth,
  provider,
  providerLabel,
  remember = true,
}) {
  ensureFirebaseClientReady();
  await setAuthPersistence(auth, remember);

  try {
    const result = await signInWithPopup(auth, provider);
    await exchangeFirebaseUser({
      user: result.user,
      providerLabel,
      remember,
    });
    return { redirected: false };
  } catch (error) {
    if (error?.code === "auth/popup-blocked") {
      sessionStorage.setItem(PENDING_SOCIAL_REDIRECT_KEY, "1");
      await signInWithRedirect(auth, provider);
      return { redirected: true };
    }

    throw new Error(mapFirebaseAuthError(error, providerLabel));
  }
}
