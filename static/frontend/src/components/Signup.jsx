import React, { useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:5000";

export default function Signup() {
    const [form, setForm] = useState({ username: "", email: "", password: "" });
    const [showPw, setShowPw] = useState(false);
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

    const pwLabel = ["Very weak", "Weak", "Okay", "Good", "Strong", "Very strong"][passwordScore];

    const onChange = (e) =>
        setForm((f) => ({
            ...f,
            [e.target.name]: e.target.value,
        }));

    const onSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE}/api/signup`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name: form.username,      // backend expects "name"
                    email: form.email,
                    password: form.password,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                // backend sends { error: "message" }
                setError(data.error || "Signup failed. Please try again.");
                setLoading(false);
                return;
            }

            // store token + user in localStorage
            if (data.token) {
                localStorage.setItem("token", data.token);
            }
            if (data.user) {
                localStorage.setItem("user", JSON.stringify(data.user));
            }

            // redirect to dashboard/home (#/)
            window.location.hash = "#/";

        } catch (err) {
            console.error("SIGNUP ERROR:", err);
            setError(err.message || "Something went wrong. Please check your connection and try again.");
            setLoading(false);
        }

    };

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-cream dark:bg-[#0a0a1a] text-black dark:text-white px-4 py-12 overflow-hidden">
            {/* ===== Decorative Background (BlubSignup image) ===== */}
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

            {/* ===== Animated Accent Shapes (Blah blah, leaving your UI as-is) ===== */}
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

            {/* ===== Signup Card ===== */}
            <div className="ui-card relative z-10 w-full max-w-md p-8 backdrop-blur">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-extrabold text-black-medium dark:text-purple-400">
                        Create your account
                    </h1>
                    <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
                        Join WeCast and start generating podcasts instantly.
                    </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-5">
                    <div>
                        <label className="form-label">Username</label>
                        <input
                            type="text"
                            name="username"
                            value={form.username}
                            onChange={onChange}
                            placeholder="e.g., wecaster_01"
                            required
                            className="form-input"
                        />
                    </div>

                    <div>
                        <label className="form-label">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={onChange}
                            placeholder="you@example.com"
                            required
                            className="form-input"
                        />
                    </div>

                    <div>
                        <label className="form-label">Password</label>
                        <div className="relative">
                            <input
                                type={showPw ? "text" : "password"}
                                name="password"
                                value={form.password}
                                onChange={onChange}
                                placeholder="••••••••"
                                required
                                className="form-input pr-24"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw((s) => !s)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                            >
                                {showPw ? "Hide" : "Show"}
                            </button>
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
                                Strength: {pwLabel}
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
                        {loading ? "Creating account..." : "Create account"}
                    </button>

                    <p className="text-center text-sm text-neutral-600 dark:text-neutral-300">
                        Already have an account?{" "}
                        <a
                            href="#/account"
                            className="text-purple-medium dark:text-purple-400 underline-offset-2 hover:underline"
                        >
                            Log in
                        </a>
                    </p>
                </form>

                <p className="mt-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
                    By signing up, you agree to our{" "}
                    <a
                        href="#/terms"
                        className="underline hover:text-purple-medium dark:hover:text-purple-400"
                    >
                        Terms
                    </a>{" "}
                    and{" "}
                    <a
                        href="#/privacy"
                        className="underline hover:text-purple-medium dark:hover:text-purple-400"
                    >
                        Privacy Policy
                    </a>
                    .
                </p>
            </div>
        </div>
    );
}
