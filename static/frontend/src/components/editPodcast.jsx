import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import {
  Mic2,
  Users,
  NotebookPen,
  Check,
  Info,
  AlertCircle,
  Play,
  Pause,
  Download,
  Headphones,
  Music2,
  SlidersHorizontal,
  Save,
  X,
  Trash2,
  Pencil,
  Volume2,
  AlertTriangle,
  FileText,
  Volume,
  Disc,
  ChevronLeft,
  ChevronDown,
  RefreshCw
} from "lucide-react";
import VoiceFiltersModal from "./VoiceFiltersModal";
import { useVoiceFilterModalPreview } from "../hooks/useVoiceFilterModalPreview";
import {
  DEFAULT_MODAL_VOICE_FILTERS,
  getSafeModalGenderFilter,
  hasActiveModalVoiceFilters,
} from "../utils/voiceFilterModal";
import { getStrictFilteredVoicePool } from "../utils/strictVoicePool";
import {
  appliedFiltersFromModalDone,
  appliedVoiceFiltersForSpeakerGender,
  buildAppliedVoiceFiltersForSpeaker,
  firstVoiceIdFromPool,
  logStrictDropdownFinal,
  modalFiltersFromApplied,
  pickVoiceIdFromFilteredPool,
  refineVoicesForSpeakerModalFilters,
} from "../utils/voiceSpeakerFilterApply";
import { exportScriptPdf } from "../utils/exportScriptPdf";
import { exportScriptTxt } from "../utils/exportScriptTxt";
import { shouldAutoplayVoicePreview, shouldShowEditingNotifications } from "../utils/accountPreferences";
import {
  VOICE_AGE_BUCKETS,
  buildVoiceAgeDebugSummary,
  collectVoiceAgeOptions,
  formatVoiceAgeLabel,
  voiceMatchesAge,
} from "../utils/voiceAgeFilters";
import {
  PITCH_VALUES,
  TONE_FILTER_VALUES,
  buildTonePitchDebugMatrix,
  formatPitchLabel,
  formatToneLabel,
  voiceMatchesPitch,
  voiceMatchesTone,
} from "../utils/voiceTonePitchFilters";
import {
  accentDisplaysForLanguageFromVoice,
  buildAccentOptionsForLanguage,
  languageMatchesVoice,
} from "../utils/voiceAccentFilters";
import { ensureVoiceLibraryCatalog } from "../utils/voiceLibraryCache";
import { normalizeGenderToken } from "../utils/voiceGender";

import { API_BASE, apiFetch, getAuthHeaders } from "../utils/api";

const getPortalTarget = () => {
  if (typeof document === "undefined") return null;
  return document.body && document.body.nodeType === 1 ? document.body : null;
};

const getHashSearchParams = () => {
  const hash = window.location.hash || "";
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
};

const parseJsonResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  return data || {};
};

const requestErrorMessage = (error, fallback) => {
  const message = error?.message || "";
  if (message === "Failed to fetch") {
    return `${fallback}. Could not reach the WeCast backend at ${API_BASE}.`;
  }
  return message || fallback;
};

const firstText = (...values) => {
  for (const value of values) {
    if (value == null) continue;
    if (typeof value === "object") continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

const normalizeSavedSpeaker = (speaker = {}) => {
  const selectedVoice = speaker.selectedVoice && typeof speaker.selectedVoice === "object"
    ? speaker.selectedVoice
    : {};
  const voiceId = firstText(
    speaker.voiceId,
    speaker.voice_id,
    speaker.providerVoiceId,
    speaker.provider_voice_id,
    speaker.selectedVoiceId,
    speaker.selected_voice_id,
    selectedVoice.voiceId,
    selectedVoice.voice_id,
    selectedVoice.providerVoiceId,
    selectedVoice.id,
    selectedVoice.docId
  );
  const voiceName = firstText(
    speaker.voiceName,
    speaker.voice_name,
    speaker.selectedVoiceName,
    speaker.selected_voice_name,
    speaker.voiceLabel,
    speaker.voice_label,
    speaker.displayVoiceName,
    speaker.display_voice_name,
    selectedVoice.name,
    selectedVoice.label,
    selectedVoice.displayName
  );

  return {
    ...speaker,
    name: firstText(speaker.name, speaker.speakerName, speaker.speaker_name) || "",
    gender: firstText(speaker.gender, speaker.Gender) || "Male",
    role: firstText(speaker.role, speaker.Role) || "host",
    voiceId,
    voiceName,
  };
};

const normalizeSavedSpeakers = (speakers) =>
  Array.isArray(speakers) ? speakers.map(normalizeSavedSpeaker) : [];

const isGeneratedVoiceFallback = (label, voiceId = "") => {
  const text = String(label || "").trim();
  const id = String(voiceId || "").trim();
  if (!text) return false;
  if (/^selected voice\s*(\(|$)/i.test(text)) return true;
  return Boolean(id && text.toLowerCase().includes(id.toLowerCase()));
};

const getVoiceCatalogId = (voice = {}) => firstText(
  voice.providerVoiceId,
  voice.provider_voice_id,
  voice.voiceId,
  voice.voice_id,
  voice.id,
  voice.docId,
  voice.doc_id
);

const getVoiceDisplayName = (voice = {}) => {
  const labels = voice.labels && typeof voice.labels === "object" ? voice.labels : {};
  return firstText(
    voice.name,
    voice.label,
    voice.displayName,
    voice.display_name,
    voice.voiceName,
    voice.voice_name,
    voice.selectedVoiceName,
    labels.name,
    labels.label,
    labels.displayName,
    labels.display_name
  );
};

const resolveMusicTrackValue = (raw) => {
  if (raw == null) return "";
  if (typeof raw === "object") {
    return firstText(raw.file, raw.filename, raw.trackFile, raw.trackId, raw.id, raw.value, raw.name);
  }
  return String(raw).trim();
};

const musicToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\\/g, "/")
    .split("/")
    .pop();

const findMusicCategoryForTracks = (tracks, preferredCategory = "", musicCategories = {}) => {
  const preferred = String(preferredCategory || "").trim();
  if (preferred && musicCategories[preferred]) return preferred;
  const selectedTokens = [tracks.introMusic, tracks.bodyMusic, tracks.outroMusic]
    .map(musicToken)
    .filter(Boolean);
  if (!selectedTokens.length) return preferred && musicCategories[preferred] ? preferred : "";
  for (const [cat, trackList] of Object.entries(musicCategories)) {
    const categoryTokens = trackList.flatMap((track) => [musicToken(track.file), musicToken(track.name)]);
    if (selectedTokens.some((token) => categoryTokens.includes(token))) return cat;
  }
  return "";
};

const resolveMusicTrackForCategory = (value, category = "", musicCategories = {}) => {
  const token = musicToken(value);
  if (!token) return "";
  const entries = category && musicCategories[category]
    ? [[category, musicCategories[category]]]
    : Object.entries(musicCategories);
  for (const [, trackList] of entries) {
    const match = trackList.find((track) =>
      [track.file, track.name, track.id, track.value].map(musicToken).includes(token)
    );
    if (match?.file) return match.file;
  }
  return String(value || "").trim();
};

const resolveSavedMusicState = (source = {}, fallback = {}, musicCategories = {}) => {
  const transitionMusic = source.transitionMusic && typeof source.transitionMusic === "object"
    ? source.transitionMusic
    : {};
  const musicSelections = source.musicSelections && typeof source.musicSelections === "object"
    ? source.musicSelections
    : {};
  const selectedMusic = source.selectedMusic && typeof source.selectedMusic === "object"
    ? source.selectedMusic
    : {};
  const hasMusicFields =
    "introMusic" in source ||
    "introTrack" in source ||
    "bodyMusic" in source ||
    "bodyTrack" in source ||
    "outroMusic" in source ||
    "outroTrack" in source ||
    "intro_music" in source ||
    "body_music" in source ||
    "outro_music" in source ||
    "category" in source ||
    "musicCategory" in source ||
    "music_category" in source ||
    "transitionMusicCategory" in source ||
    Object.keys(transitionMusic).length > 0 ||
    Object.keys(musicSelections).length > 0 ||
    Object.keys(selectedMusic).length > 0;

  if (!hasMusicFields) {
    return {
      introMusic: fallback.introMusic || "",
      bodyMusic: fallback.bodyMusic || "",
      outroMusic: fallback.outroMusic || "",
      category: fallback.category || "",
    };
  }

  const rawTracks = {
    introMusic: resolveMusicTrackValue(
      source.introMusic ?? source.introTrack ?? source.intro_music ?? transitionMusic.introMusic ?? transitionMusic.intro ?? transitionMusic.introTrack ?? musicSelections.introMusic ?? musicSelections.intro ?? musicSelections.introTrack ?? selectedMusic.introMusic ?? selectedMusic.intro ?? selectedMusic.introTrack
    ),
    bodyMusic: resolveMusicTrackValue(
      source.bodyMusic ?? source.bodyTrack ?? source.body_music ?? transitionMusic.bodyMusic ?? transitionMusic.body ?? transitionMusic.bodyTrack ?? musicSelections.bodyMusic ?? musicSelections.body ?? musicSelections.bodyTrack ?? selectedMusic.bodyMusic ?? selectedMusic.body ?? selectedMusic.bodyTrack
    ),
    outroMusic: resolveMusicTrackValue(
      source.outroMusic ?? source.outroTrack ?? source.outro_music ?? transitionMusic.outroMusic ?? transitionMusic.outro ?? transitionMusic.outroTrack ?? musicSelections.outroMusic ?? musicSelections.outro ?? musicSelections.outroTrack ?? selectedMusic.outroMusic ?? selectedMusic.outro ?? selectedMusic.outroTrack
    ),
  };
  const rawCategory = firstText(
    source.category,
    source.musicCategory,
    source.music_category,
    source.transitionMusicCategory,
    source.transition_music_category,
    transitionMusic.category,
    musicSelections.category,
    selectedMusic.category,
    fallback.category
  );

  const resolvedCategory = findMusicCategoryForTracks(rawTracks, rawCategory, musicCategories);
  return {
    introMusic: resolveMusicTrackForCategory(rawTracks.introMusic, resolvedCategory, musicCategories),
    bodyMusic: resolveMusicTrackForCategory(rawTracks.bodyMusic, resolvedCategory, musicCategories),
    outroMusic: resolveMusicTrackForCategory(rawTracks.outroMusic, resolvedCategory, musicCategories),
    category: resolvedCategory,
  };
};

const DEFAULT_VOICE_LANGUAGE = "en";
const VOICE_LANGUAGE_OPTIONS = ["en", "ar"];
const LANGUAGE_LABELS = {
  en: { flagCode: "gb", name: "English" },
  "en-us": { flagCode: "gb", name: "English" },
  "en-gb": { flagCode: "gb", name: "English" },
  zh: { flagCode: "cn", name: "Chinese" },
  "zh-cn": { flagCode: "cn", name: "Chinese" },
  cmn: { flagCode: "cn", name: "Chinese" },
  yue: { flagCode: "cn", name: "Chinese" },
  ar: { flagCode: "sa", name: "Arabic" },
  "ar-sa": { flagCode: "sa", name: "Arabic" },
  fr: { flagCode: "fr", name: "French" },
  es: { flagCode: "es", name: "Spanish" },
  de: { flagCode: "de", name: "German" },
  it: { flagCode: "it", name: "Italian" },
  ja: { flagCode: "jp", name: "Japanese" },
  ko: { flagCode: "kr", name: "Korean" },
  pt: { flagCode: "pt", name: "Portuguese" },
  "pt-br": { flagCode: "pt", name: "Portuguese" },
  hi: { flagCode: "in", name: "Hindi" },
  ms: { flagCode: "my", name: "Malay" },
  nl: { flagCode: "nl", name: "Dutch" },
  pl: { flagCode: "pl", name: "Polish" },
  ru: { flagCode: "ru", name: "Russian" },
  tr: { flagCode: "tr", name: "Turkish" },
  sv: { flagCode: "se", name: "Swedish" },
  no: { flagCode: "no", name: "Norwegian" },
  da: { flagCode: "dk", name: "Danish" },
  fi: { flagCode: "fi", name: "Finnish" },
  id: { flagCode: "id", name: "Indonesian" },
  vi: { flagCode: "vn", name: "Vietnamese" },
  th: { flagCode: "th", name: "Thai" },
  fil: { flagCode: "ph", name: "Filipino" },
  tl: { flagCode: "ph", name: "Filipino" },
  uk: { flagCode: "ua", name: "Ukrainian" },
  cs: { flagCode: "cz", name: "Czech" },
  el: { flagCode: "gr", name: "Greek" },
  hu: { flagCode: "hu", name: "Hungarian" },
  ro: { flagCode: "ro", name: "Romanian" },
  bg: { flagCode: "bg", name: "Bulgarian" },
  hr: { flagCode: "hr", name: "Croatian" },
  sk: { flagCode: "sk", name: "Slovak" },
  ta: { flagCode: "in", name: "Tamil" },
  bn: { flagCode: "bd", name: "Bengali" },
  ur: { flagCode: "pk", name: "Urdu" },
  fa: { flagCode: "ir", name: "Persian" },
  he: { flagCode: "il", name: "Hebrew" },
};
const LANGUAGE_NAME_TO_CODE = Object.entries(LANGUAGE_LABELS).reduce((acc, [code, info]) => {
  acc[info.name.toLowerCase()] = code.split("-")[0];
  return acc;
}, {});

const normalizeLanguageFilterValue = (value) => {
  const raw = String(value || "").trim().toLowerCase().replace("_", "-");
  if (!raw) return "";
  if (raw === "arabic" || raw.startsWith("arabic ") || raw.startsWith("arabic(")) return "ar";
  if (raw === "english" || raw.startsWith("english ") || raw.startsWith("english(")) return "en";
  if (LANGUAGE_NAME_TO_CODE[raw]) return LANGUAGE_NAME_TO_CODE[raw];
  if (LANGUAGE_LABELS[raw]) return raw.split("-")[0];
  const base = raw.split("-")[0];
  return LANGUAGE_LABELS[base] ? base : raw;
};

const formatLanguageLabel = (value) => {
  const normalized = normalizeLanguageFilterValue(value);
  const info = LANGUAGE_LABELS[normalized] || LANGUAGE_LABELS[String(value || "").trim().toLowerCase()];
  if (info) return info.name;
  const fallback = String(value || "").trim();
  if (!fallback) return "";
  return fallback
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const getLanguageDisplay = (value) => {
  const normalized = normalizeLanguageFilterValue(value);
  const info = LANGUAGE_LABELS[normalized] || LANGUAGE_LABELS[String(value || "").trim().toLowerCase()];
  return {
    flagCode: info?.flagCode || "",
    name: info?.name || formatLanguageLabel(value),
  };
};

const LanguageLabel = ({ value }) => {
  const info = getLanguageDisplay(value);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {info.flagCode ? (
        <span className={`wecast-language-flag wecast-language-flag-${info.flagCode}`} aria-hidden="true" />
      ) : null}
      <span className="truncate">{info.name}</span>
    </span>
  );
};

const uniqueLanguageOptions = () => VOICE_LANGUAGE_OPTIONS;

const uniqueSortedDisplay = (values) =>
  Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );

const normalizeCategoryLabelKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");

const VOICE_ROLE_CATEGORIES = [
  { value: "podcast_host", label: "Podcast Host", keywords: ["podcast", "podcaster", "host", "presenter", "broadcast"] },
  { value: "narrator", label: "Narrator", keywords: ["narrator", "narration", "narrative", "storyteller", "storytelling", "voiceover"] },
  { value: "teacher", label: "Teacher", keywords: ["teacher", "educator", "educational", "education", "explainer", "instructor", "tutorial"] },
  { value: "news_reader", label: "News Reader", keywords: ["news", "journalist", "anchor", "announcer", "reporter", "headline"] },
  { value: "interview_host", label: "Interview Host", keywords: ["interview", "interviewer", "conversation", "conversational", "talk show"] },
  { value: "commercial_voice", label: "Commercial Voice", keywords: ["commercial", "advertisement", "advertising", "promo", "promotional", "marketing", "brand"] },
  { value: "audiobook_voice", label: "Audiobook Voice", keywords: ["audiobook", "audio book", "book", "reading", "literary"] },
  { value: "documentary_voice", label: "Documentary Voice", keywords: ["documentary", "docuseries", "documentarian"] },
];

const VOICE_CATEGORY_LABELS = Object.fromEntries(
  VOICE_ROLE_CATEGORIES.map((category) => [category.value, category.label])
);

const formatVoiceCategoryLabel = (value) => {
  const key = normalizeCategoryLabelKey(value);
  if (VOICE_CATEGORY_LABELS[key]) return VOICE_CATEGORY_LABELS[key];
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const voiceCategoryHaystack = (voice) => {
  const labels = voice?.labels && typeof voice.labels === "object" ? voice.labels : {};
  return [
    voice?.category,
    voice?.use_case,
    voice?.useCase,
    voice?.description,
    voice?.name,
    labels.category,
    labels.Category,
    labels.use_case,
    labels.useCase,
    labels.usecase,
    labels.description,
    labels.Description,
  ]
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .map((part) => String(part || "").toLowerCase())
    .join(" ");
};

const voiceMatchesRoleCategory = (voice, categoryValue) => {
  const category = VOICE_ROLE_CATEGORIES.find((item) => item.value === normalizeCategoryLabelKey(categoryValue));
  if (!category) return true;
  const haystack = voiceCategoryHaystack(voice);
  return category.keywords.some((keyword) => haystack.includes(keyword));
};

const roleCategoryOptionsForVoices = (voices) =>
  VOICE_ROLE_CATEGORIES.filter((category) =>
    (voices || []).some((voice) => voiceMatchesRoleCategory(voice, category.value))
  );

const VOICE_LIBRARY_PAGE_SIZE = 100;

const emptyAppliedVoiceFilters = () => ({
  search: "",
  gender: "",
  language: DEFAULT_VOICE_LANGUAGE,
  accent: "",
  age: "",
  category: "",
  tone: "",
  pitch: "",
});

const buildLibraryUrlSearchParams = (applied, page, pageSize = VOICE_LIBRARY_PAGE_SIZE) => {
  const p = new URLSearchParams();
  p.set("provider", "ElevenLabs");
  p.set("library", "true");
  p.set("page", String(page));
  p.set("page_size", String(Math.min(100, Math.max(1, pageSize))));
  if (applied.search) p.set("search", applied.search);
  if (applied.gender) p.set("gender", applied.gender);
  if (applied.language) p.set("language", applied.language);
  if (applied.accent) p.set("accent", applied.accent);
  if (applied.age) p.set("age", applied.age);
  return p;
};

const voiceAccentDebugSummary = (voicesList, language = "ar") => {
  const matchingVoices = voicesList.filter((voice) => languageMatchesVoice(language, voice));
  return {
    totalVoices: matchingVoices.length,
    accents: Array.from(new Set(
      matchingVoices
        .flatMap((voice) => accentDisplaysForLanguageFromVoice(voice, language))
        .map((accent) => String(accent).trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
  };
};

/* -------------------- loading overlay -------------------- */
function LoadingOverlay({ show, logoSrc = "/logo.png", message }) {
  if (!show) return null;
  const safeMessage = String(message || "").replace(/[?؟]/g, "");
  const overlay = (
    <div className="wecast-overlay grid place-items-center bg-black/70 backdrop-blur-sm">
      <div className="w-[min(92vw,480px)] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl p-6">
        <div className="flex items-center gap-4">
          <img
            src={logoSrc}
            alt="WeCast logo"
            className="w-12 h-12 rounded-full animate-spin"
          />
          <div>
            <p className="font-extrabold text-black dark:text-white">{safeMessage}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Please wait a moment</p>
          </div>
        </div>
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-purple-400 to-pink-400" />
        </div>
      </div>
    </div>
  );
  const portalTarget = getPortalTarget();
  return portalTarget ? createPortal(overlay, portalTarget) : overlay;
}

/* -------------------- toast notification -------------------- */
function Toast({ toast, onClose }) {
  if (!toast) return null;
  if (!shouldShowEditingNotifications() && !["error", "warning"].includes(toast.type)) return null;
  
  const bgColor = toast.type === "error" 
    ? "bg-red-50 border-red-200 text-red-800" 
    : toast.type === "warning"
    ? "bg-yellow-50 border-yellow-200 text-yellow-800"
    : "bg-green-50 border-green-200 text-green-800";

  return (
    <div className="fixed top-4 right-4 z-[9998] animate-slide-down">
      <div className={`rounded-xl px-4 py-3 shadow-lg border ${bgColor}`}>
        <div className="flex items-start gap-2">
          {toast.type === "error" ? (
            <AlertCircle className="w-4 h-4 mt-0.5" />
          ) : toast.type === "warning" ? (
            <AlertTriangle className="w-4 h-4 mt-0.5" />
          ) : (
            <Check className="w-4 h-4 mt-0.5" />
          )}
          <div className="text-sm font-medium">{toast.message}</div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 opacity-60 hover:opacity-90"
          >
            x
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditPodcast() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  // Core podcast data
  const [podcastId, setPodcastId] = useState(null);
  const [script, setScript] = useState("");
  const [originalScript, setOriginalScript] = useState("");
  const [showTitle, setShowTitle] = useState("");
  const [originalShowTitle, setOriginalShowTitle] = useState("");
  const [scriptStyle, setScriptStyle] = useState("");
  const [podcastLanguage, setPodcastLanguage] = useState("en");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverImageFailed, setCoverImageFailed] = useState(false);
  const [speakers, setSpeakers] = useState([]);
  const [introMusic, setIntroMusic] = useState("");
  const [bodyMusic, setBodyMusic] = useState("");
  const [outroMusic, setOutroMusic] = useState("");
  const [category, setCategory] = useState("");
  
  // Original values for tracking changes
  const [originalSpeakers, setOriginalSpeakers] = useState([]);
  const [originalIntroMusic, setOriginalIntroMusic] = useState("");
  const [originalBodyMusic, setOriginalBodyMusic] = useState("");
  const [originalOutroMusic, setOriginalOutroMusic] = useState("");
  const [originalCategory, setOriginalCategory] = useState("");
  const [draftBaseline, setDraftBaseline] = useState(null);
  

  // UI states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("script");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState("");

  // Voice related - matching CreatePro
  const [voices, setVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [speakerVoiceFilters, setSpeakerVoiceFilters] = useState({});
  const [speakerVoiceAppliedFilters, setSpeakerVoiceAppliedFilters] = useState({});
  const [speakerVoiceVisibleCounts, setSpeakerVoiceVisibleCounts] = useState({});
  const [activeFilterSpeaker, setActiveFilterSpeaker] = useState(null);
  const VOICE_PAGE_SIZE = 100;

  // Music related
  const [availableTracks, setAvailableTracks] = useState([]);
  const [musicPreview, setMusicPreview] = useState(null);
  const textareaRef = useRef(null);
  const voicePreviewRef = useRef(null);
  const voicePreviewCacheRef = useRef(new Map());
  const speakerFilteredPoolsRef = useRef({});
  const [previewLoadingVoiceId, setPreviewLoadingVoiceId] = useState("");

  const [showExportMenu, setShowExportMenu] = useState(false);
  const formatDraftTime = (iso) => {
    if (!iso) return "";
    const value = new Date(iso);
    if (Number.isNaN(value.getTime())) return "";
    return value.toLocaleString();
  };
  const MUSIC_CATEGORIES = {
    dramatic: [
      { file: "Music dramatic 1.mp3", name: t("create.music.tracks.dramatic1") },
      { file: "Music dramatic 2.mp3", name: t("create.music.tracks.dramatic2") },
      { file: "Music 3 dramatic.mp3", name: t("create.music.tracks.dramatic3") },
    ],
    chill: [
      { file: "Music 1 chill.mp3", name: t("create.music.tracks.chill1") },
      { file: "Music 2 chill.mp3", name: t("create.music.tracks.chill2") },
      { file: "Music 3 chill.mp3", name: t("create.music.tracks.chill3") },
    ],
    classics: [
      { file: "Music classic 1.mp3", name: t("create.music.tracks.classic1") },
      { file: "Music classic 2.mp3", name: t("create.music.tracks.classic2") },
      { file: "Music classic 3.mp3", name: t("create.music.tracks.classic3") },
    ],
    arabic: [
      { file: "Arabic music 1.mp3", name: t("create.music.tracks.arabic1") },
      { file: "Arabic music 2.mp3", name: t("create.music.tracks.arabic2") },
      { file: "Arabic music 3.mp3", name: t("create.music.tracks.arabic3") },
    ],
  };

  // Helper function to get voice ID (matching CreatePro)
  const getVoiceId = (v) => getVoiceCatalogId(v);
 const defaultVoiceForGender = (gender, usedIds, voicesList) => {
  if (!gender) return "";
  const available = voicesList.find(v => 
    (v.gender?.toLowerCase() === gender.toLowerCase()) && 
    !usedIds.has(getVoiceId(v))
  );
  return available ? getVoiceId(available) : "";
};
  const getVoiceNameById = (voiceId, voiceList = voices) => {
    const targetId = String(voiceId || "").trim();
    if (!targetId) return "";
    const match = (voiceList || []).find((voice) => getVoiceId(voice) === targetId);
    return getVoiceDisplayName(match);
  };
  const resolveSpeakerVoiceName = (speaker = {}, voiceList = voices) => {
    const voiceId = speaker.voiceId || "";
    const catalogName = getVoiceNameById(voiceId, voiceList);
    const savedName = firstText(
      speaker.voiceName,
      speaker.voice_name,
      speaker.selectedVoiceName,
      speaker.selected_voice_name,
      speaker.voiceLabel,
      speaker.voice_label,
      speaker.displayVoiceName,
      speaker.display_voice_name
    );
    if (catalogName && !isGeneratedVoiceFallback(catalogName, voiceId)) return catalogName;
    if (savedName && !isGeneratedVoiceFallback(savedName, voiceId)) return savedName;
    return voiceId ? "Selected voice" : "";
  };
  const enrichSpeakersWithVoiceNames = (speakerList = speakers, voiceList = voices) =>
    (Array.isArray(speakerList) ? speakerList : []).map((speaker) => {
      const voiceName = resolveSpeakerVoiceName(speaker, voiceList);
      return {
        ...speaker,
        voiceName,
      };
    });
  const buildEditableSnapshot = ({
    nextShowTitle = showTitle,
    nextScript = script,
    nextSpeakers = speakers,
    nextIntroMusic = introMusic,
    nextBodyMusic = bodyMusic,
    nextOutroMusic = outroMusic,
    nextCategory = category,
  } = {}) => ({
    showTitle: String(nextShowTitle || ""),
    script: String(nextScript || ""),
    speakers: Array.isArray(nextSpeakers) ? nextSpeakers : [],
    introMusic: String(nextIntroMusic || ""),
    bodyMusic: String(nextBodyMusic || ""),
    outroMusic: String(nextOutroMusic || ""),
    category: String(nextCategory || ""),
  });

const [showFinalizeWarning, setShowFinalizeWarning] = useState(false);
const resolvedCoverSrc = useMemo(
  () => (!coverImageFailed && coverUrl ? coverUrl : ""),
  [coverImageFailed, coverUrl]
);

const willRegenerateAudio = useCallback(() => {
  const updatedScript = applyShowTitleToScript(
    applySpeakerLabelRenames(script, originalSpeakers, speakers),
    showTitle
  );
  
  return (
    updatedScript !== String(originalScript || "") ||
    !speakersEqual(speakers, originalSpeakers) ||
    String(introMusic || "") !== String(originalIntroMusic || "") ||
    String(bodyMusic || "") !== String(originalBodyMusic || "") ||
    String(outroMusic || "") !== String(originalOutroMusic || "")
  );
}, [script, originalScript, speakers, originalSpeakers, introMusic, originalIntroMusic, bodyMusic, originalBodyMusic, outroMusic, originalOutroMusic, showTitle]);
  const applyShowTitleToScript = (inputScript, nextShowTitle) =>
    String(inputScript || "").replace(/\{\{SHOW_TITLE\}\}/g, String(nextShowTitle || "").trim());

  // Load podcast data from API (NO MOCK DATA)
  useEffect(() => {
    const loadPodcastData = async () => {
      try {
        setLoading(true);
        
        const editData = JSON.parse(sessionStorage.getItem("editData") || "{}");
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = getHashSearchParams();
        const idFromUrl = urlParams.get("id") || hashParams.get("id");
        const id = editData.podcastId || idFromUrl;
        
        if (!id) {
          setToast({ type: "error", message: "No podcast ID found" });
          setLoading(false);
          return;
        }
        
        setPodcastId(id);

        // REAL API CALL
        const res = await fetch(`${API_BASE}/api/podcast/${encodeURIComponent(id)}`, {
          credentials: "include",
          headers: {
            ...getAuthHeaders(),
          }
        });

        if (!res.ok) {
          const errorData = await parseJsonResponse(res);
          throw new Error(errorData.error || `Failed to load podcast: ${res.status}`);
        }
        
        const data = await parseJsonResponse(res);
        console.log("Loaded podcast data:", data);

        const resolvedBaseTitle = data.showTitle || data.title || "Untitled Episode";
        const baseMusicState = resolveSavedMusicState(data, {}, MUSIC_CATEGORIES);
        const baseState = {
          script: applyShowTitleToScript(data.script || "", resolvedBaseTitle),
          showTitle: data.showTitle || data.title || "Untitled Episode",
          speakers: normalizeSavedSpeakers(data.speakers),
          ...baseMusicState,
        };
        const draftState = data.editDraft
          ? {
              ...data.editDraft,
              speakers: Array.isArray(data.editDraft.speakers)
                ? normalizeSavedSpeakers(data.editDraft.speakers)
                : baseState.speakers,
              ...resolveSavedMusicState(data.editDraft, baseMusicState, MUSIC_CATEGORIES),
              script: applyShowTitleToScript(
                data.editDraft.script || "",
                data.editDraft.showTitle || resolvedBaseTitle
              ),
            }
          : null;
        const nextState = draftState ? { ...baseState, ...draftState } : baseState;

        setScript(nextState.script);
        setOriginalScript(baseState.script);
        setShowTitle(nextState.showTitle);
        setOriginalShowTitle(baseState.showTitle);
        setScriptStyle(data.scriptStyle || "");
        setPodcastLanguage(data.language || "en");
        setCoverImageFailed(false);
        setCoverUrl(data.coverUrl || "");
        setSpeakers(nextState.speakers);
        setOriginalSpeakers(baseState.speakers);
        setIntroMusic(nextState.introMusic);
        setOriginalIntroMusic(baseState.introMusic);
        setBodyMusic(nextState.bodyMusic);
        setOriginalBodyMusic(baseState.bodyMusic);
        setOutroMusic(nextState.outroMusic);
        setOriginalOutroMusic(baseState.outroMusic);
        setCategory(nextState.category);
        setOriginalCategory(baseState.category);
        setAvailableTracks(MUSIC_CATEGORIES[nextState.category] || []);
        setDraftRestored(Boolean(draftState));
        setDraftSavedAt(draftState?.savedAt || "");
        setDraftBaseline(buildEditableSnapshot({
          nextShowTitle: nextState.showTitle,
          nextScript: nextState.script,
          nextSpeakers: nextState.speakers,
          nextIntroMusic: nextState.introMusic,
          nextBodyMusic: nextState.bodyMusic,
          nextOutroMusic: nextState.outroMusic,
          nextCategory: nextState.category,
        }));
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error("Error loading podcast:", error);
        setToast({ type: "error", message: error.message || "Failed to load podcast data" });
      } finally {
        setLoading(false);
      }
    };


    loadPodcastData();
  }, []);

  // Add this after the data loading useEffect
useEffect(() => {
  if (speakers.length > 0 && script && originalSpeakers.length > 0) {
    // Check if any speaker in the script doesn't match the speakers array
    const scriptLines = script.split('\n');
    const scriptSpeakers = new Set();
    
    scriptLines.forEach(line => {
      const match = line.match(/^([^:]+):/);
      if (match && match[1]) {
        scriptSpeakers.add(match[1].trim());
      }
    });
    
    const speakerNames = new Set(speakers.map(s => s.name));
    const originalSpeakerNames = new Set(originalSpeakers.map(s => s.name));
    
    console.log("Speakers in speakers array:", Array.from(speakerNames));
    console.log("Speakers in script:", Array.from(scriptSpeakers));
    console.log("Original speakers:", Array.from(originalSpeakerNames));
    
    // If there's a mismatch, log it
    scriptSpeakers.forEach(speaker => {
      if (!speakerNames.has(speaker) && speaker !== '') {
        console.warn(`Speaker "${speaker}" in script not found in speakers array`);
      }
    });
  }
}, [speakers, script, originalSpeakers]);

  // Load voices once per session from shared catalog cache (same source as CreatePro).
  useEffect(() => {
    let cancelled = false;

    async function loadVoices() {
      try {
        setLoadingVoices(true);

        const fetchLibraryPage = async (applied, page = 0, pageSize = VOICE_LIBRARY_PAGE_SIZE) => {
          const params = buildLibraryUrlSearchParams(applied, page, pageSize);
          const res = await fetch(`${API_BASE}/api/voices/elevenlabs?${params.toString()}`, {
            credentials: "include",
            headers: getAuthHeaders(),
          });
          const data = await parseJsonResponse(res);
          if (!res.ok) throw new Error(data?.error || `Failed to load voices (${res.status})`);
          return {
            items: Array.isArray(data?.items) ? data.items : [],
            has_more: Boolean(data?.has_more),
          };
        };

        const raw = await ensureVoiceLibraryCatalog({
          fetchSeedPage: () => fetchLibraryPage(emptyAppliedVoiceFilters()),
          fetchPageForAgeBuckets: fetchLibraryPage,
          fetchAccountVoices: async () => {
            const params = new URLSearchParams();
            params.set("provider", "ElevenLabs");
            params.set("limit", "500");
            const res = await fetch(`${API_BASE}/api/voices?${params.toString()}`, {
              credentials: "include",
              headers: getAuthHeaders(),
            });
            const data = await parseJsonResponse(res);
            if (!res.ok) return [];
            return Array.isArray(data?.items) ? data.items : Array.isArray(data?.voices) ? data.voices : [];
          },
          fetchFallbackVoices: async () => {
            const params = new URLSearchParams();
            params.set("provider", "ElevenLabs");
            params.set("limit", "500");
            const res = await fetch(`${API_BASE}/api/voices?${params.toString()}`, {
              credentials: "include",
              headers: getAuthHeaders(),
            });
            const data = await parseJsonResponse(res);
            if (!res.ok) throw new Error(data?.error || `Fallback voices failed (${res.status})`);
            return Array.isArray(data?.items) ? data.items : Array.isArray(data?.voices) ? data.voices : [];
          },
        });

        if (cancelled) return;

        if (typeof window !== "undefined" && window.localStorage?.getItem("wecastVoiceFilterDebug") === "1") {
          console.debug("[WeCast voice filters] Edit Arabic summary", voiceAccentDebugSummary(raw, "ar"));
          console.debug("[WeCast voice filters] Edit tone/pitch summary", buildTonePitchDebugMatrix(raw));
          console.debug("[WeCast voice filters] Edit age summary", buildVoiceAgeDebugSummary(raw));
        }

        setVoices(raw);
      } catch (e) {
        console.error("Failed to load voices", e);
        if (!cancelled) setVoices([]);
      } finally {
        if (!cancelled) setLoadingVoices(false);
      }
    }

    loadVoices();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!voices.length) return;
    setSpeakers((prev) => {
      let changed = false;
      const next = prev.map((speaker) => {
        const voiceId = speaker.voiceId || "";
        const resolvedName = resolveSpeakerVoiceName(speaker, voices);
        const currentName = firstText(
          speaker.voiceName,
          speaker.voice_name,
          speaker.selectedVoiceName,
          speaker.selected_voice_name
        );
        if (!voiceId || !resolvedName || resolvedName === currentName) return speaker;
        if (currentName && !isGeneratedVoiceFallback(currentName, voiceId)) return speaker;
        changed = true;
        return { ...speaker, voiceName: resolvedName };
      });
      return changed ? next : prev;
    });
  }, [voices]);

  // Keep applied filters aligned with speakers (same default as Create Podcast).
  useEffect(() => {
    setSpeakerVoiceAppliedFilters((prev) => {
      const next = { ...prev };
      let changed = false;
      speakers.forEach((speaker, index) => {
        if (!next[index]) {
          next[index] = appliedVoiceFiltersForSpeakerGender(speaker);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [speakers]);

  const computeFilteredPoolForSpeaker = useCallback(
    (speakerIndex, appliedOverride) => {
      const speaker = speakers?.[speakerIndex];
      const applied =
        appliedOverride ||
        speakerVoiceAppliedFilters[speakerIndex] ||
        appliedVoiceFiltersForSpeakerGender(speaker);
      const pool = getStrictFilteredVoicePool(voices, applied);
      speakerFilteredPoolsRef.current[speakerIndex] = pool;
      return pool;
    },
    [speakerVoiceAppliedFilters, speakers, voices]
  );

  useEffect(() => {
    if (!voices.length || !speakers.length) return;
    const voiceUpdates = [];
    speakers.forEach((speaker, index) => {
      const pool = computeFilteredPoolForSpeaker(index);
      const kept = pickVoiceIdFromFilteredPool(speaker.voiceId, pool);
      const nextId = kept || firstVoiceIdFromPool(pool);
      if ((speaker.voiceId || "") !== (nextId || "")) {
        voiceUpdates.push({ index, voiceId: nextId });
      }
    });
    if (voiceUpdates.length) {
      setSpeakers((prev) => {
        const next = [...prev];
        voiceUpdates.forEach(({ index, voiceId }) => {
          next[index] = {
            ...next[index],
            voiceId,
            voiceName: voiceId ? getVoiceNameById(voiceId) : "",
          };
        });
        return next;
      });
    }
  }, [voices, speakers, speakerVoiceAppliedFilters, computeFilteredPoolForSpeaker]);

  /** Dropdown options = strict filtered pool only (same list as modal count). */
  const getFilteredVoicesForSpeaker = useCallback(
    (speakerIndex) => {
      const cached = speakerFilteredPoolsRef.current[speakerIndex];
      if (Array.isArray(cached)) return cached;
      return computeFilteredPoolForSpeaker(speakerIndex);
    },
    [computeFilteredPoolForSpeaker]
  );

  const activeModalFilters =
    activeFilterSpeaker !== null
      ? speakerVoiceFilters[activeFilterSpeaker] || DEFAULT_MODAL_VOICE_FILTERS
      : DEFAULT_MODAL_VOICE_FILTERS;

  const getEditModalFilterCount = useCallback(() => {
    if (activeFilterSpeaker === null) return 0;
    const speaker = speakers?.[activeFilterSpeaker];
    const draft = speakerVoiceFilters[activeFilterSpeaker] || DEFAULT_MODAL_VOICE_FILTERS;
    return refineVoicesForSpeakerModalFilters(voices, draft, speaker).length;
  }, [activeFilterSpeaker, speakerVoiceFilters, speakers, voices]);

  const editVoiceFilterPreview = useVoiceFilterModalPreview({
    enabled: activeFilterSpeaker !== null,
    filters: activeModalFilters,
    getCount: getEditModalFilterCount,
  });

  // Preview voice (matching CreatePro)
  const previewVoice = async (voiceId, voiceObj = null) => {
    if (!voiceId) {
      setToast({ type: "warning", message: "Please select a voice first" });
      setTimeout(() => setToast(null), 2500);
      return;
    }

    try {
      setPreviewLoadingVoiceId(voiceId);
      if (voicePreviewRef.current) {
        voicePreviewRef.current.pause();
      }

      const directUrl = String(voiceObj?.preview_url || voiceObj?.previewUrl || "").trim();
      if (directUrl) {
        const audio = new Audio(directUrl);
        voicePreviewRef.current = audio;
        await audio.play();
        return;
      }

      const cachedUrl = voicePreviewCacheRef.current.get(voiceId);
      if (cachedUrl) {
        const cachedAudio = new Audio(cachedUrl);
        voicePreviewRef.current = cachedAudio;
        await cachedAudio.play();
        setPreviewLoadingVoiceId("");
        return;
      }

      const res = await fetch(`${API_BASE}/api/voices/preview`, {
        method: "POST",
        credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
        },
        body: JSON.stringify({
          voiceId,
          text: "Hi, this is a WeCast sample.",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setToast({ type: "error", message: err?.error || "Preview failed" });
        setTimeout(() => setToast(null), 3000);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      voicePreviewRef.current = audio;
      voicePreviewCacheRef.current.set(voiceId, url);
      await audio.play();
    } catch (e) {
      console.error(e);
      setToast({ type: "error", message: "Preview failed" });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setPreviewLoadingVoiceId("");
    }
  };
// Track unsaved changes
useEffect(() => {
  const baseline = draftBaseline || buildEditableSnapshot({
    nextShowTitle: originalShowTitle,
    nextScript: originalScript,
    nextSpeakers: originalSpeakers,
    nextIntroMusic: originalIntroMusic,
    nextBodyMusic: originalBodyMusic,
    nextOutroMusic: originalOutroMusic,
    nextCategory: originalCategory,
  });
  const current = buildEditableSnapshot();
  const hasChanges =
    current.showTitle !== baseline.showTitle ||
    current.script !== baseline.script ||
    JSON.stringify(current.speakers) !== JSON.stringify(baseline.speakers) ||
    current.category !== baseline.category ||
    current.introMusic !== baseline.introMusic ||
    current.bodyMusic !== baseline.bodyMusic ||
    current.outroMusic !== baseline.outroMusic;
  
  setHasUnsavedChanges(hasChanges);
}, [showTitle, script, speakers, category, introMusic, bodyMusic, outroMusic, draftBaseline, originalShowTitle, originalScript, originalSpeakers, originalCategory, originalIntroMusic, originalBodyMusic, originalOutroMusic]);
  // Before unload warning
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const previewCache = voicePreviewCacheRef.current;
    return () => {
      if (voicePreviewRef.current) {
        voicePreviewRef.current.pause();
        voicePreviewRef.current = null;
      }
      for (const url of previewCache.values()) {
        URL.revokeObjectURL(url);
      }
      previewCache.clear();
    };
  }, []);

  useEffect(() => {
    setSpeakerVoiceVisibleCounts((prev) => {
      const next = { ...prev };
      speakers.forEach((_, i) => {
        if (!next[i]) next[i] = VOICE_PAGE_SIZE;
      });
      Object.keys(next).forEach((k) => {
        const idx = Number(k);
        if (idx >= speakers.length) delete next[k];
      });
      return next;
    });
  }, [speakers.length]);

  const handleNavigation = (path) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(path);
      setShowExitWarning(true);
    } else {
      window.location.hash = path;
    }
  };

  const confirmNavigation = async () => {
    const targetPath = pendingNavigation || "#/create?from=studio";
    setShowExitWarning(false);
    if (podcastId && (draftRestored || hasUnsavedChanges)) {
      try {
        await apiFetch(`/api/podcast/${encodeURIComponent(podcastId)}/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "discard_draft" }),
        });
      } catch (error) {
        console.error("Failed to discard draft:", error);
      }
    }
    setDraftRestored(false);
    setDraftSavedAt("");
    setPendingNavigation(null);
    window.location.hash = targetPath;
  };

  const saveDraftLocally = async ({ navigateTo } = {}) => {
    if (!podcastId) return;

    try {
      setSaving(true);
      const updatedScript = applyShowTitleToScript(
        applySpeakerLabelRenames(script, originalSpeakers, speakers),
        showTitle
      );
      const speakersForSave = enrichSpeakersWithVoiceNames(speakers);
      const data = await apiFetch(`/api/podcast/${encodeURIComponent(podcastId)}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "draft",
          script: updatedScript,
          speakers: speakersForSave,
          introMusic,
          bodyMusic,
          outroMusic,
          category,
          musicSelections: {
            category,
            introTrack: introMusic,
            bodyTrack: bodyMusic,
            outroTrack: outroMusic,
          },
          transitionMusic: {
            category,
            introTrack: introMusic,
            bodyTrack: bodyMusic,
            outroTrack: outroMusic,
          },
          showTitle,
          scriptStyle,
          description: "",
        }),
      });

      const savedSnapshot = buildEditableSnapshot({
        nextShowTitle: showTitle,
        nextScript: updatedScript,
        nextSpeakers: speakersForSave,
        nextIntroMusic: introMusic,
        nextBodyMusic: bodyMusic,
        nextOutroMusic: outroMusic,
        nextCategory: category,
      });
      setScript(updatedScript);
      setSpeakers(speakersForSave);
      setDraftBaseline(savedSnapshot);
      setDraftRestored(true);
      setDraftSavedAt(data?.draft?.savedAt || data?.draft?.updatedAt || new Date().toISOString());
      setToast({
        type: "success",
        message: navigateTo
          ? "Draft saved to your account. You can continue editing later."
          : "Draft saved to your account. The original episode is still unchanged.",
      });
      setTimeout(() => setToast(null), 3000);

      if (navigateTo) {
        setShowExitWarning(false);
        setPendingNavigation(null);
        window.location.hash = navigateTo;
      }
    } catch (error) {
      setToast({ type: "error", message: requestErrorMessage(error, "Failed to save draft") });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const restoreOriginalVersion = async () => {
    setShowTitle(originalShowTitle);
    setScript(originalScript);
    setSpeakers(originalSpeakers);
    setIntroMusic(originalIntroMusic);
    setBodyMusic(originalBodyMusic);
    setOutroMusic(originalOutroMusic);
    setCategory(originalCategory);
    setAvailableTracks(MUSIC_CATEGORIES[originalCategory] || []);
    setIsEditingTitle(false);
    setDraftTitle(originalShowTitle);
    if (podcastId) {
      try {
        await apiFetch(`/api/podcast/${encodeURIComponent(podcastId)}/update`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "discard_draft" }),
        });
      } catch (error) {
        console.error("Failed to discard draft:", error);
      }
    }
    setDraftRestored(false);
    setDraftSavedAt("");
    setDraftBaseline(buildEditableSnapshot({
      nextShowTitle: originalShowTitle,
      nextScript: originalScript,
      nextSpeakers: originalSpeakers,
      nextIntroMusic: originalIntroMusic,
      nextBodyMusic: originalBodyMusic,
      nextOutroMusic: originalOutroMusic,
      nextCategory: originalCategory,
    }));
    setToast({
      type: "success",
      message: "Restored the original version. Draft edits were removed.",
    });
    setTimeout(() => setToast(null), 3000);
  };

const applySpeakerLabelRenames = (inputScript, oldSpeakers, newSpeakers) => {
  const changes = [];

  (newSpeakers || []).forEach((sp, idx) => {
    const oldName = String(oldSpeakers?.[idx]?.name || "").trim();
    const newName = String(sp?.name || "").trim();
    if (!oldName || !newName || oldName === newName) return;
    changes.push({ oldName, newName, oldKey: oldName.toLowerCase() });
  });

  if (!changes.length) return inputScript;

  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sortedChanges = [...changes].sort((a, b) => b.oldName.length - a.oldName.length);
  const nameLookup = new Map(sortedChanges.map((c) => [c.oldName.toLowerCase(), c.newName]));
  const namesAlternation = sortedChanges.map((c) => escapeRegex(c.oldName)).join("|");
  const mentionPattern = namesAlternation
    ? new RegExp(`(^|[^A-Za-z0-9_])(${namesAlternation})(?=$|[^A-Za-z0-9_])`, "gi")
    : null;

  const replaceMentions = (text) => {
    if (!mentionPattern) return text;
    return String(text || "").replace(mentionPattern, (_, lead, matchedName) => {
      const replacement = nameLookup.get(String(matchedName || "").toLowerCase());
      return `${lead}${replacement || matchedName}`;
    });
  };

  const lines = String(inputScript || "").split("\n");
  const updatedLines = lines.map((line) => {
    // Keep speaker labels at line start in sync: "Speaker Name: ..."
    const match = line.match(/^(\s*)([^:\n]+?)(\s*:\s*.*)$/);
    if (!match) return replaceMentions(line);

    const [, leading, rawLabel, rest] = match;
    const normalizedLabel = rawLabel.trim().toLowerCase();
    const labelChange = sortedChanges.find((c) => c.oldKey === normalizedLabel);
    const nextLabel = labelChange ? labelChange.newName : rawLabel.trim();
    const nextRest = replaceMentions(rest);

    return `${leading}${nextLabel}${nextRest}`;
  });

  return updatedLines.join("\n");
};

const speakersEqual = (left, right) =>
  JSON.stringify(Array.isArray(left) ? left : []) === JSON.stringify(Array.isArray(right) ? right : []);

const persistChanges = async ({
  nextScript,
  nextSpeakers,
  nextShowTitle = showTitle,
  nextCategory = category,
  successMessage = "Updates applied successfully!",
  regenerateAfterSave = true,
}) => {
  const resolvedScript = String(nextScript || "");
  const resolvedSpeakers = enrichSpeakersWithVoiceNames(
    Array.isArray(nextSpeakers) ? nextSpeakers : speakers
  );

  const responseData = await apiFetch(`/api/podcast/${encodeURIComponent(podcastId)}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "final",
        script: resolvedScript,
        speakers: resolvedSpeakers,
        introMusic,
        bodyMusic,
        outroMusic,
        category: nextCategory,
        musicSelections: {
          category: nextCategory,
          introTrack: introMusic,
          bodyTrack: bodyMusic,
          outroTrack: outroMusic,
        },
        transitionMusic: {
          category: nextCategory,
          introTrack: introMusic,
          bodyTrack: bodyMusic,
          outroTrack: outroMusic,
        },
        showTitle: nextShowTitle,
        scriptStyle,
        description: "",
      }),
    });

    console.log("Save response:", responseData);

    if (String(nextShowTitle || "").trim()) {
      await apiFetch(`/api/podcasts/${encodeURIComponent(podcastId)}/title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextShowTitle }),
      });
    }

    setOriginalScript(resolvedScript);
    setScript(resolvedScript);
    setOriginalShowTitle(nextShowTitle);
    setShowTitle(nextShowTitle);
    setOriginalSpeakers(resolvedSpeakers);
    setOriginalIntroMusic(introMusic);
    setOriginalBodyMusic(bodyMusic);
    setOriginalOutroMusic(outroMusic);
    setOriginalCategory(nextCategory);
    setDraftBaseline(buildEditableSnapshot({
      nextShowTitle,
      nextScript: resolvedScript,
      nextSpeakers: resolvedSpeakers,
      nextIntroMusic: introMusic,
      nextBodyMusic: bodyMusic,
      nextOutroMusic: outroMusic,
      nextCategory: nextCategory,
    }));
    setHasUnsavedChanges(false);
    setDraftRestored(false);
    setDraftSavedAt("");

    if (regenerateAfterSave) {
      setToast({
        type: "info",
        message: "Updates saved. Regenerating the episode audio now...",
      });
      await regenerateAudio({
        scriptOverride: resolvedScript,
        speakersOverride: resolvedSpeakers,
        successMessage,
        failureMessage: "Updates were saved, but audio regeneration failed. Please check the backend connection and try Regenerate again.",
      });
    } else {
      setToast({ type: "success", message: successMessage });
    }
};

const finalizeChanges = async () => {
  if (!podcastId) return;

  setSaving(true);
  try {
    const updatedScript = applyShowTitleToScript(
      applySpeakerLabelRenames(script, originalSpeakers, speakers),
      showTitle
    );

    console.log("Saving to API:", {
      podcastId,
      scriptLength: updatedScript.length,
      speakersCount: speakers.length
    });

    const shouldRegenerateAudio =
      updatedScript !== String(originalScript || "") ||
      !speakersEqual(speakers, originalSpeakers) ||
      String(introMusic || "") !== String(originalIntroMusic || "") ||
      String(bodyMusic || "") !== String(originalBodyMusic || "") ||
      String(outroMusic || "") !== String(originalOutroMusic || "");

    await persistChanges({
      nextScript: updatedScript,
      nextSpeakers: enrichSpeakersWithVoiceNames(speakers),
      nextShowTitle: showTitle,
      nextCategory: category,
      regenerateAfterSave: shouldRegenerateAudio,
      successMessage: shouldRegenerateAudio
        ? "Updates applied. Audio regenerated to match your latest edits."
        : "Updates applied successfully.",
    });

    setTimeout(() => setToast(null), 3000);
  } catch (error) {
    console.error("Save error:", error);
    setToast({ type: "error", message: requestErrorMessage(error, "Failed to save updates") });
  } finally {
    setSaving(false);
  }
};

  // Regenerate audio
  const regenerateAudio = async ({
    scriptOverride,
    speakersOverride,
    successMessage = "Audio generated successfully!",
    failureMessage = "Failed to generate audio",
  } = {}) => {
    if (!podcastId) return false;

    const resolvedScript = String(scriptOverride ?? script);
    const resolvedSpeakers = Array.isArray(speakersOverride) ? speakersOverride : speakers;

    setGeneratingAudio(true);
    try {
      try {
        await fetch(`${API_BASE}/api/save-music`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ introMusic, bodyMusic, outroMusic }),
        });
      } catch (musicErr) {
        console.warn("Failed to sync music before audio generation", musicErr);
      }

      const res = await fetch(`${API_BASE}/api/audio`, {
        method: "POST",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          scriptText: resolvedScript,
          podcastId,
          script_style: scriptStyle,
          speakers_info: resolvedSpeakers,
          language: podcastLanguage || "en",
        }),
      });

      const data = await parseJsonResponse(res);

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to generate audio");
      }

      setToast({ type: "success", message: successMessage });
      return true;
    } catch (error) {
      console.error("Audio generation error:", error);
      setToast({ type: "warning", message: requestErrorMessage(error, failureMessage) });
      return false;
    } finally {
      setGeneratingAudio(false);
    }
  };

      // Export script as PDF with Arabic support
// Export script as PDF with Arabic support
const exportScript = async (format = "pdf") => {
  try {
    if (hasUnsavedChanges) {
      setToast({ type: "warning", message: "Please apply your updates before exporting." });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    let scriptContent = script.trim();
    let title = showTitle || "Podcast Script";
    
    if (!scriptContent) {
      setToast({ type: "warning", message: "No script content to export!" });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const exportHandler = format === "txt" ? exportScriptTxt : exportScriptPdf;

    await exportHandler({
      scriptContent,
      title,
      scriptStyle,
      fileNameBase: title,
    });
    
    setToast({ type: "success", message: `Script exported as ${format.toUpperCase()} successfully!` });
    setTimeout(() => setToast(null), 3000);
    
  } catch (error) {
    console.error("Error exporting script:", error);
    setToast({ type: "error", message: "Failed to export script. Please try again." });
    setTimeout(() => setToast(null), 3000);
  }
};


  // Script editing guards
  const onKeyDownGuard = (e) => {
    const ta = textareaRef.current;
    if (!ta) return;
    
    const { selectionStart, selectionEnd, value } = ta;
    
    if (e.key === "Delete" && selectionStart === 0 && selectionEnd === value.length) {
      e.preventDefault();
      setToast({ type: "warning", message: "Cannot delete the entire script" });
      setTimeout(() => setToast(null), 3000);
    }

    // Prevent editing speaker names (left of colon)
    const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
    const colonIdx = value.indexOf(":", lineStart);
    
    if (colonIdx !== -1 && selectionStart <= colonIdx + 1) {
      e.preventDefault();
      const safePos = colonIdx + 2;
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = Math.max(safePos, selectionStart, selectionEnd);
      });
    }
  };

  const tabs = [
    { id: "script", label: "Script", icon: <FileText className="w-4 h-4" /> },
    { id: "voices", label: "Voices", icon: <Volume2 className="w-4 h-4" /> },
    { id: "music", label: "Music", icon: <Music2 className="w-4 h-4" /> },
  ];

  const studioGlassPanelClass = "border border-purple-200/90 dark:border-purple-400/30 bg-white/78 dark:bg-neutral-900/45 backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.08)]";
  const studioGlassCardClass = "rounded-[28px] border border-purple-200/90 dark:border-purple-400/30 bg-white/74 dark:bg-neutral-900/42 backdrop-blur-md shadow-[0_12px_36px_rgba(15,23,42,0.10)]";
  const previewTitleCardClass =
    "max-w-full min-w-0 overflow-hidden rounded-[28px] border border-[#eadcf6] bg-white/78 shadow-[0_12px_36px_rgba(15,23,42,0.10)] backdrop-blur-md dark:border-[#6f5a86]/30 dark:bg-neutral-900/42";
  const studioFieldClass = "border border-neutral-300/80 dark:border-white/10 bg-white/88 dark:bg-neutral-800/90 text-gray-900 dark:text-gray-100 placeholder:text-black/35 dark:placeholder:text-white/35 caret-black dark:caret-white shadow-sm focus:ring-2 focus:ring-purple-500/35 focus:border-purple-400/50";

  const initialLoadMessage = useMemo(() => {
    try {
      const editData = JSON.parse(sessionStorage.getItem("editData") || "{}");
      return editData.podcastId ? "Restoring saved episode..." : "Loading podcast...";
    } catch {
      return "Loading podcast...";
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream dark:bg-[#0a0a1a] flex items-center justify-center">
        <LoadingOverlay show={true} message={initialLoadMessage} />
      </div>
    );
  }

 return (
    <div className="min-h-screen overflow-x-clip bg-white/35 dark:bg-neutral-900/20 text-black dark:text-white">
      {/* Header */}
      <LoadingOverlay
        show={generatingAudio}
        message="Generating audio..."
      />
      <main className="w-full max-w-full border-b border-purple-200/90 dark:border-purple-400/30 bg-white/35 dark:bg-neutral-900/20">
      <div className="w-full border-b border-purple-200/90 dark:border-purple-400/30 bg-white/35 dark:bg-neutral-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleNavigation("#/episodes")}
                className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-black dark:text-white">Edit Episode</h1>
                <p className="text-sm text-black/60 dark:text-white/60">
                  Make changes to your script, voices, and music
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {hasUnsavedChanges && (
                <span className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  unsaved changes
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-8 bg-white/35 dark:bg-neutral-900/20 sm:pt-6 sm:pb-10">
      {/* Title Card */}
      <div className="pt-2 pb-4 sm:pb-6">
        <div className={previewTitleCardClass}>
          {resolvedCoverSrc ? (
            <div className="flex min-w-0 flex-row items-stretch bg-white dark:bg-neutral-950 sm:items-start md:items-stretch">
              <div className="flex w-20 shrink-0 items-stretch justify-start overflow-hidden border-r border-black/10 bg-white p-1.5 dark:border-white/10 dark:bg-neutral-950 max-[360px]:w-16 sm:h-auto sm:w-[7.5rem] sm:p-2 md:h-auto md:w-24 md:p-0">
                <img
                  src={resolvedCoverSrc}
                  alt={`${showTitle || "Episode"} cover`}
                  className="h-full w-full object-cover object-center sm:object-contain sm:object-left md:object-cover md:object-center"
                  onError={() => setCoverImageFailed(true)}
                />
              </div>

              <div className="flex min-w-0 flex-1 items-center bg-[linear-gradient(115deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.95)_48%,rgba(250,246,253,0.92)_76%,rgba(241,234,247,0.74)_100%)] p-4 max-[360px]:p-3 sm:p-5 md:min-h-24 md:py-3 dark:bg-[linear-gradient(115deg,rgba(23,23,26,0.92)_0%,rgba(23,23,26,0.9)_46%,rgba(40,32,52,0.82)_76%,rgba(72,57,95,0.58)_100%)]">
                <div className="flex w-full min-w-0 flex-col items-start gap-2.5 sm:gap-4 sm:flex-row sm:items-center sm:justify-between md:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-black/55 dark:text-white/55 sm:text-xs">EPISODE TITLE</p>
                {!isEditingTitle ? (
                  <div className="mt-1 flex min-w-0 items-start gap-2 sm:mt-1.5 sm:items-center sm:gap-3">
                    <h2
                      dir={/[\u0600-\u06FF]/.test(showTitle || "") ? "rtl" : "ltr"}
                      className="max-w-4xl min-w-0 break-words text-lg font-semibold leading-tight text-black dark:text-white sm:text-xl"
                    >
                      {showTitle || "Untitled Episode"}
                    </h2>
                    <button
                      onClick={() => {
                        setDraftTitle(showTitle);
                        setIsEditingTitle(true);
                      }}
                      className="mt-0.5 shrink-0 rounded p-1 hover:bg-black/5 dark:hover:bg-white/10 sm:mt-0"
                    >
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                ) : (
                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className={`min-w-0 flex-[1_1_100%] rounded-lg px-3 py-1.5 text-base sm:flex-1 sm:text-lg ${studioFieldClass}`}
                      dir={/[\u0600-\u06FF]/.test(draftTitle || showTitle || "") ? "rtl" : "ltr"}
                      autoFocus
                    />
                       <button
  onClick={() => {
    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) return;

    const oldTitle = showTitle;
    const escapedOldTitle = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nextScript = applyShowTitleToScript(script, trimmedTitle);
    const newScript = oldTitle
      ? nextScript.replace(new RegExp(escapedOldTitle, 'g'), trimmedTitle)
      : nextScript;

    setShowTitle(trimmedTitle);
    setScript(newScript);
    setIsEditingTitle(false);
    setToast({
      type: "success",
      message: "Title updated in your draft. Apply updates when you're ready.",
    });
    setTimeout(() => setToast(null), 3000);
  }}
  className="flex-1 rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 sm:flex-none sm:py-1"
>
  Apply
</button>

                    <button
                      onClick={() => {
                        setDraftTitle(showTitle);
                        setIsEditingTitle(false);
                      }}
                      className="flex-1 rounded-lg border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10 sm:flex-none sm:py-1"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

                  <div className="flex max-w-full min-w-0 items-center sm:w-auto sm:justify-end">
                    <span className="inline-flex w-fit max-w-full min-w-0 items-center rounded-full border border-black/5 bg-white/75 px-2.5 py-1 text-xs leading-tight text-black/60 [overflow-wrap:anywhere] dark:border-white/10 dark:bg-white/10 dark:text-white/60 sm:px-4 sm:py-2 sm:text-sm">
                      {scriptStyle || "No style selected"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[linear-gradient(115deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.95)_48%,rgba(250,246,253,0.92)_76%,rgba(241,234,247,0.74)_100%)] p-4 sm:p-6 dark:bg-[linear-gradient(115deg,rgba(23,23,26,0.92)_0%,rgba(23,23,26,0.9)_46%,rgba(40,32,52,0.82)_76%,rgba(72,57,95,0.58)_100%)]">
              <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/70 dark:border-white/10 dark:bg-purple-900/30">
                  <Mic2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-black/55 dark:text-white/55 sm:text-xs">EPISODE TITLE</p>
                    {!isEditingTitle ? (
                      <div className="mt-1 flex min-w-0 items-start gap-2 sm:mt-1.5 sm:items-center sm:gap-3">
                        <h2
                          dir={/[\u0600-\u06FF]/.test(showTitle || "") ? "rtl" : "ltr"}
                          className="max-w-4xl min-w-0 break-words text-lg font-semibold leading-tight text-black dark:text-white sm:text-xl"
                        >
                          {showTitle || "Untitled Episode"}
                        </h2>
                        <button
                          onClick={() => {
                            setDraftTitle(showTitle);
                            setIsEditingTitle(true);
                          }}
                          className="mt-0.5 shrink-0 rounded p-1 hover:bg-black/5 dark:hover:bg-white/10 sm:mt-0"
                        >
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          className={`min-w-0 flex-[1_1_100%] rounded-lg px-3 py-1.5 text-base sm:flex-1 sm:text-lg ${studioFieldClass}`}
                          dir={/[\u0600-\u06FF]/.test(draftTitle || showTitle || "") ? "rtl" : "ltr"}
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            const trimmedTitle = draftTitle.trim();
                            if (!trimmedTitle) return;

                            const oldTitle = showTitle;
                            const escapedOldTitle = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const nextScript = applyShowTitleToScript(script, trimmedTitle);
                            const newScript = oldTitle
                              ? nextScript.replace(new RegExp(escapedOldTitle, 'g'), trimmedTitle)
                              : nextScript;

                            setShowTitle(trimmedTitle);
                            setScript(newScript);
                            setIsEditingTitle(false);
                            setToast({
                              type: "success",
                              message: "Title updated in your draft. Apply updates when you're ready.",
                            });
                            setTimeout(() => setToast(null), 3000);
                          }}
                          className="flex-1 rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 sm:flex-none sm:py-1"
                        >
                          Apply
                        </button>

                        <button
                          onClick={() => {
                            setDraftTitle(showTitle);
                            setIsEditingTitle(false);
                          }}
                          className="flex-1 rounded-lg border border-black/10 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10 sm:flex-none sm:py-1"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="inline-flex w-fit max-w-full min-w-0 items-center rounded-full border border-black/5 bg-white/75 px-2.5 py-1 text-xs leading-tight text-black/60 [overflow-wrap:anywhere] dark:border-white/10 dark:bg-white/10 dark:text-white/60 sm:px-4 sm:py-2 sm:text-sm">
                    {scriptStyle || "No style selected"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {(draftRestored || hasUnsavedChanges) && (
        <div className="pb-6">
          <div className="rounded-[20px] border border-amber-200 bg-[#fff9ee] p-4 shadow-[0_8px_18px_rgba(146,64,14,0.06)] dark:border-amber-400/20 dark:bg-[#2a2114]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                  Editing Draft
                  </p>
                  <p className="text-base font-semibold leading-tight text-[#44210f] dark:text-white">
                    The original episode stays unchanged until you apply these updates.
                  </p>
                  <p className="max-w-3xl text-sm leading-6 text-[#9a5a2b] dark:text-white/68">
                  {draftRestored && draftSavedAt
                    ? `Draft saved on ${formatDraftTime(draftSavedAt)}. Keep editing, restore the original, or apply these updates when you're ready.`
                    : "Draft ready. Keep editing, restore the original, or apply these updates when you're ready."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3 lg:justify-end">
                <button
                  type="button"
                  onClick={restoreOriginalVersion}
                  disabled={saving || generatingAudio}
                  className="min-h-10 flex-1 rounded-xl border border-amber-300/90 bg-white/88 px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-white hover:shadow-sm disabled:opacity-50 dark:border-amber-400/25 dark:bg-white/10 dark:text-amber-100 dark:hover:bg-white/14 sm:flex-none sm:rounded-2xl sm:px-5 sm:py-2.5 sm:hover:-translate-y-0.5"
                >
                  Restore Original
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs and Save Button */}
      <div>
        <div className={`${studioGlassPanelClass} rounded-[24px] px-4 py-3 sm:px-6 sm:py-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
          <nav className="flex flex-wrap gap-3 sm:gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 border-b-2 px-1 py-2.5 text-sm font-medium transition sm:gap-2 sm:py-4 ${
                  activeTab === tab.id
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-black/55 hover:text-black/75 dark:text-white/60 dark:hover:text-white"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
          
          <div className="flex flex-wrap gap-2 sm:flex-row sm:items-center sm:gap-3">
            <button
              onClick={() => {
                if (isEditingTitle) {
                  setToast({ type: "warning", message: "Apply or cancel the title draft before saving." });
                  setTimeout(() => setToast(null), 3000);
                  return;
                }
                saveDraftLocally();
              }}
              disabled={saving || generatingAudio || !hasUnsavedChanges}
              className={`min-h-10 flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition sm:flex-none sm:rounded-2xl sm:px-4 sm:py-2.5 ${
                hasUnsavedChanges
                  ? "border border-purple-300 bg-white text-purple-700 hover:bg-purple-50 dark:border-purple-400/30 dark:bg-white/5 dark:text-purple-200 dark:hover:bg-purple-900/20 sm:hover:-translate-y-0.5"
                  : "bg-black/5 text-black/35 cursor-not-allowed dark:bg-white/10 dark:text-white/40"
              }`}
            >
              <Save className="w-4 h-4" />
              {hasUnsavedChanges ? "Save Draft" : draftRestored ? "Draft Loaded" : "Save Draft"}
            </button>
            <button
  onClick={() => {
    if (isEditingTitle) {
      setToast({ type: "warning", message: "Apply or cancel the title draft before applying updates." });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    
    // Show warning if changes will trigger audio regeneration
    if (willRegenerateAudio()) {
      setShowFinalizeWarning(true);
    } else {
      // No audio regeneration needed, proceed directly
      finalizeChanges();
    }
  }}
  disabled={saving || generatingAudio || (!hasUnsavedChanges && !draftRestored)}
  className={`min-h-10 flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:flex-none sm:px-4 ${
    hasUnsavedChanges || draftRestored
      ? "bg-purple-600 text-white hover:bg-purple-700"
      : "bg-black/5 text-black/35 cursor-not-allowed dark:bg-white/10 dark:text-white/40"
  }`}
>
  <RefreshCw className="w-4 h-4" />
  {saving || generatingAudio ? "Regenerating..." : "Regenerate"}
</button>
          </div>
        </div>
      </div>


      {/* Tab Content */}
      <div className="py-6">
             {/* Script Tab */}
        {activeTab === "script" && (
          <div className="space-y-6">
            <div className="rounded-[28px] border border-purple-200/90 dark:border-purple-400/25 bg-purple-50/70 dark:bg-purple-900/10 backdrop-blur-md shadow-[0_12px_36px_rgba(15,23,42,0.08)] p-4">
              <h3 className="font-medium flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <Info className="w-4 h-4" />
                Editing Guidelines
              </h3>
              <ul className="mt-2 text-sm text-gray-600 dark:text-gray-300 list-disc pl-6 space-y-1">
                <li>Edit only the text after the colon (:) on each line</li>
                <li>Speaker names on the left are locked to maintain voice assignments</li>
                <li>Do not clear the entire script.</li>
              </ul>
            </div>

           <div className={`${studioGlassCardClass} p-4 sm:p-5`}>
  <div className="flex items-center justify-between mb-2">
    <label className="font-medium text-gray-700 dark:text-gray-300">Script Content</label>
    <span className="text-sm text-gray-500 dark:text-gray-400">
      {script.split(/\s+/).filter(Boolean).length} words
    </span>
  </div>
  <textarea
    ref={textareaRef}
    value={script}
    onChange={(e) => setScript(e.target.value)}
    onKeyDown={onKeyDownGuard}
    className={`w-full px-4 py-3 rounded-lg font-mono text-sm leading-relaxed ${studioFieldClass}`}
    style={{ minHeight: "400px" }}
    placeholder="Start typing your script..."
    dir={isRTL ? "rtl" : "ltr"}
  />
</div>

<div className="flex justify-end">
<div className="relative">
  <button
    onClick={() => {
      if (isEditingTitle) {
        setToast({ type: "warning", message: "Please save your title edit before exporting" });
        setTimeout(() => setToast(null), 3000);
        return;
      }
      setShowExportMenu((prev) => !prev);
    }}
    disabled={!script.trim()}
    className="flex min-h-10 items-center gap-2 rounded-lg border border-purple-500 px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 disabled:opacity-50 dark:text-purple-300 dark:hover:bg-purple-900/20 sm:px-4"
    title="Export script"
  >
    <Download className="w-4 h-4" />
    Export
    <ChevronDown className={`w-4 h-4 transition-transform ${showExportMenu ? "rotate-180" : ""}`} />
  </button>
  {showExportMenu && script.trim() && (
    <div className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-2xl border border-black/10 bg-white/96 p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-white/10 dark:bg-neutral-900/96">
      <button
        onClick={() => {
          setShowExportMenu(false);
          exportScript("pdf");
        }}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-black/80 transition hover:bg-purple-50 hover:text-purple-700 dark:text-white/80 dark:hover:bg-purple-900/20 dark:hover:text-purple-200"
      >
        <Download className="w-4 h-4" />
        Export as PDF
      </button>
      <button
        onClick={() => {
          setShowExportMenu(false);
          exportScript("txt");
        }}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-black/80 transition hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/10"
      >
        <Download className="w-4 h-4" />
        Export as TXT
      </button>
    </div>
  )}
</div>
</div>
          </div>
        )}

        {/* Voices Tab - Matching CreatePro style */}
        {activeTab === "voices" && (
          <div className="space-y-6">
            {speakers.map((speaker, index) => {
              const pool = getFilteredVoicesForSpeaker(index);
              const currentId = speaker.voiceId || "";
              const safeValue = pickVoiceIdFromFilteredPool(currentId, pool);
              const selectedVoice = pool.find((voice) => getVoiceId(voice) === safeValue);
              const selectedVoiceName =
                getVoiceDisplayName(selectedVoice) ||
                resolveSpeakerVoiceName(speaker) ||
                (safeValue ? "Selected voice" : "");
              const visibleCount = speakerVoiceVisibleCounts[index] || VOICE_PAGE_SIZE;
              const visiblePool = pool.slice(0, visibleCount);
              const hasMoreVoices = pool.length > visibleCount;

              return (
                <div key={index} className={`${studioGlassCardClass} p-4 sm:p-6`}>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    Speaker {index + 1}: {speaker.name || "Unnamed"}
                    <span className="text-sm font-normal text-black/55 dark:text-white/55 ml-2">
                      ({speaker.role} آ· {speaker.gender})
                    </span>
                  </h3>

                  <div className="space-y-4">
                    <div>
  <label className="block text-sm font-medium mb-2">Speaker Name</label>
<input
  value={speaker.name}
  onChange={(e) => {
    const newName = e.target.value;
    const newSpeakers = [...speakers];
    newSpeakers[index] = {
      ...newSpeakers[index],
      name: newName,
    };
    setSpeakers(newSpeakers);
    // Script labels will be synchronized when the user saves the final version
  }}
  className={`w-full px-3 py-2 rounded-lg max-w-md ${studioFieldClass}`}
  dir={/[\u0600-\u06FF]/.test(speaker.name || "") ? "rtl" : "ltr"}
  placeholder="Enter speaker name"
/>
</div>
{/* Gender Selection */}
<div>
  <label className="block text-sm font-medium mb-2">{t("create.speakers.gender")}</label>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <select
        value={speaker.gender}
        onChange={(e) => {
          const gender = e.target.value;
          const appliedPrev =
            speakerVoiceAppliedFilters[index] ||
            appliedVoiceFiltersForSpeakerGender(speakers[index]);
          const appliedNext = {
            ...appliedPrev,
            gender: normalizeGenderToken(gender),
          };
          const pool = computeFilteredPoolForSpeaker(index, appliedNext);
          setSpeakerVoiceAppliedFilters((prev) => ({ ...prev, [index]: appliedNext }));
          setSpeakers((arr) => {
            const next = [...arr];
            const usedIds = new Set(
              next.filter((_, idx) => idx !== index).map((s) => s.voiceId).filter(Boolean)
            );
            let voiceId = pickVoiceIdFromFilteredPool(next[index].voiceId, pool);
            if (!voiceId) {
              voiceId = pool.map(getVoiceId).find((id) => id && !usedIds.has(id)) || "";
            }
            next[index] = {
              ...next[index],
              gender,
              voiceId,
              voiceName: getVoiceNameById(voiceId),
            };
            return next;
          });
          setSpeakerVoiceVisibleCounts((prev) => ({
            ...prev,
            [index]: VOICE_PAGE_SIZE,
          }));
        }}
        dir={isRTL ? "rtl" : "ltr"}
        className={`form-input select-input [color-scheme:light] dark:[color-scheme:dark] ${isRTL ? "text-right" : "text-left"} w-full px-3 py-2 rounded-lg ${studioFieldClass}`}
      >
        <option value="Male">{t("create.speakers.genderMale")}</option>
        <option value="Female">{t("create.speakers.genderFemale")}</option>
      </select>
    </div>
  </div>
</div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Voice Selection</label>
                      {loadingVoices ? (
                        <p className="flex items-center gap-2 text-sm text-black/55 dark:text-white/55">
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" aria-hidden />
                          Loading voices…
                        </p>
                      ) : voices.length === 0 ? (
                        <p className="text-sm text-red-500">No voices found. Check ElevenLabs config.</p>
                      ) : pool.length === 0 ? (
                        <p className="text-sm text-black/60 dark:text-white/60">
                          {speakerVoiceAppliedFilters[index]?.accent
                            ? t("create.speakers.noMatchingAccentVoices", {
                                defaultValue:
                                  "No voices found for this accent. Try another accent or clear the accent filter.",
                              })
                            : t("create.speakers.noVoicesFiltered", {
                                defaultValue: "No voices found. Try changing filters.",
                              })}
                        </p>
                      ) : (
                        <div className="w-full">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            {(() => {
                              const applied =
                                speakerVoiceAppliedFilters[index] ||
                                appliedVoiceFiltersForSpeakerGender(speaker);
                              const modalFilters = modalFiltersFromApplied(applied, speaker);
                              const safeGender = getSafeModalGenderFilter(modalFilters.gender);
                              const hasActive = hasActiveModalVoiceFilters(modalFilters, safeGender);
                              return (
                            <button
                              type="button"
                              onClick={() => {
                                setSpeakerVoiceFilters((prev) => ({
                                  ...prev,
                                  [index]: modalFiltersFromApplied(
                                    speakerVoiceAppliedFilters[index] ||
                                      appliedVoiceFiltersForSpeakerGender(speaker),
                                    speaker
                                  ),
                                }));
                                setActiveFilterSpeaker(index);
                              }}
                              className="relative inline-flex items-center justify-center h-[44px] w-[44px] rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 transition hover:bg-black/5 dark:hover:bg-white/5"
                              aria-label={t("create.speakers.filters", "Filters")}
                              title={t("create.speakers.filters", "Filters")}
                            >
                              <SlidersHorizontal className="w-5 h-5" />
                              {hasActive ? (
                                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-purple-600 ring-2 ring-white dark:ring-neutral-900" />
                              ) : null}
                            </button>
                              );
                            })()}

                            <div className="relative min-w-[min(100%,12rem)] flex-1">
                              <select
                                value={safeValue}
                                onChange={(e) => {
                                  const newVoice = e.target.value;
                                  const alreadyUsed = speakers.some(
                                    (s, idx) => s.voiceId === newVoice && idx !== index
                                  );
                                  if (alreadyUsed) {
                                    setToast({ type: "warning", message: "This voice is already used by another speaker" });
                                    setTimeout(() => setToast(null), 3000);
                                    return;
                                  }
                                  const newSpeakers = [...speakers];
                                  const selected = pool.find((v) => getVoiceId(v) === newVoice);
                                  newSpeakers[index] = {
                                    ...newSpeakers[index],
                                    voiceId: newVoice,
                                    voiceName: getVoiceDisplayName(selected) || "",
                                  };
                                  setSpeakers(newSpeakers);

                                  if (newVoice && shouldAutoplayVoicePreview()) {
                                    previewVoice(newVoice, selected || null);
                                  }
                                }}
                                className={`w-full appearance-none pr-10 px-3 py-2 rounded-lg ${studioFieldClass} [color-scheme:light] dark:[color-scheme:dark]`}
                              >
                                <option value="">Select a voice</option>
                                {visiblePool.map((v) => {
                                  const vid = getVoiceId(v);
                                  const isTaken = speakers.some(
                                    (s, idx) => s.voiceId === vid && idx !== index
                                  );
                                  return (
                                    <option key={vid} value={vid} disabled={isTaken}>
                                      {getVoiceDisplayName(v) || "Unnamed voice"} {isTaken ? "(used)" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50 dark:text-white/60" />
                            </div>

<button
  onClick={() => {
    const selected = pool.find((v) => getVoiceId(v) === safeValue);
    previewVoice(safeValue, selected || null);
  }}
  disabled={!safeValue || previewLoadingVoiceId === safeValue}
  className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-purple-500 px-3 py-2 text-sm font-semibold text-purple-600 transition hover:bg-purple-50 disabled:opacity-50 dark:hover:bg-purple-900/20 sm:h-[44px] sm:flex-none sm:px-5 sm:text-base ${isRTL ? "flex-row-reverse" : ""}`}
  title={previewLoadingVoiceId === safeValue ? "Generating preview..." : "Preview voice"}
>
  <span>Preview</span>
  <Play className={`w-4 h-4 ${previewLoadingVoiceId === safeValue ? "animate-pulse" : ""}`} />
</button>
                          </div>
                          {hasMoreVoices && (
                            <button
                              type="button"
                              onClick={() =>
                                setSpeakerVoiceVisibleCounts((prev) => ({
                                  ...prev,
                                  [index]: Math.min(pool.length, (prev[index] || VOICE_PAGE_SIZE) + VOICE_PAGE_SIZE),
                                }))
                              }
                              className="mt-2 text-xs font-semibold text-purple-600 dark:text-purple-300 hover:underline"
                            >
                              Load more voices ({visiblePool.length}/{pool.length})
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                </div>
              );
            })}
             <div className="flex justify-end gap-3">
</div>
          </div>
        )}

 {/* Music Tab */}
{activeTab === "music" && (
  <div className={`${studioGlassCardClass} p-6`}>
    <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40">
        <Headphones className="w-4 h-4" />
      </span>
      <span>Select your Transition Music</span>
    </h2>

    <p className="text-sm text-black/60 dark:text-white/60 mt-2 mb-6">
      Choose music to enhance your podcast. Select a category and pick tracks for intro, body, and outro.
    </p>

    {/* CATEGORY SELECT */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
      {Object.keys(MUSIC_CATEGORIES).map((cat) => {
        const isActive = category === cat;

        const labelText =
          cat === "dramatic"
            ? "Dramatic"
            : cat === "chill"
              ? "Chill"
              : cat === "classics"
                ? "Classics"
                : "Arabic";

        const description =
          cat === "dramatic"
            ? "Powerful, epic tracks for serious moments"
            : cat === "arabic"
              ? "Traditional Arabic melodies and instruments"
              : cat === "chill"
                ? "Smooth, calming background ambience"
                : "Timeless classical pieces";

        return (
          <label
            key={cat}
            onClick={() => {
              if (category !== cat) {
                setCategory(cat);
                setAvailableTracks(MUSIC_CATEGORIES[cat]);
                setIntroMusic("");
                setBodyMusic("");
                setOutroMusic("");
                setMusicPreview(null);
              }
            }}
            className={`cursor-pointer group relative w-full p-5 rounded-2xl border transition ${
              isActive
                ? "border-purple-500/80 bg-white/95 text-black backdrop-blur-sm shadow-[0_16px_32px_rgba(124,58,237,0.12)] dark:bg-neutral-900 dark:text-white dark:border-purple-400/70"
                : "border-purple-200/90 bg-white/82 text-black backdrop-blur-sm shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:border-purple-300/95 hover:bg-white/92 dark:bg-neutral-900 dark:text-white dark:border-white/15 dark:hover:border-purple-400/70 dark:hover:bg-neutral-900"
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                checked={isActive}
                readOnly
                className="accent-purple-600 mt-1"
              />

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/50">
                    <Music2 className="w-3 h-3" />
                  </span>

                  <div className="flex flex-col">
                    <span className="font-semibold">{labelText}</span>
                    <p className="text-xs text-black/60 dark:text-white/60 mt-0.5">
                      {description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {isActive && (
              <span className="absolute top-3 right-4 inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/60 px-2.5 py-1 text-[11px] font-semibold">
                <Check className="w-3 h-3" />
                Selected
              </span>
            )}
          </label>
        );
      })}
    </div>

    {/* TRACK LIST */}
    {category && availableTracks.length > 0 && (
      <div className="mt-8 space-y-4">
        {["Intro Music", "Body Music", "Outro Music"].map((label, index) => {
          const selectedValue = index === 0 ? introMusic : index === 1 ? bodyMusic : outroMusic;
          const selectedTrackVisible = !selectedValue || availableTracks.some((track) => track.file === selectedValue);

          return (
          <div key={label} className="flex items-center justify-between border p-3 rounded-xl dark:border-neutral-700">
            <span className="font-medium">{label}</span>

            <div className="flex items-center gap-3">
              <select
                className="p-2 rounded-lg border dark:bg-neutral-800 dark:border-neutral-700"
                value={selectedValue}
                onChange={(e) => {
                  if (index === 0) setIntroMusic(e.target.value);
                  if (index === 1) setBodyMusic(e.target.value);
                  if (index === 2) setOutroMusic(e.target.value);
                }}
              >
                <option value="">Select track</option>
                {selectedValue && !selectedTrackVisible ? (
                  <option value={selectedValue}>{selectedValue}</option>
                ) : null}
                {availableTracks.map((track) => (
                  <option key={track.file} value={track.file}>{track.name}</option>
                ))}
              </select>

              <button
                className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-sm font-semibold
                  ${(index === 0 && !introMusic) ||
                    (index === 1 && !bodyMusic) ||
                    (index === 2 && !outroMusic)
                    ? "opacity-40 cursor-not-allowed border-neutral-300 dark:border-neutral-700 text-neutral-400"
                    : "border-purple-500 text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  }`}
                onClick={() => {
                  const selected =
                    index === 0 ? introMusic : index === 1 ? bodyMusic : outroMusic;
                  if (selected) {
                    setMusicPreview(`${API_BASE}/static/music/${selected}`);
                  }
                }}
              >
                <Play className="w-4 h-4" />
                <span>Preview</span>
              </button>
            </div>
          </div>
          );
        })}

        {musicPreview && (
          <audio autoPlay src={musicPreview} onEnded={() => setMusicPreview(null)} />
        )}
      </div>
    )}
  </div>
)}

      </div>
      </div>
      </main>

      {activeFilterSpeaker !== null && (() => {
        const idx = activeFilterSpeaker;
        const f = speakerVoiceFilters[idx] || DEFAULT_MODAL_VOICE_FILTERS;
        const selectedLanguage = normalizeLanguageFilterValue(f.language || DEFAULT_VOICE_LANGUAGE);
        const langOnlyApplied = buildAppliedVoiceFiltersForSpeaker(
          { ...f, accent: "" },
          speakers[idx]
        );
        const languageStrictPool = getStrictFilteredVoicePool(voices, langOnlyApplied);
        const accentOptions = buildAccentOptionsForLanguage(
          languageStrictPool,
          selectedLanguage,
          DEFAULT_VOICE_LANGUAGE
        );
        const ageOptions = collectVoiceAgeOptions([
          ...VOICE_AGE_BUCKETS.map((age) => ({ age })),
          ...languageStrictPool,
        ]);
        const categoryOptions = roleCategoryOptionsForVoices(languageStrictPool);
        const speakerGenderRaw = String(speakers[idx]?.gender || "").trim().toLowerCase();
        const speakerGenderReset =
          speakerGenderRaw === "female" || speakerGenderRaw === "male" ? speakerGenderRaw : "__all__";

        return (
          <VoiceFiltersModal
            open
            onClose={() => {
              setSpeakerVoiceFilters((prev) => ({
                ...prev,
                [idx]: modalFiltersFromApplied(
                  speakerVoiceAppliedFilters[idx] || appliedVoiceFiltersForSpeakerGender(speakers[idx]),
                  speakers[idx]
                ),
              }));
              setActiveFilterSpeaker(null);
            }}
            filters={f}
            onFiltersChange={(next) => {
              setSpeakerVoiceFilters((prev) => ({
                ...prev,
                [idx]: { ...(prev[idx] || DEFAULT_MODAL_VOICE_FILTERS), ...next },
              }));
              setSpeakerVoiceVisibleCounts((prev) => ({
                ...prev,
                [idx]: VOICE_PAGE_SIZE,
              }));
            }}
            accentOptions={accentOptions}
            ageOptions={ageOptions}
            categoryOptions={categoryOptions}
            isRTL={isRTL}
            normalizeCategoryLabelKey={normalizeCategoryLabelKey}
            formatVoiceCategoryLabel={formatVoiceCategoryLabel}
            onClear={() => {
              const cleared = { ...DEFAULT_MODAL_VOICE_FILTERS, gender: speakerGenderReset };
              const applied = appliedFiltersFromModalDone(cleared, speakers[idx]);
              setSpeakerVoiceFilters((prev) => ({ ...prev, [idx]: cleared }));
              setSpeakerVoiceAppliedFilters((prev) => ({ ...prev, [idx]: applied }));
              const pool = computeFilteredPoolForSpeaker(idx, applied);
              logStrictDropdownFinal("Edit/ClearFilters", applied, pool);
              setSpeakers((prev) => {
                const next = [...prev];
                const kept = pickVoiceIdFromFilteredPool(next[idx]?.voiceId, pool);
                next[idx] = {
                  ...next[idx],
                  voiceId: kept || firstVoiceIdFromPool(pool),
                };
                return next;
              });
              setSpeakerVoiceVisibleCounts((prev) => ({ ...prev, [idx]: VOICE_PAGE_SIZE }));
            }}
            onDone={(sanitized) => {
              const applied = appliedFiltersFromModalDone(sanitized, speakers[idx]);
              setSpeakerVoiceFilters((prev) => ({
                ...prev,
                [idx]: { ...DEFAULT_MODAL_VOICE_FILTERS, ...sanitized },
              }));
              setSpeakerVoiceAppliedFilters((prev) => ({ ...prev, [idx]: applied }));
              const pool = computeFilteredPoolForSpeaker(idx, applied);
              logStrictDropdownFinal("Edit/Done", applied, pool);
              setSpeakers((prev) => {
                const next = [...prev];
                const kept = pickVoiceIdFromFilteredPool(next[idx]?.voiceId, pool);
                next[idx] = {
                  ...next[idx],
                  voiceId: kept || firstVoiceIdFromPool(pool),
                };
                return next;
              });
              setSpeakerVoiceVisibleCounts((prev) => ({ ...prev, [idx]: VOICE_PAGE_SIZE }));
              setActiveFilterSpeaker(null);
            }}
            preview={editVoiceFilterPreview}
          />
        );
      })()}

      {/* Exit Warning Modal */}
      {showExitWarning && (
        <div className="wecast-overlay flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-[min(92vw,440px)] rounded-[20px] border border-neutral-200 bg-white p-5 shadow-[0_24px_56px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-neutral-900">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Leave Editor</p>
                <h2 className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-white">Save this draft before leaving?</h2>
              </div>
            </div>
            <p className="mb-5 text-sm leading-6 text-neutral-600 dark:text-white/70">
              Save Draft keeps your latest edits without replacing the original episode. Discard Draft leaves this page and removes those edits.
            </p>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <button
                onClick={() => setShowExitWarning(false)}
                className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                Continue Editing
              </button>
              <button
  onClick={async () => {
    await saveDraftLocally({ navigateTo: pendingNavigation || "#/create?from=studio" });
  }}
  className="rounded-xl bg-[#8b3dff] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(139,61,255,0.22)] transition hover:bg-[#7a2ef1]"
>
  Save Draft & Exit
</button>
              <button
                onClick={confirmNavigation}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/16"
              >
                Discard Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finalize Warning Modal */}
{showFinalizeWarning && (
  <div className="wecast-overlay flex items-center justify-center bg-black/55 p-4 backdrop-blur-md">
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="w-full max-w-[520px] rounded-[22px] border border-purple-400/20 bg-[#111118] p-5 shadow-[0_28px_70px_rgba(0,0,0,0.48)] ring-1 ring-purple-400/10 sm:p-6"
    >
      <div className="flex gap-4 text-start">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500/12 text-purple-300 ring-1 ring-purple-400/25">
          <RefreshCw className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[22px] font-bold leading-7 tracking-tight text-white">
            {isRTL ? "إعادة توليد الصوت؟" : "Regenerate audio?"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#A0A0A0]">
            {isRTL ? (
              <>
                سيتم استبدال الصوت الحالي ليعكس آخر تغييراتك.
                <br />
                قد يستغرق ذلك بضع لحظات.
              </>
            ) : (
              <>
                The current audio will be replaced to reflect your latest changes.
                <br />
                This may take a few moments.
              </>
            )}
          </p>
          <div className="mt-5 rounded-2xl border border-amber-400/25 bg-[rgba(255,193,7,0.10)] p-4 text-sm text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span className="font-semibold">
                {isRTL
                  ? "التغييرات التالية تتطلب إعادة توليد الصوت:"
                  : "The following changes require audio regeneration:"}
              </span>
            </div>
            <ul className="ms-7 mt-3 list-disc space-y-1.5 text-[13px] leading-5 text-[#D8D8D8]">
              {String(applyShowTitleToScript(
                applySpeakerLabelRenames(script, originalSpeakers, speakers),
                showTitle
              )) !== String(originalScript || "") && (
                <li>{isRTL ? "تم تعديل محتوى النص" : "Script content has been modified"}</li>
              )}
              {!speakersEqual(speakers, originalSpeakers) && (
                <li>{isRTL ? "تم تغيير أسماء المتحدثين أو الأصوات" : "Speaker names or voices have changed"}</li>
              )}
              {(String(introMusic || "") !== String(originalIntroMusic || "") ||
                String(bodyMusic || "") !== String(originalBodyMusic || "") ||
                String(outroMusic || "") !== String(originalOutroMusic || "")) && (
                <li>{isRTL ? "تم تحديث المقاطع الموسيقية" : "Music tracks have been updated"}</li>
              )}
            </ul>
          </div>
        </div>
      </div>
      
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
        <button
          onClick={() => setShowFinalizeWarning(false)}
          className="min-h-11 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-purple-300"
        >
          {isRTL ? "إلغاء" : "Cancel"}
        </button>
        <button
          onClick={async () => {
            setShowFinalizeWarning(false);
            await finalizeChanges();
          }}
          className="min-h-11 flex-1 rounded-xl bg-gradient-to-r from-[#8b3dff] to-[#6d28d9] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(139,61,255,0.30)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-2 focus:ring-offset-[#111118]"
        >
          {isRTL ? "إعادة التوليد" : "Regenerate"}
        </button>
      </div>
    </div>
  </div>
)}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
