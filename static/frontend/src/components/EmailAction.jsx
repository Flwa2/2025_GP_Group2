import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, KeyRound, MailCheck } from "lucide-react";
import {
  applyActionCode,
  confirmPasswordReset,
  signOut,
  verifyPasswordResetCode,
} from "firebase/auth";
import { auth } from "../firebaseClient";
import { API_BASE } from "../utils/api";

const REMEMBERED_LOGIN_KEY = "rememberedLoginIdentifier";

function readHashParams() {
  const hash = window.location.hash || "";
  const queryIndex = hash.indexOf("?");
  const search = queryIndex >= 0 ? hash.slice(queryIndex + 1) : "";
  return new URLSearchParams(search);
}

function readHashPath() {
  const hash = window.location.hash || "";
  const queryIndex = hash.indexOf("?");
  return queryIndex >= 0 ? hash.slice(0, queryIndex) : hash;
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
  const params = readHashParams();
  const hashPath = readHashPath();
  const mode = params.get("mode") || "";
  const token = params.get("token") || "";
  const oobCode = params.get("oobCode") || "";
  const isFirebaseVerifyMode =
    hashPath === "#/verify-email" || mode === "verifyEmail";
  const isFirebaseResetMode =
    hashPath === "#/reset-password" || mode === "resetPassword";
  const isTokenResetMode = mode === "reset-password";
  const isResetMode = isTokenResetMode || isFirebaseResetMode;
  const isChangeEmailMode = mode === "change-email";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [details, setDetails] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function validateAction() {
      if (isFirebaseVerifyMode) {
        if (!oobCode) {
          setError("This verification link is incomplete or no longer valid.");
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
            setSuccess("Your email has been verified. You can sign in now.");
          }
        } catch (err) {
          if (!cancelled) {
            setError(
              err?.message || "This verification link is invalid or has expired."
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
          setError("This password reset link is incomplete or no longer valid.");
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
              err?.message || "This password reset link is invalid or has expired."
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
        return;
      }

      if (!token || (!isTokenResetMode && !isChangeEmailMode)) {
        setError("This action link is incomplete or no longer valid.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setSuccess("");

      try {
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
            data?.error || "This link is invalid or has already expired."
          );
        }

        if (!cancelled) {
          setDetails(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.message || "This link is invalid or has already expired."
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
    isChangeEmailMode,
    isFirebaseResetMode,
    isFirebaseVerifyMode,
    isTokenResetMode,
    oobCode,
    token,
  ]);

  async function handleResetSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!newPassword || !confirmPassword) {
      setError("Enter and confirm your new password.");
      return;
    }

    setSubmitting(true);
    try {
      let resolvedEmail = details?.email || "";
      if (isFirebaseResetMode) {
        if (newPassword !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
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
            data?.error || "We couldn't update your password from this link."
          );
        }

        resolvedEmail = data?.email || resolvedEmail;
      }

      if (resolvedEmail) {
        localStorage.setItem(REMEMBERED_LOGIN_KEY, resolvedEmail);
      }
      setSuccess("Your password has been updated. You can sign in now.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err?.message || "We couldn't update your password from this link."
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
          data?.error || "We couldn't confirm your new email right now."
        );
      }

      await signOut(auth).catch(() => {});
      clearStoredAuth();

      const resolvedEmail = data?.newEmail || details?.newEmail || "";
      if (resolvedEmail) {
        localStorage.setItem(REMEMBERED_LOGIN_KEY, resolvedEmail);
      }

      setSuccess("Your email has been updated. Sign in again with the new address.");
    } catch (err) {
      setError(
        err?.message || "We couldn't confirm your new email right now."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const title = isResetMode
    ? "Reset your password"
    : isFirebaseVerifyMode
      ? "Verify your email"
      : isChangeEmailMode
      ? "Confirm your new email"
      : "Email action";

  const subtitle = isResetMode
    ? "Choose a new password for your WeCast account."
    : isFirebaseVerifyMode
      ? "Confirm this address for your WeCast account."
      : "Finish updating the email address on your WeCast profile.";

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
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
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-4 py-4 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
            <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
            Checking your secure link...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-950/20 dark:text-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">This link cannot be used.</p>
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
                  <p className="font-semibold">Action completed</p>
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
                Go to login
              </button>
            </div>
          </div>
        ) : isResetMode ? (
          <form className="space-y-5" onSubmit={handleResetSubmit}>
            <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-4 dark:border-white/10 dark:bg-white/5">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Resetting password for
              </p>
              <p className="mt-1 text-base font-semibold text-black dark:text-white">
                {details?.email || "your account"}
              </p>
            </div>

            <label className="flex flex-col gap-2">
              <span className="form-label">New password</span>
              <input
                className="form-input"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Enter a new password"
                disabled={submitting}
              />
              <span className="form-help">
                At least 8 characters, including one uppercase letter, one number, and one symbol.
              </span>
            </label>

            <label className="flex flex-col gap-2">
              <span className="form-label">Confirm new password</span>
              <input
                className="form-input"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter your new password"
                disabled={submitting}
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
                  Updating password...
                </>
              ) : (
                "Update password"
              )}
            </button>
          </form>
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
                  Confirming email...
                </>
              ) : (
                "Confirm email change"
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
