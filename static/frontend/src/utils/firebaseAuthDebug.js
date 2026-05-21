/** Debug helpers for Firebase Auth sign-in / reset (temporary diagnostics). */

export function maskEmail(email) {
  const value = String(email || "").trim().toLowerCase();
  if (!value || !value.includes("@")) return value || "<none>";
  const [local, domain] = value.split("@");
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export function formatFirebaseAuthError(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").trim();
  const customData = error?.customData || {};
  const serverResponse = customData?._serverResponse || {};

  return {
    code,
    message,
    email: serverResponse?.email || customData?.email || "",
    serverErrorMessage: serverResponse?.error?.message || serverResponse?.message || "",
    serverErrorCode: serverResponse?.error?.code || "",
    customDataKeys: Object.keys(customData || {}),
  };
}

export function logFirebaseAuthAttempt(label, details = {}) {
  if (typeof console === "undefined" || typeof console.debug !== "function") return;
  console.debug(`[WeCast auth] ${label}`, details);
}

/** Firebase ID tokens are JWTs: header.payload.signature (three base64url segments). */
export function isPlausibleFirebaseIdToken(token) {
  const value = String(token || "").trim();
  if (!value || value === "invalid" || value === "undefined" || value === "null") {
    return false;
  }
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  return parts.every((part) => part.length > 0);
}

export async function readApiJsonResponse(response) {
  const contentType = String(response?.headers?.get?.("content-type") || "").toLowerCase();
  const rawText = await response.text();
  let data = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = {};
    }
  }
  return {
    data,
    rawText,
    contentType,
    parsed: rawText ? Object.keys(data).length > 0 : false,
  };
}

export function hasValidLoginSessionPayload(data) {
  const payload = data || {};
  return Boolean(payload.token && payload.user);
}

export function describeFirebaseIdToken(token) {
  const value = String(token || "").trim();
  const parts = value.split(".");
  return {
    tokenLength: value.length,
    segmentCount: parts.length,
    looksLikeJwt: isPlausibleFirebaseIdToken(value),
    tokenPreview: value ? `${value.slice(0, 12)}...` : "<empty>",
  };
}

export function userMessageForFirebaseAuthError(error) {
  const info = formatFirebaseAuthError(error);
  const code = info.code.toLowerCase();
  const serverMsg = String(info.serverErrorMessage || "").trim();

  if (code === "auth/invalid-email") {
    return "Enter a valid email address and try again.";
  }
  if (code === "auth/user-disabled") {
    return "This account is disabled. Contact support if you need access restored.";
  }
  if (code === "auth/too-many-requests") {
    return "Too many sign-in attempts. Wait a moment, then try again.";
  }
  if (code === "auth/operation-not-allowed") {
    return "Email/password login is disabled in Firebase. Enable Email/Password in Firebase Authentication.";
  }
  if (code === "auth/unauthorized-domain") {
    return "wecastsa.com is not authorized in Firebase yet. Add it under Authentication → Settings → Authorized domains.";
  }
  if (code === "auth/invalid-api-key" || code === "auth/app-not-authorized") {
    return "Firebase is misconfigured for this site (API key or authorized domain).";
  }
  if (code === "auth/network-request-failed") {
    return "Could not reach Firebase. Check your connection and try again.";
  }
  if (
    code === "auth/wrong-password" ||
    code === "auth/invalid-credential" ||
    code === "auth/invalid-login-credentials" ||
    code === "auth/user-not-found"
  ) {
    if (serverMsg.includes("INVALID_LOGIN_CREDENTIALS") || serverMsg.includes("INVALID_PASSWORD")) {
      return "Email or password is incorrect. If you just reset your password, use the new password and the same email from the reset email.";
    }
    return "Email or password is incorrect. If you recently reset your password, use the new password.";
  }
  if (info.message) return info.message;
  return "Firebase sign-in failed. Check the browser console for details.";
}
