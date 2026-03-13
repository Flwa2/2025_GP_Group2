// src/components/Account.jsx
import React, { useEffect, useRef, useState } from "react";
import { LogOut, Check, AlertCircle, AlertTriangle, Save, RefreshCcw, Bell, PlayCircle, Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DEFAULT_ACCOUNT_PREFERENCES, loadAccountPreferences, saveAccountPreferences } from "../utils/accountPreferences";

const API_BASE = import.meta.env.PROD
  ? "https://wecast.onrender.com"
  : "http://localhost:5000";

/* ---- Dark mode helper ---- */
function applyDarkMode(enabled) {
  const root = document.documentElement;
  if (enabled) root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem("wecast:dark", JSON.stringify(enabled));
}

/* ---- Toast notification ---- */
function Toast({ message, type = "success", onClose }) {
  if (!message) return null;
  
  const bgColor = {
    success: "bg-green-500 border-green-300",
    error: "bg-red-500 border-red-300",
    warning: "bg-yellow-500 border-yellow-300",
    info: "bg-blue-500 border-blue-300"
  }[type] || "bg-green-500 border-green-300";

  const Icon = {
    success: Check,
    error: AlertCircle,
    warning: AlertTriangle,
    info: AlertCircle
  }[type] || Check;

  return (
    <div className="fixed top-6 right-6 z-[10000] animate-in slide-in-from-right-8 duration-300">
      <div className={`${bgColor} text-white px-6 py-3 rounded-xl shadow-2xl border`}>
        <div className="flex items-center gap-2 font-semibold">
          <Icon className="w-4 h-4" />
          {message}
        </div>
      </div>
    </div>
  );
}

/* Build a nice fallback avatar  */
function dicebearAvatar(name = "WeCast User") {
  const seed = encodeURIComponent(name.trim() || "WeCast User");
  return `https://api.dicebear.com/8.x/adventurer/svg?seed=${seed}`;
}

export default function Account() {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState("success");
  
  const [profile, setProfile] = useState({
    displayName: "WeCast User",
    bio: "I create AI-powered podcasts.",
    avatarUrl: "",
    email: "user@example.com",
  });

  const [originalProfile, setOriginalProfile] = useState({});

  // Dark mode state (saved to localStorage)
  const [darkMode, setDarkMode] = useState(false);
  const [preferences, setPreferences] = useState(DEFAULT_ACCOUNT_PREFERENCES);

  // Local avatar preview
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);

  const fileRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToastMsg(message);
    setToastType(type);
    setTimeout(() => {
      setToastMsg("");
      setToastType("success");
    }, 3000);
  };

  const hasUnsavedChanges = JSON.stringify(profile) !== JSON.stringify(originalProfile) || avatarFile !== null;

  useEffect(() => {
    // Load Dark Mode from localStorage
    const saved = localStorage.getItem("wecast:dark");
    if (saved !== null) {
      const v = JSON.parse(saved);
      setDarkMode(v);
      applyDarkMode(v);
    }

    setPreferences(loadAccountPreferences());

    loadUserProfile();
  }, []);

  useEffect(() => {
    saveAccountPreferences(preferences);
  }, [preferences]);

  const loadUserProfile = async () => {
    setLoading(true);
    try {
      // First load from localStorage
      const storedUserRaw = localStorage.getItem("user") || sessionStorage.getItem("user");
      if (storedUserRaw) {
        try {
          const u = JSON.parse(storedUserRaw);
          const name = u.displayName || u.name || "WeCast User";
          setProfile((p) => ({
            ...p,
            displayName: name,
            email: u.email || p.email,
            bio: u.bio || p.bio,
            avatarUrl: u.avatarUrl || "",
          }));
          setOriginalProfile((p) => ({
            ...p,
            displayName: name,
            email: u.email || p.email,
            bio: u.bio || p.bio,
            avatarUrl: u.avatarUrl || "",
          }));
        } catch {
          // ignore parse error
        }
      }

      // Then try to load from API
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/me`, {
        method: "GET",
        credentials: "include",
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        console.warn("GET /api/me failed with status", res.status);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!data || data.error) {
        setLoading(false);
        return;
      }

      const userProfile = {
        displayName: data.displayName || data.name || profile.displayName,
        bio: data.bio || profile.bio,
        email: data.email || profile.email,
        avatarUrl: data.avatarUrl || profile.avatarUrl,
      };

      setProfile(userProfile);
      setOriginalProfile(userProfile);
      
      // Update localStorage
      const userToStore = {
        displayName: userProfile.displayName,
        email: userProfile.email,
        bio: userProfile.bio,
        avatarUrl: userProfile.avatarUrl
      };
      
      if (localStorage.getItem("user")) {
        localStorage.setItem("user", JSON.stringify(userToStore));
      } else if (sessionStorage.getItem("user")) {
        sessionStorage.setItem("user", JSON.stringify(userToStore));
      }
      
    } catch (err) {
      console.error("GET /api/me error:", err);
    } finally {
      setLoading(false);
    }
  };

  const shownAvatar = avatarPreview || profile.avatarUrl || dicebearAvatar(profile.displayName);

  function onPickAvatar() {
    fileRef.current?.click();
  }

  function onAvatarFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      showToast("Please select an image file", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image size should be less than 5MB", "error");
      return;
    }

    setAvatarFile(file);
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  }

  function toggleDark(v) {
    setDarkMode(v);
    applyDarkMode(v);
  }

  function resetProfileChanges() {
    setProfile(originalProfile);
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileRef.current) fileRef.current.value = "";
    showToast("Profile changes discarded", "info");
  }

  function resetPreferences() {
    const defaults = { ...DEFAULT_ACCOUNT_PREFERENCES };
    setPreferences(defaults);
    setDarkMode(false);
    applyDarkMode(false);
    showToast("Preferences reset to default", "info");
  }

  async function save() {
    if (!hasUnsavedChanges) {
      showToast("No changes to save", "info");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      
      // If not authenticated, save to localStorage only
      if (!token) {
        const userToStore = {
          displayName: profile.displayName,
          email: profile.email,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl
        };
        
        localStorage.setItem("user", JSON.stringify(userToStore));
        
        setOriginalProfile(profile);
        setAvatarFile(null);
        setAvatarPreview(null);
        
        showToast("Profile saved locally!", "success");
        setSaving(false);
        return;
      }

      // Prepare FormData for API call
      const formData = new FormData();
      formData.append('displayName', profile.displayName);
      formData.append('bio', profile.bio);
      
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const res = await fetch(`${API_BASE}/api/profile/update`, {
        method: "POST",
        credentials: "include",
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update profile");
      }

      const data = await res.json();

      // Update localStorage
      const userToStore = {
        displayName: profile.displayName,
        email: profile.email,
        bio: profile.bio,
        avatarUrl: data.avatarUrl || profile.avatarUrl
      };
      
      if (localStorage.getItem("user")) {
        localStorage.setItem("user", JSON.stringify(userToStore));
      } else if (sessionStorage.getItem("user")) {
        sessionStorage.setItem("user", JSON.stringify(userToStore));
      }

      setOriginalProfile(profile);
      
      if (data.avatarUrl) {
        setProfile(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
        setOriginalProfile(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
      }
      
      setAvatarFile(null);
      setAvatarPreview(null);

      showToast("Profile updated successfully!", "success");
      
    } catch (error) {
      console.error("Save error:", error);
      
      // Fallback to localStorage
      const userToStore = {
        displayName: profile.displayName,
        email: profile.email,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl
      };
      
      localStorage.setItem("user", JSON.stringify(userToStore));
      setOriginalProfile(profile);
      
      showToast(error.message || "Saved locally (server unavailable)", "warning");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");

    sessionStorage.setItem(
      "wecast:flash",
      "You have been logged out successfully."
    );

    window.dispatchEvent(
      new StorageEvent("storage", { key: "token", newValue: "" })
    );

    window.location.hash = "#/";
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 sm:p-6 sm:space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{t("account.title")}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
           {t("account.subtitle")}
        </p>
        {hasUnsavedChanges && (
          <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1 mt-2">
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
            You have unsaved changes
          </p>
        )}
      </header>

      {/* PROFILE */}
      <Card
        title={t("account.profile")}
        subtitle="Update your public identity, avatar, and bio in one place."
        icon={<Save className="w-5 h-5" />}
      >
        <div className="flex flex-col gap-6">
          {/* Avatar + name row */}
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="relative shrink-0">
              <img
                src={shownAvatar}
                alt="Avatar"
                className="w-28 h-28 rounded-[24px] object-cover border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm"
              />
              <button
                onClick={onPickAvatar}
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-xs px-3 py-1.5 rounded-full
                  bg-black text-white dark:bg-white dark:text-black border
                  border-black dark:border-white shadow-md"
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

            <div className="flex-1 grid md:grid-cols-2 gap-4 items-start">
              <div className="md:col-span-2 rounded-2xl border border-black/5 dark:border-white/10 bg-white/70 dark:bg-white/5 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                  Profile snapshot
                </p>
                <p className="mt-2 text-lg font-semibold text-black dark:text-white">
                  {profile.displayName || "WeCast User"}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {profile.email || "No email available"}
                </p>
              </div>

              <Field
                label={t("account.username")}
                hint={t("account.usernameHint")}
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

              {profile.email && (
                <Field label={t("account.email")}>
                  <input
                    className="form-input bg-neutral-100 dark:bg-neutral-800"
                    value={profile.email}
                    readOnly
                  />
                </Field>
              )}
            </div>
          </div>

          {/* Bio */}
          <Field
            label={t("account.bio")}
            hint={t("account.bioHint")}
          >
            <textarea
              className="form-textarea"
              placeholder="Tell the world what you make…"
              value={profile.bio}
              onChange={(e) =>
                setProfile({ ...profile, bio: e.target.value })
              }
              rows="3"
            />
          </Field>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl border border-purple-200/70 dark:border-purple-400/20 bg-purple-50/70 dark:bg-purple-900/10 px-4 py-4">
            <div>
              <p className="font-semibold text-black dark:text-white">Profile actions</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Save from here because these buttons only affect the profile section above.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={resetProfileChanges}
                disabled={!hasUnsavedChanges || saving}
                className={`inline-flex w-full items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border transition sm:w-auto ${
                  hasUnsavedChanges && !saving
                    ? "border-black/15 text-black hover:bg-black/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
                    : "border-gray-200 text-gray-400 cursor-not-allowed dark:border-gray-700 dark:text-gray-500"
                }`}
              >
                <RefreshCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={save}
                disabled={saving || !hasUnsavedChanges}
                className={`inline-flex w-full items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition sm:w-auto ${
                  hasUnsavedChanges
                    ? "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400"
                }`}
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    {t("account.saving")}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {t("account.save")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* APPEARANCE */}
      <Card
        title={t("account.appearance")}
        subtitle="Device-level preferences for how WeCast feels while you work."
        icon={<Palette className="w-5 h-5" />}
      >
        <div className="space-y-5">
          <PreferenceRow
            icon={<Palette className="w-4 h-4" />}
            title={t("account.darkMode")}
            hint={t("account.darkModeHint")}
            control={<Toggle checked={darkMode} onChange={toggleDark} />}
          />
          <PreferenceRow
            icon={<PlayCircle className="w-4 h-4" />}
            title="Auto-play voice previews"
            hint="Keep preview playback immediate when you test voices and clips on this device."
            control={
              <Toggle
                checked={preferences.autoplayPreview}
                onChange={(value) =>
                  setPreferences((prev) => ({ ...prev, autoplayPreview: value }))
                }
              />
            }
          />
          <PreferenceRow
            icon={<Bell className="w-4 h-4" />}
            title="Editing notifications"
            hint="Show or hide non-critical success notices while editing. Errors and warnings still appear."
            control={
              <Toggle
                checked={preferences.editingNotifications}
                onChange={(value) =>
                  setPreferences((prev) => ({ ...prev, editingNotifications: value }))
                }
              />
            }
          />
        </div>
      </Card>

      {/* ACTIONS */}
      <Card
        title={t("account.actions")}
        subtitle="Log out of your account or reset the preferences saved on this device."
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col gap-3 sm:flex-row md:ml-auto">
            <button
              type="button"
              onClick={resetPreferences}
              className="inline-flex w-full items-center justify-center px-6 py-3 rounded-xl text-sm font-semibold border border-black/15 text-black hover:bg-black/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10 transition sm:w-auto"
            >
              Reset Preferences
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex w-full items-center justify-center px-6 py-3
                   rounded-xl text-sm font-semibold
                   border border-red-400 text-red-600 bg-transparent
                   hover:bg-red-50 dark:hover:bg-red-900/20
                   transition sm:w-auto"
            >
              <LogOut className="w-4 h-4 mr-1" />
              {t("account.logout")}
            </button>
          </div>
        </div>
      </Card>

      {/* Toast notification */}
      <Toast message={toastMsg} type={toastType} />
    </div>
  );
}

/* ---------- UI helpers ---------- */
function Card({ title, subtitle, icon, children }) {
  return (
    <div className="ui-card">
      {(title || subtitle) && (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            {title && (
              <div className="flex items-center gap-2">
                {icon ? <span className="text-black/70 dark:text-white/70">{icon}</span> : null}
                <h2 className="ui-card-title !mb-0">{title}</h2>
              </div>
            )}
            {subtitle ? (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{subtitle}</p>
            ) : null}
          </div>
        </div>
      )}
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
      className={`w-14 h-7 rounded-full flex items-center px-1 transition ${
        checked
          ? "bg-black dark:bg-white justify-end"
          : "bg-gray-300 justify-start"
      }`}
      title="Toggle dark mode"
    >
      <span className="w-5 h-5 rounded-full bg-white dark:bg-black shadow transition" />
    </button>
  );
}

function PreferenceRow({ icon, title, hint, control }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-white/5 px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white dark:bg-white dark:text-black">
          {icon}
        </div>
        <div>
          <p className="font-semibold text-black dark:text-white">{title}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{hint}</p>
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

