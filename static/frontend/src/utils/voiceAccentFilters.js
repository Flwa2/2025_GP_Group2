import { normalizeLanguageFilterValue } from "../components/voiceFilterLanguage";

const FACET_SPLIT = /[,;/|]/;

const pushFacetTokens = (raw, bucket) => {
  if (raw == null) return;
  if (Array.isArray(raw)) {
    raw.forEach((x) => pushFacetTokens(x, bucket));
    return;
  }
  if (typeof raw === "string") {
    raw
      .split(FACET_SPLIT)
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((x) => bucket.push(x));
    return;
  }
  const s = String(raw).trim();
  if (s) bucket.push(s);
};

const voiceFacetValues = (value) => {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(FACET_SPLIT)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
};

const collectFacetDisplaysFromVoice = (voice, ...keys) => {
  const bucket = [];
  for (const key of keys) {
    pushFacetTokens(voice?.[key], bucket);
    if (voice?.labels && typeof voice.labels === "object") pushFacetTokens(voice.labels[key], bucket);
  }
  return bucket;
};

const collectLanguageDisplaysFromVoice = (voice) => {
  const acc = [];
  pushFacetTokens(voice?.language, acc);
  pushFacetTokens(voice?.languages, acc);
  pushFacetTokens(voice?.locale, acc);
  if (voice?.labels && typeof voice.labels === "object") {
    pushFacetTokens(voice.labels.languages, acc);
    pushFacetTokens(voice.labels.language, acc);
    pushFacetTokens(voice.labels.Language, acc);
    pushFacetTokens(voice.labels.locale, acc);
    pushFacetTokens(voice.labels.Locale, acc);
  }
  return acc;
};

export const normalizeAccentToken = (value) => String(value || "").trim().toLowerCase();

const formatAccentDisplay = (token) =>
  String(token || "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const uniqueSortedDisplay = (displays) =>
  Array.from(new Set(displays.map((x) => String(x).trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

export const languageMatchTokensForVoice = (voice) => {
  const seen = new Set();
  const out = [];
  for (const display of collectLanguageDisplaysFromVoice(voice)) {
    const low = normalizeLanguageFilterValue(display);
    if (!low || seen.has(low)) continue;
    seen.add(low);
    out.push(low);
  }
  return out;
};

export const languageFilterMatches = (selectedLower, voiceLangTokens) => {
  if (!selectedLower) return true;
  if (!voiceLangTokens.length) return false;
  return voiceLangTokens.some(
    (token) =>
      token === selectedLower ||
      token.startsWith(`${selectedLower}-`) ||
      selectedLower.startsWith(`${token}-`)
  );
};

export const languageMatchesVoice = (language, voice) =>
  languageFilterMatches(normalizeLanguageFilterValue(language), languageMatchTokensForVoice(voice));

const collectLanguageAccentProfilesFromVoice = (voice) => {
  const profiles = [];
  const addProfile = (raw) => {
    if (!raw || typeof raw !== "object") return;
    const profileLanguage = String(raw.language || raw.Language || raw.locale || raw.Locale || "").trim();
    const accent = String(raw.accent || raw.Accent || "").trim();
    if (profileLanguage || accent) profiles.push({ language: profileLanguage, accent });
  };

  addProfile({
    language: voice?.language || voice?.labels?.language || voice?.labels?.Language,
    locale: voice?.locale || voice?.labels?.locale || voice?.labels?.Locale,
    accent: voice?.accent || voice?.labels?.accent || voice?.labels?.Accent,
  });

  [
    voice?.languageAccents,
    voice?.languageAccentPairs,
    voice?.language_accents,
    voice?.verified_languages,
    voice?.verifiedLanguages,
    voice?.labels?.languageAccents,
    voice?.labels?.languageAccentPairs,
    voice?.labels?.language_accents,
    voice?.labels?.verified_languages,
    voice?.labels?.verifiedLanguages,
  ].forEach((list) => {
    if (Array.isArray(list)) list.forEach(addProfile);
  });

  const seen = new Set();
  return profiles.filter((profile) => {
    const key = `${profile.language.toLowerCase()}|${profile.accent.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const languageMatchesAccentProfile = (language, profile) => {
  const selected = normalizeLanguageFilterValue(language);
  if (!selected) return true;
  const profileLang = normalizeLanguageFilterValue(profile?.language);
  if (!profileLang) return false;
  return languageFilterMatches(selected, [profileLang]);
};

/** Accent labels for a voice scoped to a language (display casing preserved). */
export const accentDisplaysForLanguageFromVoice = (voice, language) => {
  const normalizedLanguage = normalizeLanguageFilterValue(language);
  const profiles = collectLanguageAccentProfilesFromVoice(voice);
  const matchedProfiles = profiles.filter((profile) => languageMatchesAccentProfile(normalizedLanguage, profile));
  const matchedProfileAccents = matchedProfiles.map((profile) => profile.accent).filter(Boolean);
  if (matchedProfiles.length) return matchedProfileAccents;
  if (profiles.length) return [];
  if (!languageMatchesVoice(normalizedLanguage, voice)) return [];
  return collectFacetDisplaysFromVoice(voice, "accent", "Accent");
};

/** Lowercase accent tokens used when applying the accent filter (must match filter logic). */
export const accentTokensForLanguageFromVoice = (voice, language) =>
  accentDisplaysForLanguageFromVoice(voice, language).map(normalizeAccentToken).filter(Boolean);

/** True when this voice matches language + accent using the same rules as client-side filtering. */
export const voiceMatchesAccentForLanguage = (voice, language, accentValue) => {
  const normalizedLanguage = normalizeLanguageFilterValue(language);
  const accentToken = normalizeAccentToken(accentValue);
  if (!accentToken) return true;
  if (!languageMatchesVoice(normalizedLanguage, voice)) return false;
  return accentTokensForLanguageFromVoice(voice, normalizedLanguage).includes(accentToken);
};

/**
 * Build accent dropdown options for a language.
 * Only includes accents that at least one voice in `voices` can match when that accent is selected.
 */
export const buildAccentOptionsForLanguage = (voices, language, defaultLanguage = "en") => {
  const normalizedLanguage = normalizeLanguageFilterValue(language || defaultLanguage);
  const tokenToDisplay = new Map();

  for (const voice of voices || []) {
    if (!languageMatchesVoice(normalizedLanguage, voice)) continue;

    const tokens = accentTokensForLanguageFromVoice(voice, normalizedLanguage);
    if (!tokens.length) continue;

    const displays = accentDisplaysForLanguageFromVoice(voice, normalizedLanguage);
    for (const token of tokens) {
      if (!token || tokenToDisplay.has(token)) continue;
      if (!voiceMatchesAccentForLanguage(voice, normalizedLanguage, token)) continue;

      const display =
        displays.find((label) => normalizeAccentToken(label) === token) || formatAccentDisplay(token);
      tokenToDisplay.set(token, display);
    }
  }

  return uniqueSortedDisplay(Array.from(tokenToDisplay.values()));
};

export const countVoicesMatchingAccentForLanguage = (voices, language, accentValue) => {
  const normalizedLanguage = normalizeLanguageFilterValue(language);
  const accentToken = normalizeAccentToken(accentValue);
  if (!accentToken) return (voices || []).filter((voice) => languageMatchesVoice(normalizedLanguage, voice)).length;
  return (voices || []).filter((voice) => voiceMatchesAccentForLanguage(voice, normalizedLanguage, accentToken)).length;
};
