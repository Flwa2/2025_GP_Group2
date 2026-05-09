import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  MailCheck,
} from "lucide-react";
import {
  applyActionCode,
  confirmPasswordReset,
  signOut,
  verifyPasswordResetCode,
} from "firebase/auth";
import { useTranslation } from "react-i18next";
import { auth } from "../firebaseClient";
import { API_BASE } from "../utils/api";

const REMEMBERED_LOGIN_KEY = "rememberedLoginIdentifier";

function readEffectiveActionHash() {
  const hash = window.location.hash || "";
  if (hash) return hash;
  const path = window.location.pathname || "";
  const search = window.location.search || "";
  if (path === "/reset-password") return `#/reset-password${search}`;
  if (path === "/verify-email") return `#/verify-email${search}`;
  if (path === "/email-change-confirm") return `#/email-change-confirm${search}`;
  return "";
}

function decodeHashBody(rawHash) {
  const body = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
  try {
    return decodeURIComponent(body.replace(/\+/g, " "));
  } catch {
    return body;
  }
}

function pickQueryFromDecoded(decoded) {
  const queryIndex = decoded.indexOf("?");
  return queryIndex >= 0 ? decoded.slice(queryIndex + 1) : "";
}

function extractParamLoose(decoded, name) {
  const re = new RegExp(`(?:^|[?&])${name}=([^&]*)`);
  const m = decoded.match(re);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
  } catch {
    return (m[1] || "").trim();
  }
}

function readHashParams() {
  const effective = readEffectiveActionHash();
  const decoded = decodeHashBody(effective);
  const search = pickQueryFromDecoded(decoded);
  const params = new URLSearchParams(search);
  const looseMode = extractParamLoose(decoded, "mode");
  const looseToken = extractParamLoose(decoded, "token");
  if (looseMode && !params.get("mode")) params.set("mode", looseMode);
  if (looseToken && !params.get("token")) params.set("token", looseToken);
  return params;
}

function readSearchParams() {
  return new URLSearchParams(window.location.search || "");
}

function readActionParams() {
  const hashParams = readHashParams();
  const searchParams = readSearchParams();
  const merged = new URLSearchParams(searchParams.toString());
  hashParams.forEach((value, key) => {
    if (value != null && value !== "") {
      merged.set(key, value);
    }
  });
  return merged;
}

function readHashPath() {
  const effective = readEffectiveActionHash();
  const decoded = decodeHashBody(effective);
  const queryIndex = decoded.indexOf("?");
  const pathPart = queryIndex >= 0 ? decoded.slice(0, queryIndex) : decoded;
  if (!pathPart) return "";
  const withHash = pathPart.startsWith("#") ? pathPart : `#${pathPart}`;
  return withHash.startsWith("#/") ? withHash : `#/${withHash.replace(/^#/, "")}`;
}

function clearStoredAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  window.dispatchEvent(
    new StorageEvent("storage", { key: "token", newValue: "" })
  );
}

export default function EmailAction() {
  const { t, i18n } = useTranslation();
  const params = readActionParams();
  const hashPath = readHashPath();
  const pathName = window.location.pathname || "";
  const mode = String(params.get("mode") || "")
    .trim()
    .toLowerCase();
  const token = String(params.get("token") || "").trim();
  const oobCode = params.get("oobCode") || "";
  const apiKey = params.get("apiKey") || "";
  const continueUrl = params.get("continueUrl") || "";
  const isFirebaseVerifyMode =
    hashPath === "#/verify-email" ||
    pathName === "/verify-email" ||
    mode === "verifyemail";
  const isFirebaseResetMode =
    hashPath === "#/reset-password" ||
    pathName === "/reset-password" ||
    mode === "resetpassword";
  const isTokenVerifyMode = mode === "verify-email";
  const isTokenResetMode = mode === "reset-password";
  const isResetMode = isTokenResetMode || isFirebaseResetMode;
  const isVerifyMode = isTokenVerifyMode || isFirebaseVerifyMode;
  const isChangeEmailMode = mode === "change-email";
  const isCancelEmailChangeMode = mode === "cancel-email-change";
  const onEmailChangeConfirmPath =
    hashPath === "#/email-change-confirm" || pathName === "/email-change-confirm";
  const supportsContinueUrl = Boolean(continueUrl);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [details, setDetails] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isRtl = String(i18n.language || "").startsWith("ar");
  const passwordRuleMessage = t(
    "reset.passwordHint",
    "At least 8 characters, including one uppercase letter, one number, and one symbol."
  );

  const hasPasswordMinLength = useMemo(
    () => (newPassword || "").length >= 8,
    [newPassword]
  );
  const hasPasswordUppercase = useMemo(
    () => /[A-Z]/.test(newPassword || ""),
    [newPassword]
  );
  const hasPasswordNumber = useMemo(() => /\d/.test(newPassword || ""), [newPassword]);
  const hasPasswordSymbol = useMemo(
    () => /[^A-Za-z0-9]/.test(newPassword || ""),
    [newPassword]
  );

  useEffect(() => {
    let cancelled = false;

    async function validateAction() {
      if (isFirebaseVerifyMode) {
        if (!oobCode) {
          setError(
            t(
              "emailAction.verify.missingCode",
              "This verification link is incomplete or no longer valid."
            )
          );
          setLoading(false);
          return;
        }

        setLoading(true);
        setError("");
        setSuccess("");

        try {
          await applyActionCode(auth, oobCode);
          if (!cancelled) {
            sessionStorage.removeItem("wecast:pendingVerificationEmail");
            setSuccess(
              t(
                "emailAction.verify.success",
                "Your email has been verified. You can sign in now."
              )
            );
          }
        } catch (err) {
          if (!cancelled) {
            setError(
              err?.message ||
                t(
                  "emailAction.verify.invalid",
                  "This verification link is invalid or has expired."
                )
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
        return;
      }

      if (isFirebaseResetMode) {
        if (!oobCode) {
          setError(
            t(
              "emailAction.reset.missingCode",
              "This password reset link is incomplete or no longer valid."
            )
          );
          setLoading(false);
          return;
        }

        setLoading(true);
        setError("");
        setSuccess("");

        try {
          const email = await verifyPasswordResetCode(auth, oobCode);
          if (!cancelled) {
            setDetails({ email });
          }
        } catch (err) {
          if (!cancelled) {
            setError(
              err?.message ||
                t(
                  "emailAction.reset.invalid",
                  "This password reset link is invalid or has expired."
                )
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
        return;
      }

      const hasRecognizedTokenMode =
        isTokenVerifyMode ||
        isTokenResetMode ||
        isChangeEmailMode ||
        isCancelEmailChangeMode;
      if (!token) {
        setError(
          t(
            "emailAction.general.invalid",
            "This action link is incomplete or no longer valid."
          )
        );
        setLoading(false);
        return;
      }
      if (!hasRecognizedTokenMode) {
        if (onEmailChangeConfirmPath) {
          setError(
            t(
              "emailAction.general.expired",
              "This link is invalid or has already expired."
            )
          );
        } else {
          setError(
            t(
              "emailAction.general.invalid",
              "This action link is incomplete or no longer valid."
            )
          );
        }
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setSuccess("");

      try {
        if (isTokenVerifyMode) {
          const res = await fetch(`${API_BASE}/api/email-verification/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ token }),
          });
          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            throw new Error(
              data?.error ||
                t(
                  "emailAction.verify.invalid",
                  "This verification link is invalid or has expired."
                )
            );
          }

          if (!cancelled) {
            setDetails(data);
            sessionStorage.removeItem("wecast:pendingVerificationEmail");
            setSuccess(
              t(
                "emailAction.verify.success",
                "Your email has been verified. You can sign in now."
              )
            );
          }
          return;
        }

        if (isCancelEmailChangeMode) {
          const res = await fetch(`${API_BASE}/api/account/email-change/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ token }),
          });
          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            throw new Error(
              data?.error ||
                t(
                  "emailAction.emailChange.cancelFailed",
                  "We couldn't cancel this email change request."
                )
            );
          }

          if (!cancelled) {
            setDetails(data);
            setSuccess(
              t(
                "emailAction.emailChange.cancelSuccess",
                "Email change request canceled. Your current email was not changed."
              )
            );
          }
          return;
        }

        const endpoint = isTokenResetMode
          ? "/api/password-reset/validate"
          : "/api/account/email-change/validate";

        const res = await fetch(`${API_BASE}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data?.error ||
              t(
                "emailAction.general.expired",
                "This link is invalid or has already expired."
              )
          );
        }

        if (!cancelled) {
          setDetails(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.message ||
              t(
                "emailAction.general.expired",
                "This link is invalid or has already expired."
              )
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    validateAction();
    return () => {
      cancelled = true;
    };
  }, [
    t,
    isChangeEmailMode,
    isCancelEmailChangeMode,
    isFirebaseResetMode,
    isFirebaseVerifyMode,
    isTokenVerifyMode,
    isTokenResetMode,
    onEmailChangeConfirmPath,
    oobCode,
    token,
  ]);

  async function handleResetSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setFieldErrors({ newPassword: "", confirmPassword: "" });

    if (!newPassword || !confirmPassword) {
      const nextFieldErrors = {
        newPassword: newPassword
          ? ""
          : t("emailAction.reset.requiredNewPassword", "Enter your new password."),
        confirmPassword: confirmPassword
          ? ""
          : t(
              "emailAction.reset.requiredConfirmPassword",
              "Confirm your new password."
            ),
      };
      setFieldErrors(nextFieldErrors);
      return;
    }

    const passwordErrors = { newPassword: "", confirmPassword: "" };
    if (!hasPasswordMinLength) {
      passwordErrors.newPassword = t(
        "emailAction.reset.minLength",
        "Password must be at least 8 characters long."
      );
    } else if (!hasPasswordUppercase || !hasPasswordNumber || !hasPasswordSymbol) {
      passwordErrors.newPassword = passwordRuleMessage;
    }
    if (newPassword !== confirmPassword) {
      passwordErrors.confirmPassword = t(
        "emailAction.reset.mismatch",
        "Passwords do not match."
      );
    }
    if (passwordErrors.newPassword || passwordErrors.confirmPassword) {
      setFieldErrors(passwordErrors);
      return;
    }

    setSubmitting(true);
    try {
      let resolvedEmail = details?.email || "";
      if (isFirebaseResetMode) {
        await confirmPasswordReset(auth, oobCode, newPassword);
      } else {
        const res = await fetch(`${API_BASE}/api/password-reset/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            token,
            newPassword,
            confirmPassword,
          }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data?.error ||
              t(
                "emailAction.reset.updateFailed",
                "We couldn't update your password from this link."
              )
          );
        }

        resolvedEmail = data?.email || resolvedEmail;
      }

      if (resolvedEmail) {
        localStorage.setItem(REMEMBERED_LOGIN_KEY, resolvedEmail);
      }
      setSuccess(
        t(
          "emailAction.reset.success",
          "Your password has been updated. You can sign in now."
        )
      );
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err?.message ||
          t(
            "emailAction.reset.updateFailed",
            "We couldn't update your password from this link."
          )
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEmailChangeConfirm() {
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/confirm-email-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error ||
            t(
              "emailAction.emailChange.failed",
              "We couldn't confirm your new email right now."
            )
        );
      }

      await signOut(auth).catch(() => {});
      clearStoredAuth();

      const resolvedEmail = data?.newEmail || details?.newEmail || "";
      if (resolvedEmail) {
        localStorage.setItem(REMEMBERED_LOGIN_KEY, resolvedEmail);
      }

      setSuccess(
        t(
          "emailAction.emailChange.success",
          "Your email has been updated. Sign in again with the new address."
        )
      );
    } catch (err) {
      setError(
        err?.message ||
          t(
            "emailAction.emailChange.failed",
            "We couldn't confirm your new email right now."
          )
      );
    } finally {
      setSubmitting(false);
    }
  }

  const title = isResetMode
    ? t("reset.title", "Reset your password")
    : isVerifyMode
      ? t("emailAction.verify.title", "Verify your email")
      : isCancelEmailChangeMode
      ? t("emailAction.emailChange.cancelTitle", "Cancel email change")
      : isChangeEmailMode
      ? t("emailAction.emailChange.title", "Confirm your new email")
      : t("emailAction.general.title", "Email action");

  const subtitle = isResetMode
    ? t(
        "emailAction.reset.subtitle",
        "Choose a new password for your WeCast account."
      )
    : isVerifyMode
      ? t(
          "emailAction.verify.subtitle",
          "Confirm this address for your WeCast account."
        )
      : isCancelEmailChangeMode
      ? t(
          "emailAction.emailChange.cancelSubtitle",
          "Cancel the pending email change request on your WeCast profile."
        )
      : isChangeEmailMode
      ? t(
          "emailAction.emailChange.confirmSubtitle",
          "Confirm the new address to finish updating your WeCast profile."
        )
      : t(
          "emailAction.emailChange.subtitle",
          "Finish updating the email address on your WeCast profile."
        );

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="ui-card">
        <div className="mb-6 flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-black text-white dark:bg-white dark:text-black">
            {isResetMode ? (
              <KeyRound className="h-6 w-6" />
            ) : (
              <MailCheck className="h-6 w-6" />
            )}
          </div>
          <div>
            <h1 className="ui-card-title !mb-1">{title}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {subtitle}
            </p>
            {isResetMode && (apiKey || supportsContinueUrl) ? (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400" dir="auto">
                {supportsContinueUrl
                  ? t(
                      "emailAction.reset.continueReady",
                      "You can continue to your destination after signing in."
                    )
                  : t(
                      "emailAction.reset.secureLink",
                      "This is a secure WeCast password reset link."
                    )}
              </p>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-4 py-4 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
            <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
            {t("emailAction.general.checking", "Checking your secure link...")}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-950/20 dark:text-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {t("emailAction.general.unusableTitle", "This link cannot be used.")}
                </p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          </div>
        ) : success ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {t("emailAction.general.completedTitle", "Action completed")}
                  </p>
                  <p className="mt-1">{success}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  window.location.hash = "#/login";
                }}
                className="inline-flex items-center justify-center rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
              >
                {t("reset.back", "Go to login")}
              </button>
              {supportsContinueUrl ? (
                <a
                  href={continueUrl}
                  className="inline-flex items-center justify-center rounded-xl border border-black/15 px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/5 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
                >
                  {t("emailAction.general.continue", "Continue")}
                </a>
              ) : null}
            </div>
          </div>
        ) : isResetMode ? (
          <form className="space-y-5" onSubmit={handleResetSubmit}>
            <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t("emailAction.reset.forLabel", "Resetting password for")}
              </p>
              <p className="mt-1 text-base font-semibold text-black dark:text-white">
                {details?.email || t("emailAction.reset.yourAccount", "your account")}
              </p>
            </div>

            <label className="flex flex-col gap-2">
              <span className="form-label">{t("reset.newPassword", "New password")}</span>
              <div className="relative">
                <input
                  className={`form-input ${isRtl ? "pl-4 pr-10" : "pl-4 pr-10"}`}
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value);
                    setFieldErrors((current) => ({ ...current, newPassword: "" }));
                  }}
                  placeholder={t(
                    "emailAction.reset.newPasswordPlaceholder",
                    "Enter a new password"
                  )}
                  disabled={submitting}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((value) => !value)}
                  className={`absolute top-1/2 -translate-y-1/2 text-neutral-500 transition hover:text-black dark:text-neutral-400 dark:hover:text-white ${
                    isRtl ? "left-3" : "right-3"
                  }`}
                  aria-label={
                    showNewPassword
                      ? t("login.hide", "Hide")
                      : t("login.show", "Show")
                  }
                >
                  {showNewPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <span className="form-help">
                {passwordRuleMessage}
              </span>
              {fieldErrors.newPassword ? (
                <p className="text-sm font-medium text-red-600" dir="auto">
                  {fieldErrors.newPassword}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="form-label">
                {t("reset.confirmPassword", "Confirm new password")}
              </span>
              <div className="relative">
                <input
                  className={`form-input ${isRtl ? "pl-4 pr-10" : "pl-4 pr-10"}`}
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setFieldErrors((current) => ({ ...current, confirmPassword: "" }));
                  }}
                  placeholder={t(
                    "emailAction.reset.confirmPasswordPlaceholder",
                    "Re-enter your new password"
                  )}
                  disabled={submitting}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className={`absolute top-1/2 -translate-y-1/2 text-neutral-500 transition hover:text-black dark:text-neutral-400 dark:hover:text-white ${
                    isRtl ? "left-3" : "right-3"
                  }`}
                  aria-label={
                    showConfirmPassword
                      ? t("login.hide", "Hide")
                      : t("login.show", "Show")
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {fieldErrors.confirmPassword ? (
                <p className="text-sm font-medium text-red-600" dir="auto">
                  {fieldErrors.confirmPassword}
                </p>
              ) : null}
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
                  {t("reset.buttonLoading", "Updating password...")}
                </>
              ) : (
                t("emailAction.reset.submit", "Update password")
              )}
            </button>
          </form>
        ) : isCancelEmailChangeMode ? (
          <div className="space-y-5">
            {details?.newEmail || details?.maskedNewEmail ? (
              <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-4 dark:border-white/10 dark:bg-white/5">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Cancelled email change
                </p>
                <p className="mt-1 text-base font-semibold text-black dark:text-white">
                  {details?.newEmail || details?.maskedNewEmail}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Current email
              </p>
              <p className="mt-1 text-base font-semibold text-black dark:text-white">
                {details?.currentEmail || "Unknown"}
              </p>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                New email
              </p>
              <p className="mt-1 text-base font-semibold text-black dark:text-white">
                {details?.newEmail || details?.maskedNewEmail || "Unknown"}
              </p>
            </div>

            <button
              type="button"
              onClick={handleEmailChangeConfirm}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
                  {t("emailAction.emailChange.confirming", "Confirming email...")}
                </>
              ) : (
                t("emailAction.emailChange.confirmButton", "Confirm email change")
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
