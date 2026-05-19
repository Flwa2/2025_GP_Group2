// src/components/Account.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut, Check, AlertCircle, AlertTriangle, Save, RefreshCcw, Bell, PlayCircle, Palette, Trash2, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { API_BASE } from "../utils/api";
import { DEFAULT_ACCOUNT_PREFERENCES, loadAccountPreferences, saveAccountPreferences } from "../utils/accountPreferences";

const getPortalTarget = () => {
  if (typeof document === "undefined") return null;
  return document.body && document.body.nodeType === 1 ? document.body : null;
};

/* ---- Dark mode helper ---- */
function applyDarkMode(enabled) {
  const root = document.documentElement;
  if (enabled) root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem("wecast:dark", JSON.stringify(enabled));
}

/* ---- Toast notification ---- */
function Toast({ message, type = "success" }) {
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

function normalizeAuthProvider(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "unknown";
  if (raw.includes("google")) return "google";
  if (raw.includes("github")) return "github";
  if (raw.includes("password") || raw.includes("email")) return "password";
  return raw;
}

function formatAuthProviderLabel(provider) {
  switch (normalizeAuthProvider(provider)) {
    case "google":
      return "Google";
    case "github":
      return "GitHub";
    case "password":
      return "Email";
    default:
      return "your sign-in provider";
  }
}

function looksLikeEmail(value) {
  return /\S+@\S+\.\S+/.test(String(value || "").trim());
}

function normalizeUsername(value) {
  return String(value || "").trim();
}

function storedAccountEmail() {
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const raw = storage.getItem("user");
      if (!raw) continue;
      const user = JSON.parse(raw);
      const email = String(user?.email || "").trim().toLowerCase();
      if (looksLikeEmail(email)) return email;
    } catch {
      // ignore stale storage values
    }
  }
  return "";
}

const ACCOUNT_ACTION_BUTTON_CLASS =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[11.5rem]";
const ACCOUNT_SECONDARY_BUTTON_CLASS =
  `${ACCOUNT_ACTION_BUTTON_CLASS} border border-black/15 text-black hover:bg-black/5 dark:border-white/15 dark:text-white dark:hover:bg-white/10`;
const ACCOUNT_PRIMARY_BUTTON_CLASS =
  `${ACCOUNT_ACTION_BUTTON_CLASS} bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90`;
const ACCOUNT_DANGER_BUTTON_CLASS =
  `${ACCOUNT_ACTION_BUTTON_CLASS} border border-red-500 bg-red-600 text-white hover:bg-red-700`;
const ACCOUNT_STATUS_PILL_CLASS =
  "inline-flex w-full items-center justify-center rounded-xl border border-black/10 bg-black/5 px-4 py-3 text-sm font-semibold text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70 sm:w-auto sm:min-w-[11.5rem]";

export default function Account() {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState("success");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [sendingResetLink, setSendingResetLink] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showResetLinkSentModal, setShowResetLinkSentModal] = useState(false);
  const [showEmailChangeModal, setShowEmailChangeModal] = useState(false);
  const [requestingEmailChange, setRequestingEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [authProvider, setAuthProvider] = useState("unknown");
  const [usernameFieldError, setUsernameFieldError] = useState("");
  
  const [profile, setProfile] = useState({
    displayName: "WeCast User",
    bio: "I create AI-powered podcasts.",
    avatarUrl: "",
    email: "",
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

  const checkUsernameAvailability = async (username) => {
    const res = await fetch(`${API_BASE}/api/username-availability`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        data?.message ||
        data?.error ||
        (data?.code === "username_taken"
          ? "This username is already taken."
          : "We couldn't validate that username right now. Please try again.");
      const err = new Error(message);
      err.code = data?.code || "";
      throw err;
    }
    return data;
  };

  const hasUnsavedChanges = JSON.stringify(profile) !== JSON.stringify(originalProfile) || avatarFile !== null;
  const normalizedAuthProvider = normalizeAuthProvider(authProvider);
  const providerLabel = formatAuthProviderLabel(normalizedAuthProvider);
  const canSendResetLink = normalizedAuthProvider === "password" && looksLikeEmail(profile.email);
  const canChangeEmail = normalizedAuthProvider === "password" && looksLikeEmail(profile.email);
  const isProviderManaged = normalizedAuthProvider === "google" || normalizedAuthProvider === "github";

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
          const storedAuthProvider = normalizeAuthProvider(u.authProvider);
          setProfile((p) => ({
            ...p,
            displayName: name,
            email: u.email || p.email,
            bio: u.bio || p.bio,
            avatarUrl: u.avatarUrl || "",
          }));
          setAuthProvider(storedAuthProvider);
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

      const resolvedAuthProvider = normalizeAuthProvider(data.authProvider);

      const userProfile = {
        displayName: data.displayName || data.name || profile.displayName,
        bio: data.bio || profile.bio,
        email: data.email || profile.email,
        avatarUrl: data.avatarUrl || profile.avatarUrl,
      };

      setProfile(userProfile);
      setOriginalProfile(userProfile);
      setAuthProvider(resolvedAuthProvider);
      
      // Update localStorage
      const userToStore = {
        displayName: userProfile.displayName,
        email: userProfile.email,
        bio: userProfile.bio,
        avatarUrl: userProfile.avatarUrl,
        authProvider: resolvedAuthProvider,
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

  function resetAppearance() {
    const defaults = { ...DEFAULT_ACCOUNT_PREFERENCES };
    setPreferences(defaults);
    setDarkMode(false);
    applyDarkMode(false);
    showToast("Appearance settings reset", "info");
  }

  async function save() {
    if (!hasUnsavedChanges) {
      showToast("No changes to save", "info");
      return;
    }

    setSaving(true);
    setUsernameFieldError("");
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");

      const nextUsername = normalizeUsername(profile.displayName);
      const previousUsername = normalizeUsername(originalProfile.displayName);
      if (
        nextUsername &&
        nextUsername.toLowerCase() !== previousUsername.toLowerCase()
      ) {
        try {
          await checkUsernameAvailability(nextUsername);
        } catch (usernameError) {
          const message =
            usernameError?.code === "username_taken" || usernameError?.message
              ? usernameError.message
              : "This username is already taken.";
          setUsernameFieldError(message);
          showToast(message, "error");
          setSaving(false);
          return;
        }
      }
      
      // If not authenticated, save to localStorage only
      if (!token) {
        const userToStore = {
          displayName: profile.displayName,
          email: profile.email,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          authProvider: normalizedAuthProvider,
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
        const serverError = new Error(
          errorData.message || errorData.error || "Failed to update profile"
        );
        serverError.code = errorData.code || "";
        serverError.serverRejected = true;
        if (serverError.code === "username_taken") {
          setUsernameFieldError(serverError.message);
        }
        throw serverError;
      }

      const data = await res.json();

      // Update localStorage
      const userToStore = {
        displayName: profile.displayName,
        email: profile.email,
        bio: profile.bio,
        avatarUrl: data.avatarUrl || profile.avatarUrl,
        authProvider: normalizedAuthProvider,
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

      if (error?.serverRejected || error?.code) {
        showToast(error.message || "Failed to update profile", "error");
        return;
      }
      
      // Fallback to localStorage
      const userToStore = {
        displayName: profile.displayName,
        email: profile.email,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        authProvider: normalizedAuthProvider,
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

  function openResetPasswordModal() {
    if (!canSendResetLink) return;
    setShowResetLinkSentModal(false);
    setShowResetPasswordModal(true);
  }

  function closeResetPasswordModal() {
    if (sendingResetLink) return;
    setShowResetPasswordModal(false);
  }

  async function resolveResetEmail() {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
    if (token) {
      try {
        const response = await fetch(`${API_BASE}/api/me`, {
          method: "GET",
          credentials: "include",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json().catch(() => ({}));
        const apiEmail = String(data?.email || "").trim().toLowerCase();
        if (looksLikeEmail(apiEmail)) {
          return apiEmail;
        }
      } catch {
        // fallback to local state/storage values
      }
    }

    const fallbackEmail = looksLikeEmail(profile.email)
      ? String(profile.email || "").trim().toLowerCase()
      : storedAccountEmail();
    return looksLikeEmail(fallbackEmail) ? fallbackEmail : "";
  }

  async function handleSendResetLink() {
    const email = await resolveResetEmail();
    if (!looksLikeEmail(email)) {
      showToast(t("account.passwordMissingEmail"), "error");
      return;
    }

    setSendingResetLink(true);
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
      const res = await fetch(`${API_BASE}/api/send-password-reset-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw {
          code: data?.code || data?.errorType || "",
          status: res.status,
        };
      }

      setShowResetPasswordModal(false);
      setShowResetLinkSentModal(true);
      showToast(t("account.passwordSent"), "success");
    } catch (error) {
      const code = error?.code || "";
      const status = Number(error?.status || 0);
      let message = t("account.passwordSendFailed");

      if (code === "auth/too-many-requests" || status === 429) {
        message = t("account.passwordTooManyRequests");
      } else if (code === "auth/invalid-email" || status === 400) {
        message = t("account.passwordInvalidEmail");
      }

      showToast(message, code === "auth/too-many-requests" ? "warning" : "error");
    } finally {
      setSendingResetLink(false);
    }
  }

  function openEmailChangeModal() {
    if (!canChangeEmail) return;
    setNewEmail("");
    setCurrentPassword("");
    setShowEmailChangeModal(true);
  }

  function closeEmailChangeModal() {
    if (requestingEmailChange) return;
    setShowEmailChangeModal(false);
    setNewEmail("");
    setCurrentPassword("");
  }

  async function handleRequestEmailChange() {
    const normalizedCurrentEmail = String(profile.email || "").trim().toLowerCase();
    const normalizedNewEmail = String(newEmail || "").trim().toLowerCase();
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");

    if (!token) {
      showToast("Please sign in again before changing your email.", "error");
      return;
    }
    if (!looksLikeEmail(normalizedNewEmail)) {
      showToast("Enter a valid new email address.", "error");
      return;
    }
    if (normalizedNewEmail === normalizedCurrentEmail) {
      showToast("Enter a different email address to continue.", "error");
      return;
    }
    if (!currentPassword.trim()) {
      showToast("Enter your current password to confirm this change.", "error");
      return;
    }

    setRequestingEmailChange(true);
    try {
      const res = await fetch(`${API_BASE}/api/change-email-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          current_email: normalizedCurrentEmail,
          new_email: normalizedNewEmail,
          password: currentPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "We couldn't send the confirmation email right now. Please try again."
        );
      }

      setShowEmailChangeModal(false);
      setNewEmail("");
      setCurrentPassword("");
      showToast(
        `Approval email sent to ${data?.maskedCurrentEmail || normalizedCurrentEmail}.`,
        "success"
      );
    } catch (error) {
      const code = error?.code || "";
      let message =
        error?.message ||
        "We couldn't send the confirmation email right now. Please try again.";

      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential" ||
        code === "auth/invalid-login-credentials"
      ) {
        message = "Your current password is incorrect.";
      } else if (code === "auth/too-many-requests") {
        message = "Too many attempts were made. Wait a moment, then try again.";
      }

      showToast(message, "error");
    } finally {
      setRequestingEmailChange(false);
    }
  }

  function openDeleteModal() {
    setDeleteConfirmation("");
    setShowDeleteModal(true);
  }

  function closeDeleteModal() {
    if (deletingAccount) return;
    setDeleteConfirmation("");
    setShowDeleteModal(false);
  }

  async function handleDeleteAccount() {
    if (deleteConfirmation !== "DELETE") {
      showToast('Type DELETE to confirm account removal.', "warning");
      return;
    }

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) {
      showToast("You need to be signed in to delete your account.", "error");
      return;
    }

    setDeletingAccount(true);
    try {
      const res = await fetch(`${API_BASE}/api/account`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("wecast:dark");
      localStorage.removeItem("wecast-lang");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");

      window.dispatchEvent(
        new StorageEvent("storage", { key: "token", newValue: "" })
      );

      sessionStorage.setItem(
        "wecast:flash",
        "Your account has been deleted successfully."
      );

      setShowDeleteModal(false);
      window.location.hash = "#/";
    } catch (error) {
      console.error("Delete account error:", error);
      showToast(error.message || "Failed to delete account", "error");
    } finally {
      setDeletingAccount(false);
    }
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
    <div className="mx-auto w-full max-w-5xl overflow-x-hidden px-4 py-6 space-y-6 sm:p-6 sm:space-y-8">
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
        <div className="flex min-w-0 flex-col gap-5 md:gap-6">
          {/* Avatar + profile details */}
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-5 max-[360px]:gap-x-2 min-[420px]:gap-x-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-start md:gap-6">
            <div className="flex shrink-0 flex-col items-center gap-2 self-center md:self-start">
              <img
                src={shownAvatar}
                alt="Avatar"
                className="h-20 w-20 rounded-[18px] border border-gray-200 bg-white object-cover shadow-sm dark:border-neutral-700 dark:bg-neutral-800 min-[420px]:h-24 min-[420px]:w-24 md:h-28 md:w-28 md:rounded-[24px]"
              />
              <button
                onClick={onPickAvatar}
                className="whitespace-nowrap text-xs px-3 py-1.5 rounded-full
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

            <div className="min-w-0 self-center md:self-stretch">
              <div className="flex min-h-[5.5rem] min-w-0 flex-col justify-center rounded-2xl border border-black/5 bg-white/70 px-3 py-3 dark:border-white/10 dark:bg-white/5 max-[360px]:px-2.5 min-[420px]:min-h-[6rem] min-[420px]:px-4 md:min-h-0 md:py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                  Profile snapshot
                </p>
                <p className="mt-1.5 truncate text-base font-semibold leading-tight text-black dark:text-white min-[420px]:text-lg md:whitespace-normal">
                  {profile.displayName || "WeCast User"}
                </p>
                <p className="mt-0.5 truncate text-xs text-gray-600 dark:text-gray-400 min-[420px]:text-sm md:whitespace-normal">
                  {profile.email || "No email available"}
                </p>
              </div>
            </div>

            <div className="col-span-2 grid min-w-0 grid-cols-1 gap-4 min-[520px]:grid-cols-2 md:col-start-2 md:grid-cols-2">
              <Field label={t("account.username")} hint={usernameFieldError ? "" : t("account.usernameHint")}>
                <input
                  className={`form-input ${usernameFieldError ? "border-rose-500 ring-1 ring-rose-500/40 dark:border-rose-400 dark:ring-rose-400/35" : ""}`}
                  placeholder="Enter your name"
                  value={profile.displayName}
                  aria-invalid={Boolean(usernameFieldError)}
                  onChange={(e) => {
                    setUsernameFieldError("");
                    setProfile({ ...profile, displayName: e.target.value });
                  }}
                />
                {usernameFieldError ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {usernameFieldError}
                  </p>
                ) : null}
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

          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={resetProfileChanges}
              disabled={!hasUnsavedChanges || saving}
              className={`${ACCOUNT_SECONDARY_BUTTON_CLASS} ${
                hasUnsavedChanges && !saving
                  ? ""
                  : "border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-500"
              }`}
            >
              <RefreshCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={save}
              disabled={saving || !hasUnsavedChanges}
              className={`${ACCOUNT_PRIMARY_BUTTON_CLASS} ${
                hasUnsavedChanges
                  ? ""
                  : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
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
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={resetAppearance}
              className={ACCOUNT_SECONDARY_BUTTON_CLASS}
            >
              <RefreshCcw className="h-4 w-4" />
              Reset Appearance
            </button>
          </div>
        </div>
      </Card>

      {/* ACTIONS */}
      <Card
        title={t("account.actions")}
        subtitle={t("account.actionsSubtitle")}
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-black/10 bg-white/75 px-5 py-5 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-black dark:text-white">{t("account.securityTitle")}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {canSendResetLink
                    ? t("account.passwordHint")
                    : isProviderManaged
                      ? t("account.passwordProviderHint", { provider: providerLabel })
                      : t("account.passwordUnavailableHint")}
                </p>
              </div>
              {canSendResetLink ? (
                <button
                  type="button"
                  onClick={openResetPasswordModal}
                  disabled={sendingResetLink}
                  className={ACCOUNT_SECONDARY_BUTTON_CLASS}
                >
                  {sendingResetLink ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
                      {t("account.passwordSending")}
                    </>
                  ) : (
                    t("account.passwordButton")
                  )}
                </button>
              ) : (
                <span className={ACCOUNT_STATUS_PILL_CLASS}>
                  {isProviderManaged
                    ? t("account.passwordProviderManaged", { provider: providerLabel })
                    : t("account.passwordUnavailable")}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/75 px-5 py-5 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-black dark:text-white">Change email</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {canChangeEmail
                    ? "Send a confirmation link to a new email address and update your account after you verify it."
                    : isProviderManaged
                      ? `Email changes are managed through ${providerLabel}.`
                      : "Email changes are unavailable right now. Please sign in again first."}
                </p>
              </div>
              {canChangeEmail ? (
                <button
                  type="button"
                  onClick={openEmailChangeModal}
                  disabled={requestingEmailChange}
                  className={ACCOUNT_SECONDARY_BUTTON_CLASS}
                >
                  {requestingEmailChange ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Change email
                    </>
                  )}
                </button>
              ) : (
                <span className={ACCOUNT_STATUS_PILL_CLASS}>
                  {isProviderManaged ? `Managed by ${providerLabel}` : "Unavailable"}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="group flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white/75 px-5 py-4 text-left transition hover:border-black/15 hover:bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.06]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-black/[0.04] text-black transition group-hover:bg-black group-hover:text-white dark:border-white/10 dark:bg-white/[0.05] dark:text-white dark:group-hover:bg-white dark:group-hover:text-black">
              <LogOut className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold text-black dark:text-white">
              {t("account.logout")}
            </span>
          </button>

          <div className="rounded-2xl border border-red-200/80 bg-red-50/80 px-5 py-5 dark:border-red-500/20 dark:bg-red-950/20">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-red-700 dark:text-red-300">Delete account</p>
                <p className="text-sm text-red-600/90 dark:text-red-200/80">
                  Permanently delete your account and all episodes created with it.
                </p>
              </div>
              <button
                type="button"
                onClick={openDeleteModal}
                disabled={deletingAccount}
                className={ACCOUNT_DANGER_BUTTON_CLASS}
              >
                <Trash2 className="h-4 w-4" />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Toast notification */}
      <Toast message={toastMsg} type={toastType} />
      <PasswordResetModal
        open={showResetPasswordModal}
        sending={sendingResetLink}
        email={profile.email}
        onCancel={closeResetPasswordModal}
        onConfirm={handleSendResetLink}
        title={t("account.passwordModalTitle")}
        body={t("account.passwordModalBody", { email: profile.email })}
        note={t("account.passwordModalNote")}
        cancelLabel={t("account.passwordModalCancel")}
        confirmLabel={t("account.passwordModalConfirm")}
        sendingLabel={t("account.passwordSending")}
        emailUnavailableLabel={t("account.passwordEmailUnavailable")}
      />
      <PasswordResetSentModal
        open={showResetLinkSentModal}
        title={t("account.passwordSentModalTitle")}
        body={t("account.passwordSentModalBody")}
        doneLabel={t("account.passwordSentModalDone")}
        onDone={() => setShowResetLinkSentModal(false)}
      />
      <EmailChangeModal
        open={showEmailChangeModal}
        requesting={requestingEmailChange}
        currentEmail={profile.email}
        newEmail={newEmail}
        currentPassword={currentPassword}
        onNewEmailChange={setNewEmail}
        onCurrentPasswordChange={setCurrentPassword}
        onCancel={closeEmailChangeModal}
        onConfirm={handleRequestEmailChange}
      />
      <DeleteAccountModal
        open={showDeleteModal}
        confirmationText={deleteConfirmation}
        deleting={deletingAccount}
        onConfirmationChange={setDeleteConfirmation}
        onCancel={closeDeleteModal}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}

/* ---------- UI helpers ---------- */
function Card({ title, subtitle, icon, children }) {
  return (
    <div className="ui-card !p-4 sm:!p-6">
      {(title || subtitle) && (
        <div className="mb-4 flex items-start justify-between gap-4 sm:mb-6">
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

function PasswordResetModal({
  open,
  sending,
  email,
  onCancel,
  onConfirm,
  title,
  body,
  note,
  cancelLabel,
  confirmLabel,
  sendingLabel,
  emailUnavailableLabel,
}) {
  if (!open) return null;

  const modal = (
    <div className="wecast-overlay flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[460px] rounded-3xl border border-black/10 bg-white p-6 shadow-[0_26px_60px_rgba(0,0,0,0.2)] dark:border-white/10 dark:bg-neutral-950 sm:p-7"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-400/30 dark:bg-purple-500/10 dark:text-purple-200">
            <AlertCircle className="h-4 w-4" />
          </div>
          <div className="space-y-3">
            <h3 className="text-xl font-semibold tracking-tight text-black dark:text-white">{title}</h3>
            <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">{body}</p>
            <div className="rounded-2xl border border-purple-200 bg-purple-50/70 px-4 py-3 text-sm font-semibold text-purple-900 dark:border-purple-400/25 dark:bg-purple-500/10 dark:text-purple-100">
              {looksLikeEmail(email) ? email : emailUnavailableLabel}
            </div>
            <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">{note}</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={sending}
              className="inline-flex items-center justify-center rounded-xl border border-black/15 px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={sending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300/60 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-purple-500 dark:hover:bg-purple-400"
            >
              {sending ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
                  {sendingLabel}
                </>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  const portalTarget = getPortalTarget();
  return portalTarget ? createPortal(modal, portalTarget) : modal;
}

function PasswordResetSentModal({ open, title, body, doneLabel, onDone }) {
  if (!open) return null;

  const modal = (
    <div className="wecast-overlay flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[460px] rounded-3xl border border-black/10 bg-white p-6 shadow-[0_26px_60px_rgba(0,0,0,0.2)] dark:border-white/10 dark:bg-neutral-950 sm:p-7"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            <Check className="h-4 w-4" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold tracking-tight text-black dark:text-white">
              {title}
            </h3>
            <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">{body}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onDone}
            className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-300/60 dark:bg-purple-500 dark:hover:bg-purple-400"
          >
            {doneLabel}
          </button>
        </div>
      </div>
    </div>
  );
  const portalTarget = getPortalTarget();
  return portalTarget ? createPortal(modal, portalTarget) : modal;
}

function EmailChangeModal({
  open,
  requesting,
  currentEmail,
  newEmail,
  currentPassword,
  onNewEmailChange,
  onCurrentPasswordChange,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  const modal = (
    <div className="wecast-overlay flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-neutral-950">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
            <Mail className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-black dark:text-white">Change email?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              We&apos;ll send a confirmation link to your new address before WeCast updates your profile.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Current email: <span className="font-semibold text-black dark:text-white">{currentEmail || "Unavailable"}</span>
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <label className="flex flex-col gap-2">
            <span className="form-label">New email</span>
            <input
              className="form-input"
              type="email"
              value={newEmail}
              onChange={(event) => onNewEmailChange(event.target.value)}
              placeholder="you@example.com"
              autoFocus
              disabled={requesting}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="form-label">Current password</span>
            <input
              className="form-input"
              type="password"
              value={currentPassword}
              onChange={(event) => onCurrentPasswordChange(event.target.value)}
              placeholder="Enter your current password"
              disabled={requesting}
            />
            <span className="form-help">
              We ask for your password once more before sending the confirmation link.
            </span>
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={requesting}
              className="inline-flex items-center justify-center rounded-xl border border-black/15 px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={requesting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-white/90"
            >
              {requesting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
                  Sending...
                </>
              ) : (
                "Send confirmation"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  const portalTarget = getPortalTarget();
  return portalTarget ? createPortal(modal, portalTarget) : modal;
}

function DeleteAccountModal({
  open,
  confirmationText,
  deleting,
  onConfirmationChange,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  const modal = (
    <div className="wecast-overlay flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-red-200 bg-white p-6 shadow-2xl dark:border-red-500/20 dark:bg-neutral-950">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-black dark:text-white">Delete account?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              This action permanently deletes your account and all episodes tied to it.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Type <span className="font-semibold text-black dark:text-white">DELETE</span> to confirm.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <input
            className="form-input"
            value={confirmationText}
            onChange={(e) => onConfirmationChange(e.target.value)}
            placeholder="Type DELETE"
            autoFocus
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={deleting}
              className="inline-flex items-center justify-center rounded-xl border border-black/15 px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:text-white dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={deleting || confirmationText !== "DELETE"}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  const portalTarget = getPortalTarget();
  return portalTarget ? createPortal(modal, portalTarget) : modal;
}

function Field({ label, hint, children, full }) {
  return (
    <label
      className={`flex w-full min-w-0 max-w-full flex-col gap-2 ${full ? "md:col-span-2" : ""}`}
    >
      {label && <span className="form-label">{label}</span>}
      <span className="block min-w-0 w-full max-w-full">{children}</span>
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
      className={`flex h-7 w-14 shrink-0 items-center rounded-full px-1 transition ${
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
    <div className="flex w-full min-w-0 max-w-full flex-col gap-3 rounded-2xl border border-black/5 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-white dark:bg-white dark:text-black">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold [overflow-wrap:anywhere] text-black dark:text-white">{title}</p>
          <p className="mt-0.5 text-sm text-gray-600 [overflow-wrap:anywhere] dark:text-gray-400">
            {hint}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 justify-end sm:items-center">{control}</div>
    </div>
  );
}
