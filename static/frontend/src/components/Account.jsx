// src/components/Account.jsx
import React, { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";

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
  return `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}`;
}

export default function Account() {
  const [saving, setSaving] = useState(false);

  // Profile state (default values, overwritten from localStorage)
  const [profile, setProfile] = useState({
    displayName: "WeCast User",
    handle: "@wecast",
    bio: "I create AI-powered podcasts.",
    avatarUrl: "",
    email: "user@example.com",
  });

  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);

  // Local avatar preview (when user selects a new file)
  const [avatarPreview, setAvatarPreview] = useState(null);
  const fileRef = useRef(null);

  // Load dark mode + user from localStorage
  useEffect(() => {
    // 1) Dark mode
    const saved = localStorage.getItem("wecast:dark");
    if (saved !== null) {
      const v = JSON.parse(saved);
      setDarkMode(v);
      applyDarkMode(v);
    }

    // 2) Fallback: read user from local/session storage (from login)
    const storedUserRaw =
      localStorage.getItem("user") || sessionStorage.getItem("user");
    if (storedUserRaw) {
      try {
        const u = JSON.parse(storedUserRaw);
        const name = u.displayName || u.name || profile.displayName;
        setProfile((p) => ({
          ...p,
          displayName: name,
          email: u.email || p.email,
        }));
      } catch {
        // ignore parse error
      }
    }

    // 3) Real source of truth: fetch from backend /api/me (session cookie)
    fetch("http://127.0.0.1:5000/api/me", {
      method: "GET",
      credentials: "include", 
    })
      .then((res) => {
        if (!res.ok) {
          console.warn("GET /api/me failed with status", res.status);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data || data.error) return;
        setProfile((p) => ({
          ...p,
          displayName: data.displayName || p.displayName,
          handle: data.handle || p.handle,
          email: data.email || p.email,
        }));
      })
      .catch((err) => {
        console.error("GET /api/me error:", err);
      });
  }, []);



  const shownAvatar =
    avatarPreview || profile.avatarUrl || dicebearAvatar(profile.displayName);

  function onPickAvatar() {
    fileRef.current?.click();
  }

  function onAvatarFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  }

  function toggleDark(v) {
    setDarkMode(v);
    applyDarkMode(v);
  }

  async function save() {
    setSaving(true);
    // later: send profile + darkMode to backend
    setTimeout(() => setSaving(false), 350);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    // flash message for home page
    sessionStorage.setItem(
      "wecast:flash",
      "You have been logged out successfully."
    );

    // notify app
    window.dispatchEvent(
      new StorageEvent("storage", { key: "token", newValue: "" })
    );

    // redirect
    window.location.hash = "#/";
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
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onAvatarFile}
              />
            </div>

            <div className="flex-1 grid md:grid-cols-2 gap-4 items-center">
              <Field
                label="Display name"
                full
                hint="This appears on your public profile and episodes you publish."
              >
                <input
                  className="form-input"
                  placeholder="Enter your name"
                  value={profile.displayName}
                  onChange={(e) =>
                    setProfile({ ...profile, displayName: e.target.value })
                  }
                />
              </Field>

              <Field
                label="Username (optional)"
                hint="Use letters, numbers, underscores."
              >
                <input
                  className="form-input"
                  placeholder="@username"
                  value={profile.handle}
                  onChange={(e) =>
                    setProfile({ ...profile, handle: e.target.value })
                  }
                />
              </Field>
            </div>
          </div>

          {/* Bio */}
          <Field
            label="Bio"
            full
            hint="A short sentence about what you create."
          >
            <textarea
              className="form-textarea"
              placeholder="Tell the world what you make…"
              value={profile.bio}
              onChange={(e) =>
                setProfile({ ...profile, bio: e.target.value })
              }
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

      {/* ACTIONS: Save + Logout in one consistent card */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="font-semibold text-black dark:text-white">
              Account actions
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Save your changes or sign out of WeCast on this device.
            </p>
          </div>

          {/* Buttons group */}
          <div className="flex gap-3 md:ml-auto">
            {/* Save button - primary */}
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center justify-center px-6 py-3
                   rounded-xl text-sm font-semibold
                   bg-black text-white hover:bg-black/90
                   dark:bg-white dark:text-black dark:hover:bg-white/90
                   disabled:opacity-60 transition"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>

            {/* Logout button - same size, outline style */}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center px-6 py-3
                   rounded-xl text-sm font-semibold
                   border border-red-400 text-red-600 bg-transparent
                   hover:bg-red-50 dark:hover:bg-red-900/20
                   transition"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Log out
            </button>
          </div>
        </div>
      </Card>

    </div>
  );
}

/* ---------- UI helpers ---------- */

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
      className={`w-14 h-7 rounded-full flex items-center px-1 transition ${checked
        ? "bg-black dark:bg-white justify-end"
        : "bg-gray-300 justify-start"
        }`}
      title="Toggle dark mode"
    >
      <span className="w-5 h-5 rounded-full bg-white dark:bg-black shadow transition" />
    </button>
  );
}
