// src/components/Login.jsx
import React, { useState } from "react";
import { Eye, EyeOff, Mail, Lock, ArrowLeft } from "lucide-react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, githubProvider } from "../firebaseClient";

const API_BASE = "http://127.0.0.1:5000";

function getRedirectTarget() {
  const hash = window.location.hash || "";
  const match = hash.match(/redirect=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function redirectAfterAuth() {
  const redirect = getRedirectTarget();
  if (redirect === "edit") {
    window.location.hash = "#/edit";
  } else if (redirect === "create") {
    window.location.hash = "#/create";
  } else {
    window.location.hash = "#/";
  }
}

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "reset"
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPwd, setResetPwd] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");

  const [showPwd, setShowPwd] = useState(false);
  const [showResetPwd, setShowResetPwd] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const switchToLogin = () => {
    setMode("login");
    setError("");
    setInfo("");
  };

  const switchToReset = () => {
    setMode("reset");
    setError("");
    setInfo("");
    // prefill reset email with login email if typed
    if (email && !resetEmail) setResetEmail(email);
  };

  // ------------------ LOGIN SUBMIT ------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!email.trim() || !pwd.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password: pwd }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        // account locked case (from backend)
        if (data.locked) {
          const mins = data.lockMinutes ?? 15;
          setError(
            data.error ||
            `Too many failed attempts. Your account is temporarily locked for ${mins} minutes.`
          );
          setLoading(false);
          return;
        }

        // remaining attempts
        if (typeof data.remainingAttempts === "number") {
          setError(
            data.error ||
            `Invalid email or password. You have ${data.remainingAttempts} attempts left.`
          );
          setLoading(false);
          return;
        }

        setError(data.error || "Invalid email or password.");
        setLoading(false);
        return;
      }

      if (data.token) {
        if (rememberMe) {
          // Keep user logged in across browser restarts
          localStorage.setItem("token", data.token);
        } else {
          // Only until the tab or browser is closed
          sessionStorage.setItem("token", data.token);
        }
      }

      if (data.user) {
        const userJson = JSON.stringify(data.user);
        if (rememberMe) {
          localStorage.setItem("user", userJson);
          sessionStorage.removeItem("user");
        } else {
          sessionStorage.setItem("user", userJson);
          localStorage.removeItem("user");
        }
      }

      window.dispatchEvent(
        new StorageEvent("storage", { key: "token", newValue: data.token || "" })
      );

      redirectAfterAuth();
    } catch (err) {
      console.error("LOGIN NETWORK ERROR:", err);
      setError("Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ------------------ RESET PASSWORD SUBMIT (DIRECT) ------------------
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!resetEmail.trim() || !resetPwd.trim() || !resetConfirm.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (resetPwd !== resetConfirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/reset-password-direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: resetEmail,
          new_password: resetPwd,
          confirm_password: resetConfirm,
        }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        // Backend already sends clear messages like:
        // "Email is not registered." or password rule errors
        setError(data.error || "Could not reset password. Please try again.");
      } else {
        setInfo(
          data.message || "Password updated successfully. You can now log in."
        );
        // Optional: auto switch back to login after a short delay
        // setTimeout(() => {
        //   switchToLogin();
        // }, 1800);
      }
    } catch (err) {
      console.error("RESET PASSWORD ERROR:", err);
      setError("Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ------------------ SOCIAL LOGINS ------------------
  const handleGoogleLogin = async () => {
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const idToken = await user.getIdToken();

      const res = await fetch(`${API_BASE}/api/social-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed.");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      window.dispatchEvent(
        new StorageEvent("storage", { key: "token", newValue: data.token })
      );

      redirectAfterAuth();
    } catch (err) {
      console.error("GOOGLE LOGIN ERROR:", err);
      setError("Google login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setError("");
    setInfo("");
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, githubProvider);
      const user = result.user;
      const idToken = await user.getIdToken();

      const res = await fetch(`${API_BASE}/api/social-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed.");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      window.dispatchEvent(
        new StorageEvent("storage", { key: "token", newValue: data.token })
      );

      redirectAfterAuth();
    } catch (err) {
      console.error("GITHUB LOGIN ERROR:", err);
      setError("GitHub login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // UI
  // ------------------------------------------------------------------
  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-cream dark:bg-[#0a0a1a] transition-colors pb-20 md:pb-28">
      {/* RIGHT animated shapes (your original ones) */}
      <div className="pointer-events-none absolute right-[-24px] top-24 w-72 h-72 rounded-full blur-3xl opacity-40 bg-pink-400/70 dark:bg-pink-300/20 animate-pulse" />
      <div className="pointer-events-none absolute right-24 bottom-20 w-40 h-40 rounded-2xl blur-xl opacity-40 bg-blue-400/70 dark:bg-blue-300/20 animate-bounce" />

      {/* LEFT background image (unchanged) */}
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

      {/* LOGIN / RESET CARD */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/90 dark:bg:white/5 backdrop-blur-xl shadow-xl dark:shadow-black/20 rounded-2xl p-8 border border-black/5 dark:border-white/10 transition-colors">
          {/* Top back button only in reset mode */}
          {mode === "reset" && (
            <button
              type="button"
              onClick={switchToLogin}
              className="mb-4 inline-flex items-center text-sm text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to login
            </button>
          )}

          {/* Heading */}
          <div className="mb-6 text-center">
            {mode === "login" ? (
              <>
                <h2 className="text-2xl font-extrabold tracking-tight text-black dark:text-white">
                  Log in to{" "}
                  <span className="text-purple-700 dark:text-purple-300">
                    WeCast
                  </span>
                </h2>
                <p className="text-sm text-black/60 dark:text-white/60 mt-1">
                  Welcome back. Sign in to access your podcasts and drafts.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-extrabold tracking-tight text-black dark:text-white">
                  Reset your password
                </h2>
                <p className="text-sm text-black/60 dark:text-white/60 mt-1">
                  Enter your registered email and choose a new password. If the email exists, your password will be updated directly.
                </p>
              </>
            )}
          </div>

          {/* Messages */}
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

          {/* ------------------ LOGIN FORM ------------------ */}
          {mode === "login" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-black dark:text-white mb-2">
                  Email
                </label>
                <div className="flex items-center border rounded-lg bg-white dark:bg-white/5 border-black/10 dark:border-white/15 focus-within:ring-2 focus-within:ring-purple-500">
                  <span className="pl-3 text-black/60 dark:text-white/60">
                    <Mail className="w-5 h-5" />
                  </span>
                  <input
                    type="email"
                    className="w-full px-3 py-3 rounded-lg outline-none bg-transparent text-black dark:text-white placeholder-black/50 dark:placeholder-white/50"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-black dark:text:white mb-2">
                  Password
                </label>
                <div className="flex items-center border rounded-lg bg-white dark:bg:white/5 border-black/10 dark:border:white/15 focus-within:ring-2 focus-within:ring-purple-500">
                  <span className="pl-3 text-black/60 dark:text:white/60">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type={showPwd ? "text" : "password"}
                    className="w-full px-3 py-3 rounded-lg outline-none bg-transparent text-black dark:text:white placeholder-black/50 dark:placeholder:white/50"
                    placeholder="Your password"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="pr-3 text-black/60 dark:text:white/60 hover:text:black dark:hover:text:white transition"
                    aria-label={showPwd ? "Hide password" : "Show password"}
                  >
                    {showPwd ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between text-sm">
                <label className="inline-flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-purple-600"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="text-black/80 dark:text-white/80">
                    Remember me
                  </span>
                </label>
                <button
                  type="button"
                  onClick={switchToReset}
                  className="text-purple-700 dark:text:purple-300 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full btn-cta font-bold py-3 rounded-lg transition disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Logging in..." : "Log in"}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-black/10 dark:bg:white/10" />
                <span className="text-xs text:black/50 dark:text:white/50">
                  or continue with
                </span>
                <div className="h-px flex-1 bg-black/10 dark:bg:white/10" />
              </div>

              {/* Social login */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-3 border rounded-lg py-2.5 font-medium transition hover:bg:black/5 dark:hover:bg:white/10 border-black/10 dark:border:white/15 text:black dark:text:white"
                >
                  {/* Google icon */}
                  <svg
                    viewBox="0 0 48 48"
                    className="w-5 h-5"
                    aria-hidden="true"
                  >
                    <path
                      fill="#FFC107"
                      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12S17.373 12 24 12c3.059 0 5.84 1.154 7.957 3.043l5.657-5.657C34.842 6.053 29.704 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.345-.138-2.655-.389-3.917z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.306 14.691l6.571 4.814C14.4 16.042 18.844 12 24 12c3.059 0 5.84 1.154 7.957 3.043l5.657-5.657C34.842 6.053 29.704 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.164 0 9.86-1.977 13.39-5.205l-6.177-5.219C29.154 35.846 26.727 36.8 24 36.8c-5.192 0-9.602-3.317-11.242-7.943l-6.54 5.038C9.58 39.63 16.261 44 24 44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.611 20.083H42V20H24v8h11.303c-.791 2.233-2.273 4.134-4.09 5.556l6.177 5.219C39.708 35.911 44 30.455 44 24c0-1.345-.138-2.655-.389-3.917z"
                    />
                  </svg>
                  Continue with Google
                </button>

                <button
                  type="button"
                  onClick={handleGithubLogin}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-3 border rounded-lg py-2.5 font-medium transition hover:bg:black/5 dark:hover:bg:white/10 border-black/10 dark:border:white/15 text:black dark:text:white"
                >
                  {/* GitHub icon */}
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 .5a12 12 0 0 0-3.793 23.4c.6.11.82-.26.82-.58v-2.02c-3.338.73-4.04-1.61-4.04-1.61-.546-1.39-1.333-1.76-1.333-1.76-1.09-.75.083-.734.083-.734 1.205.086 1.84 1.238 1.84 1.238 1.07 1.835 2.807 1.305 3.492.998.108-.79.418-1.305.76-1.604-2.665-.304-5.467-1.333-5.467-5.93 0-1.31.47-2.38 1.236-3.22-.124-.304-.536-1.527.117-3.183 0 0 1.008-.322 3.303 1.23a11.5 11.5 0 0 1 6.006 0c2.294-1.552 3.301-1.23 3.301-1.23.655 1.656.243 2.879.12 3.183.77.84 1.235 1.91 1.235 3.22 0 4.61-2.807 5.624-5.48 5.922.43.37.816 1.102.816 2.222v3.293c0 .322.216.696.826.578A12 12 0 0 0 12 .5z" />
                  </svg>
                  Continue with GitHub
                </button>
              </div>

              <p className="mt-6 text-center text-sm text-black/70 dark:text:white/70">
                Do not have an account?{" "}
                <a
                  href="#/signup"
                  className="text-purple-700 dark:text:purple-300 hover:underline"
                >
                  Sign up
                </a>
              </p>
            </form>
          )}

          {/* ------------------ RESET FORM ------------------ */}
          {mode === "reset" && (
            <form onSubmit={handleResetSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-black dark:text:white mb-2">
                  Registered email
                </label>
                <div className="flex items-center border rounded-lg bg-white dark:bg:white/5 border-black/10 dark:border:white/15 focus-within:ring-2 focus-within:ring-purple-500">
                  <span className="pl-3 text-black/60 dark:text:white/60">
                    <Mail className="w-5 h-5" />
                  </span>
                  <input
                    type="email"
                    className="w-full px-3 py-3 rounded-lg outline-none bg-transparent text-black dark:text:white placeholder-black/50 dark:placeholder:white/50"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-sm font-medium text-black dark:text:white mb-2">
                  New password
                </label>
                <div className="flex items-center border rounded-lg bg-white dark:bg:white/5 border-black/10 dark:border:white/15 focus-within:ring-2 focus-within:ring-purple-500">
                  <span className="pl-3 text-black/60 dark:text:white/60">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type={showResetPwd ? "text" : "password"}
                    className="w-full px-3 py-3 rounded-lg outline-none bg-transparent text-black dark:text:white placeholder-black/50 dark:placeholder:white/50"
                    placeholder="New password"
                    value={resetPwd}
                    onChange={(e) => setResetPwd(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPwd((v) => !v)}
                    className="pr-3 text-black/60 dark:text:white/60 hover:text:black dark:hover:text:white transition"
                    aria-label={showResetPwd ? "Hide password" : "Show password"}
                  >
                    {showResetPwd ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-xs text-black/60 dark:text:white/60">
                  At least 8 characters, including one uppercase letter, one number, and one symbol.
                </p>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium text-black dark:text:white mb-2">
                  Confirm new password
                </label>
                <div className="flex items-center border rounded-lg bg-white dark:bg:white/5 border-black/10 dark:border:white/15 focus-within:ring-2 focus-within:ring-purple-500">
                  <span className="pl-3 text-black/60 dark:text:white/60">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    type={showResetPwd ? "text" : "password"}
                    className="w-full px-3 py-3 rounded-lg outline-none bg-transparent text-black dark:text:white placeholder-black/50 dark:placeholder:white/50"
                    placeholder="Confirm new password"
                    value={resetConfirm}
                    onChange={(e) => setResetConfirm(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full btn-cta font-bold py-3 rounded-lg transition disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Updating password..." : "Change password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
