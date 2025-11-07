// src/components/Account.jsx
import React, { useEffect, useRef, useState } from "react";

/* ---- Dark mode helper ---- */
function applyDarkMode(enabled) {
    const root = document.documentElement;
    if (enabled) root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("wecast:dark", JSON.stringify(enabled));
}

/* Build a nice fallback avatar (no backend required) */
function dicebearAvatar(name = "WeCast User") {
    const seed = encodeURIComponent(name.trim() || "WeCast User");
    // You can switch "adventurer" to any DiceBear style you like (avataaars, thumbs, etc.)
    return `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}`;
}

export default function Account() {
    const [saving, setSaving] = useState(false);

    // Profile state (loads from backend if available; otherwise uses defaults)
    const [profile, setProfile] = useState({
        displayName: "Flawa",
        handle: "@wecast",
        bio: "I create AI-powered podcasts.",
        avatarUrl: "",       // if backend provides an absolute URL, we’ll use it
        email: "user@example.com", // optional/read-only
    });

    // Dark mode state
    const [darkMode, setDarkMode] = useState(false);

    // Local avatar preview (when user selects a new file)
    const [avatarPreview, setAvatarPreview] = useState(null);
    const fileRef = useRef(null);

    // Load dark mode + (optional) profile from backend
    useEffect(() => {
        const saved = localStorage.getItem("wecast:dark");
        if (saved !== null) {
            const v = JSON.parse(saved);
            setDarkMode(v);
            applyDarkMode(v);
        }

        // Try to load the real user from backend; if it fails, keep defaults.
        (async () => {
            try {
                const r = await fetch("/api/me");
                if (r.ok) {
                    const data = await r.json();
                    setProfile((p) => ({
                        ...p,
                        displayName: data.displayName ?? p.displayName,
                        handle: data.handle ?? p.handle,
                        bio: data.bio ?? p.bio,
                        avatarUrl: data.avatarUrl ?? "",
                        email: data.email ?? p.email,
                    }));
                    const dm = data.settings?.darkMode ?? darkMode;
                    setDarkMode(dm);
                    applyDarkMode(dm);
                }
            } catch {
                // no-op: fallback works
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // If there is no real avatar, generate one from the displayName
    const shownAvatar = avatarPreview || profile.avatarUrl || dicebearAvatar(profile.displayName);

    function onPickAvatar() {
        fileRef.current?.click();
    }

    function onAvatarFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        setAvatarPreview(url);

        // OPTIONAL: upload to backend
        // const fd = new FormData();
        // fd.append("avatar", file);
        // fetch("/api/me/avatar", { method: "POST", body: fd })
        //   .then(res => res.json())
        //   .then(data => setProfile(p => ({ ...p, avatarUrl: data.avatarUrl })));
    }

    function toggleDark(v) {
        setDarkMode(v);
        applyDarkMode(v); // apply immediately & persist
    }

    async function save() {
        setSaving(true);
        // OPTIONAL: persist to backend if you have endpoints
        // await fetch("/api/me/profile", {
        //   method: "PUT",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify({ displayName: profile.displayName, handle: profile.handle, bio: profile.bio }),
        // });
        // await fetch("/api/me/settings", {
        //   method: "PUT",
        //   headers: { "Content-Type": "application/json" },
        //   body: JSON.stringify({ darkMode }),
        // });

        setTimeout(() => setSaving(false), 350);
    }

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8">
            <header className="space-y-1">
                <h1 className="text-3xl font-extrabold">Account</h1>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    Manage your profile and appearance.
                </p>
            </header>

            {/* PROFILE */}
            <Card title="Profile">
                <div className="flex flex-col gap-6">
                    {/* Avatar + name row */}
                    {/* Avatar + name row */}
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            <img
                                src={shownAvatar}
                                alt="Avatar"
                                className="w-24 h-24 rounded-2xl object-cover border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                            />
                            <button
                                onClick={onPickAvatar}
                                className="absolute -bottom-2 -right-2 text-xs px-2 py-1 rounded-md
                 bg-black text-white dark:bg-white dark:text-black border
                 border-black dark:border-white"
                            >
                                Change
                            </button>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarFile} />
                        </div>

                        <div className="flex-1 grid md:grid-cols-2 gap-4 items-center">
                            <Field label="Display name" full hint="This appears on your public profile and episodes you publish.">
                                <input
                                    className="form-input"
                                    placeholder="Enter your name"
                                    value={profile.displayName}
                                    onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                                />
                            </Field>

                            <Field label="Username (optional)" hint="Use letters, numbers, underscores.">
                                <input
                                    className="form-input"
                                    placeholder="@username"
                                    value={profile.handle}
                                    onChange={(e) => setProfile({ ...profile, handle: e.target.value })}
                                />
                            </Field>
                        </div>
                    </div>

                    {/* Bio */}
                    <Field label="Bio" full hint="A short sentence about what you create.">
                        <textarea
                            className="form-textarea"
                            placeholder="Tell the world what you make…"
                            value={profile.bio}
                            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                        />
                    </Field>

                    {/* Email (read-only) */}
                    {profile.email && (
                        <Field label="Email (read-only)">
                            <input className="form-input" value={profile.email} readOnly />
                        </Field>
                    )}

                </div>
            </Card>

            {/* APPEARANCE */}
            <Card title="Appearance">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-semibold">Dark Mode</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Switches the entire site theme on this device.
                        </p>
                    </div>
                    <Toggle checked={darkMode} onChange={toggleDark} />
                </div>
            </Card>

            {/* Save */}
            <div className="flex gap-3 items-center">
                <button className="btn-cta" onClick={save} disabled={saving}>
                    {saving ? "Saving…" : "Save Changes"}
                </button>
            </div>

        </div>
    );
}

/* ---------- UI helpers ---------- */

// ...imports and helpers stay the same

function Card({ title, children }) {
    return (
        <div className="ui-card">
            {title && <h2 className="ui-card-title">{title}</h2>}
            {children}
        </div>
    );
}

function Field({ label, hint, children, full }) {
    return (
        <label className={`flex flex-col gap-2 ${full ? "md:col-span-2" : ""}`}>
            {label && <span className="form-label">{label}</span>}
            {children}
            {hint && <span className="form-help">{hint}</span>}
        </label>
    );
}


function Toggle({ checked, onChange }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`w-14 h-7 rounded-full flex items-center px-1 transition ${checked ? "bg-black dark:bg-white justify-end" : "bg-gray-300 justify-start"
                }`}
            title="Toggle dark mode"
        >
            <span className="w-5 h-5 rounded-full bg-white dark:bg-black shadow transition" />
        </button>
    );
}
