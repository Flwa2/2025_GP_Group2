// src/components/ResetPassword.jsx
import React, { useEffect, useState } from "react";
import { Lock, ArrowLeft } from "lucide-react";

const API_BASE = "http://127.0.0.1:5000";

// Example link shape:
// http://localhost:5173/#/reset-password?token=xxxx
function getTokenFromHash() {
  const hash = window.location.hash || "";
  const match = hash.match(/token=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const t = getTokenFromHash();
    if (!t) {
      setError("Reset link is invalid. Please request a new one.");
    }
    setToken(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!token) {
      setError("Reset link is invalid. Please request a new one.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not reset password. Please try again.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
      setInfo(
        data.message ||
          "Password updated successfully. You can now log in with your new password."
      );
    } catch (err) {
      console.error("RESET PASSWORD SUBMIT ERROR:", err);
      setError("Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = () => {
    window.location.hash = "#/login";
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-cream dark:bg-[#0a0a1a] transition-colors pb-20 md:pb-28">
      {/* right shapes - same style as login */}
      <div className="pointer-events-none absolute right-[-24px] top-24 w-72 h-72 rounded-full blur-3xl opacity-40 bg-pink-400/70 dark:bg-pink-300/20 animate-pulse" />
      <div className="pointer-events-none absolute right-24 bottom-20 w-40 h-40 rounded-2xl blur-xl opacity-40 bg-blue-400/70 dark:bg-blue-300/20 animate-bounce" />

      {/* left illustration image - same as login */}
      <div
        aria-hidden
        className="hidden md:block absolute left-[-6vw] lg:left-[-9vw] top-1/2 -translate-y-1/2 w-[68vw] max-w-[620px] h-[70vh] max-h-[560px] opacity-90 rotate-[-2deg] z-0"
        style={{
          backgroundImage: "url('/img3.png')",
          backgroundRepeat: "no-repeat",
          backgroundSize: "contain",
          backgroundPosition: "left center",
          filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.15))",
        }}
      />

      {/* card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl shadow-xl dark:shadow-black/20 rounded-2xl p-8 border border-black/5 dark:border-white/10 transition-colors">
          {/* back to login */}
          <button
            type="button"
            onClick={backToLogin}
            className="mb-4 inline-flex items-center text-sm text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to login
          </button>

          {/* heading */}
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-extrabold tracking-tight text-black dark:text-white">
              Choose a new password
            </h2>
            <p className="text-sm text-black/60 dark:text-white/60 mt-1">
              Enter and confirm your new password for your WeCast account.
            </p>
          </div>

          {/* messages */}
          {error && (
            <p className="mb-3 text-sm font-medium text-red-500 text-center">
              {error}
            </p>
          )}
          {info && (
            <p className="mb-3 text-sm font-medium text-emerald-500 text-center">
              {info}
            </p>
          )}

          {/* form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                New password
              </label>
              <div className="flex items-center border rounded-lg bg-white dark:bg-white/5 border-black/10 dark:border-white/15 focus-within:ring-2 focus-within:ring-purple-500">
                <span className="pl-3 text-black/60 dark:text-white/60">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type="password"
                  className="w-full px-3 py-3 rounded-lg outline-none bg-transparent text-black dark:text-white placeholder-black/50 dark:placeholder-white/50"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={submitted}
                />
              </div>
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                Must be at least 8 characters.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                Confirm new password
              </label>
              <div className="flex items-center border rounded-lg bg-white dark:bg-white/5 border-black/10 dark:border-white/15 focus-within:ring-2 focus-within:ring-purple-500">
                <span className="pl-3 text-black/60 dark:text-white/60">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  type="password"
                  className="w-full px-3 py-3 rounded-lg outline-none bg-transparent text-black dark:text-white placeholder-black/50 dark:placeholder-white/50"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={submitted}
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full btn-cta font-bold py-3 rounded-lg transition disabled:opacity-60"
              disabled={loading || submitted}
            >
              {loading ? "Updating password..." : "Update password"}
            </button>

            {submitted && (
              <button
                type="button"
                onClick={backToLogin}
                className="w-full mt-3 text-sm font-medium text-purple-700 dark:text-purple-300 hover:underline"
              >
                Go to login
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
