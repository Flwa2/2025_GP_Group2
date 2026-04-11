export const ACCOUNT_PREFERENCES_KEY = "wecast:account-prefs";

export const DEFAULT_ACCOUNT_PREFERENCES = {
  autoplayPreview: true,
  editingNotifications: true,
};

export function loadAccountPreferences() {
  try {
    const raw = localStorage.getItem(ACCOUNT_PREFERENCES_KEY);
    if (!raw) return { ...DEFAULT_ACCOUNT_PREFERENCES };

    const parsed = JSON.parse(raw) || {};
    return {
      ...DEFAULT_ACCOUNT_PREFERENCES,
      ...parsed,
      // Backward-compatibility for the earlier placeholder key.
      editingNotifications:
        typeof parsed.editingNotifications === "boolean"
          ? parsed.editingNotifications
          : typeof parsed.emailUpdates === "boolean"
          ? parsed.emailUpdates
          : DEFAULT_ACCOUNT_PREFERENCES.editingNotifications,
    };
  } catch {
    return { ...DEFAULT_ACCOUNT_PREFERENCES };
  }
}

export function saveAccountPreferences(nextPreferences) {
  const resolved = {
    ...DEFAULT_ACCOUNT_PREFERENCES,
    ...(nextPreferences || {}),
  };
  localStorage.setItem(ACCOUNT_PREFERENCES_KEY, JSON.stringify(resolved));
  return resolved;
}

export function shouldAutoplayVoicePreview() {
  return loadAccountPreferences().autoplayPreview;
}

export function shouldShowEditingNotifications() {
  return loadAccountPreferences().editingNotifications;
}
