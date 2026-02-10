import React, { useMemo, useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, githubProvider } from "../firebaseClient";
import { useTranslation } from "react-i18next";


const API_BASE = import.meta.env.PROD
  ? "https://wecast.onrender.com"
  : "http://localhost:5000";
  
function getRedirectParams() {
    const hash = window.location.hash || "";
    const qs = hash.includes("?") ? hash.split("?")[1] : "";
    const params = new URLSearchParams(qs);
    return {
        redirect: params.get("redirect") || "",
        id: params.get("id") || "",
    };
}

function redirectAfterAuth() {
    const { redirect, id } = getRedirectParams();
    if (redirect === "edit") {
        window.location.hash = "#/edit";
    } else if (redirect === "create") {
        window.location.hash = "#/create";
    } else if (redirect === "preview") {
        window.location.hash = id ? `#/preview?id=${id}` : "#/preview";
    } else {
        window.location.hash = "#/";
    }
}


export default function Signup() {
    const { t } = useTranslation();
    const [form, setForm] = useState({ username: "", email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const passwordScore = useMemo(() => {
        const p = form.password || "";
        let s = 0;
        if (p.length >= 8) s++;
        if (/[A-Z]/.test(p)) s++;
        if (/[a-z]/.test(p)) s++;
        if (/\d/.test(p)) s++;
        if (/[^A-Za-z0-9]/.test(p)) s++;
        return s;
    }, [form.password]);

const strengthLabels = [
  t("PasswordStrength.VeryWeak"),
  t("PasswordStrength.Weak"),
  t("PasswordStrength.Okay"),
  t("PasswordStrength.Good"),
  t("PasswordStrength.Strong"),
  t("PasswordStrength.VeryStrong")
];

const pwLabel = strengthLabels[passwordScore];

    const onChange = (e) =>
        setForm((f) => ({
            ...f,
            [e.target.name]: e.target.value,
        }));

    const onSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const password = form.password || "";
        const hasMinLength = password.length >= 8;
        const hasUppercase = /[A-Z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);

        if (!hasMinLength || !hasUppercase || !hasNumber || !hasSpecial) {
            setError(
                "Password must be at least 8 characters and include one uppercase letter, one number, and one special symbol."
            );
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/api/signup`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    name: form.username,
                    email: form.email,
                    password: form.password,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Signup failed. Please try again.");
                setLoading(false);
                return;
            }

            if (data.token) {
                localStorage.setItem("token", data.token);
            }
            if (data.user) {
                localStorage.setItem("user", JSON.stringify(data.user));
            }

            window.dispatchEvent(
                new StorageEvent("storage", { key: "token", newValue: data.token || "" })
            );

            redirectAfterAuth();
        } catch (err) {
            console.error("SIGNUP ERROR:", err);
            setError(
                err.message ||
                "Something went wrong. Please check your connection and try again."
            );
            setLoading(false);
        }
    };


    const handleGoogleSignup = async () => {
        setError("");
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
                setError(data.error || "Signup failed.");
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            window.dispatchEvent(
                new StorageEvent("storage", { key: "token", newValue: data.token })
            );

            redirectAfterAuth();


        } catch (err) {
            console.error("GOOGLE SIGNUP ERROR:", err);
            setError("Google signup failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleGithubSignup = async () => {
        setError("");
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
                setError(data.error || "Signup failed.");
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            window.dispatchEvent(new StorageEvent("storage", { key: "token", newValue: data.token }));
            window.location.hash = "#/";

        } catch (err) {
            console.error("GITHUB SIGNUP ERROR:", err);
            setError("GitHub signup failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-cream dark:bg-[#0a0a1a] text-black dark:text-white px-4 py-12 overflow-hidden">
            {/*Decorative Background (BlubSignup image)*/}
            <div
                className="pointer-events-none absolute z-0 right-[40px] bottom-[20px] opacity-90"
                style={{
                    width: 460,
                    height: 460,
                    backgroundImage: "url('/BlubSignup.png')",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "contain",
                    backgroundPosition: "center",
                    filter: "drop-shadow(0 35px 70px rgba(0,0,0,0.15))",
                }}
            />

            {/*Animated Accent Shapes*/}
            <div className="pointer-events-none absolute z-0 right-[30px] bottom-[60px] hidden md:block">
                <div className="relative h-[200px] w-[200px]">
                    <span className="absolute left-1/2 top-1/2 -ml-2 -mt-2 h-4 w-4 rounded-full bg-purple-600/80 dark:bg-purple-400/80 animate-circular" />
                    <span className="absolute left-1/2 top-1/2 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full bg-black/60 dark:bg-white/70 animate-circular-reverse" />
                    <span className="absolute inset-0 rounded-full ring-1 ring-purple-500/20"></span>
                    <span className="absolute left-1/2 top-1/2 -ml-2 -mt-2 h-4 w-4 rounded-full bg-purple-600/80 dark:bg-purple-400/80 animate-circular" />
                    <span className="absolute left-1/2 top-1/2 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full bg-black/60 dark:bg-white/70 animate-circular-reverse" />
                    <span className="absolute inset-0 rounded-full ring-1 ring-purple-500/20"></span>
                </div>
            </div>

            <div className="pointer-events-none absolute z-0 left-[30px] top-[120px] hidden md:block">
                <div className="relative h-[200px] w-[200px]">
                    <span className="absolute left-1/2 top-1/2 -ml-2 -mt-2 h-4 w-4 rounded-full bg-purple-700/80 dark:bg-purple-400/80 animate-circular-reverse shadow" />
                    <span className="absolute left-1/2 top-1/2 -ml-1.5 -mt-1.5 h-3 w-3 rounded-full bg-black/60 dark:bg-white/70 animate-circular shadow" />
                    <span className="absolute inset-0 rounded-full ring-1 ring-purple-500/20"></span>
                </div>
            </div>

            <div className="pointer-events-none absolute z-0 left-[-80px] bottom-[-60px] hidden md:block">
                <div className="blob-morph h-[320px] w-[360px] opacity-90"></div>
            </div>

            <div className="pointer-events-none absolute z-0 left-[24px] top-[100px] hidden md:block">
                <div className="ring-dash h-[180px] w-[180px]"></div>
            </div>

            <div className="pointer-events-none absolute z-0 left-[-40px] top-[280px] hidden md:block">
                <div className="stripes-move h-[220px] w-[260px] rounded-3xl opacity-70"></div>
            </div>

            {/*Signup Card*/}
            <div className="ui-card relative z-10 w-full max-w-md p-8 backdrop-blur">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-extrabold text-black-medium dark:text-purple-400">
                        {t("signup.title")}
                    </h1>
                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                        {t("signup.subtitle")}
                    </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-5">
                    <div>
                        <label className="form-label">{t("signup.username")}</label>
                        <input
                            type="text"
                            name="username"
                            value={form.username}
                            onChange={onChange}
                            placeholder={t("signup.usernamePlaceholder")}
                            required
                            className="form-input"
                        />
                    </div>

                    <div>
                        <label className="form-label">{t("signup.email")}</label>
                        <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={onChange}
                            placeholder={t("signup.emailPlaceholder")}
                            required
                            className="form-input"
                        />
                    </div>

                   <div>
    <label className="form-label">{t("signup.password")}</label>
    <div className="relative">
        <input
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            placeholder="••••••••"
            required
            className="form-input"
        />
    </div>

    {/* Password strength bar */}
    <div className="mt-3">
        <div className="h-2 w-full rounded bg-neutral-200 dark:bg-neutral-700">
            <div
                className="h-2 rounded transition-all"
                style={{
                    width: `${(passwordScore / 5) * 100}%`,
                    background:
                        passwordScore >= 4
                            ? "#22c55e"
                            : passwordScore >= 3
                                ? "#f59e0b"
                                : "#ef4444",
                }}
            />
        </div>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
             {t("PasswordStrength.StrengthLabel")}: {pwLabel}
        </p>
    </div>
</div>

                    {error && (
                        <p className="text-sm text-red-500 text-center">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="btn-cta w-full disabled:opacity-60"
                        disabled={loading}
                    >
                        {loading ? t("signup.creating") : t("signup.button")}
                    </button>
                    <div className="flex items-center gap-4 my-4">
                        <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                        <span className="text-xs text-black/50 dark:text-white/50">or</span>
                        <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
                    </div>

                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={handleGoogleSignup}
                            disabled={loading}
                            className="w-full inline-flex items-center justify-center gap-3 border rounded-lg py-2.5 font-medium transition
                        hover:bg-black/5 dark:hover:bg-white/10
                        border-black/10 dark:border-white/15
                        text-black dark:text-white"
                        >
                            <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden>
                                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12S17.373 12 24 12c3.059 0 5.84 1.154 7.957 3.043l5.657-5.657C34.842 6.053 29.704 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.345-.138-2.655-.389-3.917z" />
                                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.814C14.4 16.042 18.844 12 24 12c3.059 0 5.84 1.154 7.957 3.043l5.657-5.657C34.842 6.053 29.704 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                                <path fill="#4CAF50" d="M24 44c5.164 0 9.86-1.977 13.39-5.205l-6.177-5.219C29.154 35.846 26.727 36.8 24 36.8c-5.192 0-9.602-3.317-11.242-7.943l-6.54 5.038C9.58 39.63 16.261 44 24 44z" />
                                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.791 2.233-2.273 4.134-4.09 5.556l6.177 5.219C39.708 35.911 44 30.455 44 24c0-1.345-.138-2.655-.389-3.917z" />
                            </svg>

                            {t("signup.continueGoogle")}
                        </button>

                        <button
                            type="button"
                            onClick={handleGithubSignup}
                            disabled={loading}
                            className="w-full inline-flex items-center justify-center gap-3 border rounded-lg py-2.5 font-medium transition
                        hover:bg-black/5 dark:hover:bg-white/10
                        border-black/10 dark:border-white/15
                        text-black dark:text-white"
                        >
                            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
                                <path d="M12 .5a12 12 0 0 0-3.793 23.4c.6.11.82-.26.82-.58v-2.02c-3.338.73-4.04-1.61-4.04-1.61-.546-1.39-1.333-1.76-1.333-1.76-1.09-.75.083-.734.083-.734 1.205.086 1.84 1.238 1.84 1.238 1.07 1.835 2.807 1.305 3.492.998.108-.79.418-1.305.76-1.604-2.665-.304-5.467-1.333-5.467-5.93 0-1.31.47-2.38 1.236-3.22-.124-.304-.536-1.527.117-3.183 0 0 1.008-.322 3.303 1.23a11.5 11.5 0 0 1 6.006 0c2.294-1.552 3.301-1.23 3.301-1.23.655 1.656.243 2.879.12 3.183.77.84 1.235 1.91 1.235 3.22 0 4.61-2.807 5.624-5.48 5.922.43.37.816 1.102.816 2.222v3.293c0 .322.216.696.826.578A12 12 0 0 0 12 .5z" />
                            </svg>

                            {t("signup.continueGoogle")}
                        </button>
                    </div>

                    <p className="text-center text-sm text-neutral-600 dark:text-neutral-300">
                            {t("signup.AlreadyHaveAccount")}{" "}
                        <a
                            href="#/login"
                            className="text-purple-medium dark:text-purple-400 underline-offset-2 hover:underline"
                        >
                            {t("signup.login")}
                        </a>
                    </p>
                </form>
            </div>
        </div>
    );
}
