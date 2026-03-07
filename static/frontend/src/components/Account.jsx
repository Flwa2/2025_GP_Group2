// src/components/Account.jsx
import React, { useEffect, useRef, useState } from "react";
import { LogOut, Check, AlertCircle, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

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

    loadUserProfile();
  }, []);

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
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-extrabold">{t("account.title")}</h1>
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
      <Card title={t("account.profile")}>
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
                label={t("account.username")}
                hint={t("account.usernameHint")}
              >
                <input
                  className="form-input bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                  placeholder="Enter your name"
                  value={profile.displayName}
                  onChange={(e) =>
                    setProfile({ ...profile, displayName: e.target.value })
                  }
                />
              </Field>
            </div>
          </div>

          {/* Bio */}
          <Field
            label={t("account.bio")}
            hint={t("account.bioHint")}
          >
            <textarea
              className="form-textarea bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
              placeholder="Tell the world what you make…"
              value={profile.bio}
              onChange={(e) =>
                setProfile({ ...profile, bio: e.target.value })
              }
              rows="3"
            />
          </Field>

          {/* Email (read-only) */}
          {profile.email && (
            <Field label={t("account.email")}>
              <input 
                className="form-input bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600" 
                value={profile.email} 
                readOnly 
              />
            </Field>
          )}
        </div>
      </Card>

      {/* APPEARANCE */}
      <Card title={t("account.appearance")}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{t("account.darkMode")}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
               {t("account.darkModeHint")}     
            </p>
          </div>
          <Toggle checked={darkMode} onChange={toggleDark} />
        </div>
      </Card>

      {/* ACTIONS: Save + Logout */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="font-semibold text-black dark:text-white">
              {t("account.actions")}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
               {t("account.actionsHint")}
            </p>
          </div>

          <div className="flex gap-3 md:ml-auto">
            {/* Save button */}
            <button
              onClick={save}
              disabled={saving || !hasUnsavedChanges}
              className={`inline-flex items-center justify-center px-6 py-3
                   rounded-xl text-sm font-semibold transition
                   ${hasUnsavedChanges 
                     ? 'bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90' 
                     : 'bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                   }`}
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                  {t("account.saving")}
                </>
              ) : (
                t("account.save")
              )}
            </button>

            {/* Logout button */}
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