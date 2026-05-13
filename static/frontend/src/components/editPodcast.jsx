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
import Modal from "../components/Modal";
import { exportScriptPdf } from "../utils/exportScriptPdf";
import { exportScriptTxt } from "../utils/exportScriptTxt";
import { shouldAutoplayVoicePreview, shouldShowEditingNotifications } from "../utils/accountPreferences";

const API_BASE = import.meta.env.PROD
  ? "https://wecast.onrender.com"
  : "http://localhost:5000";

const getPortalTarget = () => {
  if (typeof document === "undefined") return null;
  return document.body && document.body.nodeType === 1 ? document.body : null;
};

const getHashSearchParams = () => {
  const hash = window.location.hash || "";
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token") || ""}`,
});

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

const splitList = (value) => {
  if (Array.isArray(value)) {
    return value.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
};

const DEFAULT_VOICE_LANGUAGE = "en";
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

const uniqueLanguageOptions = (values) => {
  const seen = new Set();
  const out = [];
  [DEFAULT_VOICE_LANGUAGE, ...values].forEach((value) => {
    const normalized = normalizeLanguageFilterValue(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out.sort((a, b) => formatLanguageLabel(a).localeCompare(formatLanguageLabel(b)));
};

const TONE_RULES = [
  { tone: "professional", keys: ["professional", "broadcaster", "corporate", "formal", "authoritative", "احترافي", "رسمي"] },
  { tone: "funny", keys: ["funny", "humorous", "comedic", "comic", "quirky", "playful", "مضحك", "كوميدي", "مرح"] },
  { tone: "warm", keys: ["warm", "friendly", "comforting", "cozy", "welcoming", "دافئ", "حنون"] },
  { tone: "calm", keys: ["calm", "relaxed", "soothing", "gentle", "smooth", "هادئ", "مريح"] },
  { tone: "energetic", keys: ["energetic", "dynamic", "lively", "upbeat", "excited", "حيوي", "نشيط"] },
  { tone: "conversational", keys: ["conversational", "natural", "casual", "chatty", "محادثة", "طبيعي"] },
  { tone: "serious", keys: ["serious", "deep", "resonant", "mature", "confident", "جدي", "عميق"] },
  { tone: "educational", keys: ["educational", "educator", "teacher", "instructive", "explainer", "تعليمي"] },
  { tone: "storytelling", keys: ["storytelling", "narration", "narrator", "cinematic", "قصصي", "سرد"] },
];

const getVoiceToneTags = (voice) => {
  const explicit = [
    ...splitList(voice?.tone),
    ...splitList(voice?.labels?.tone),
  ];

  const haystack = [
    String(voice?.name || ""),
    String(voice?.description || ""),
    String(voice?.labels?.description || ""),
  ]
    .join(" ")
    .toLowerCase();

  const inferred = TONE_RULES
    .filter((rule) => rule.keys.some((k) => haystack.includes(k)))
    .map((rule) => rule.tone);

  return Array.from(new Set([...explicit, ...inferred]));
};

const PITCH_VALUES = ["low", "medium", "high"];
const PITCH_RULES = [
  { pitch: "low", keys: ["low", "deep", "resonant", "bass", "baritone", "grave"] },
  { pitch: "high", keys: ["high", "bright", "light", "youthful", "soprano"] },
  { pitch: "medium", keys: ["medium", "balanced", "neutral", "natural"] },
];

const getVoicePitchTag = (voice) => {
  const raw = String(voice?.pitch || voice?.labels?.pitch || "").trim().toLowerCase();
  if (PITCH_VALUES.includes(raw)) return raw;

  const haystack = [
    String(voice?.name || ""),
    String(voice?.description || ""),
    String(voice?.labels?.description || ""),
  ]
    .join(" ")
    .toLowerCase();

  const inferred = PITCH_RULES.find((rule) => rule.keys.some((k) => haystack.includes(k)));
  return inferred?.pitch || "";
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

/* -------------------- voice filter modal -------------------- */
function VoiceFilterModal({ isOpen, onClose, filters, setFilters, voices, speakerIndex }) {
  if (!isOpen) return null;

  const toList = (value) => {
    if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
    if (typeof value === "string") {
      return value
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
    return [];
  };

  const normalize = (s) => String(s || "").trim().toLowerCase();
  const isNeutralGender = (s) => {
    const g = normalize(s);
    return g.includes("neutral") || g.includes("netural");
  };
  const selectedGender = normalize(filters.gender || "");
  const safeGenderFilter = (selectedGender === "__all__" || isNeutralGender(selectedGender))
    ? "__all__"
    : selectedGender;

  const genderOptions = [...new Set(
    voices
      .map(v => normalize(v.gender || v.labels?.gender || ""))
      .filter((g) => Boolean(g) && !isNeutralGender(g))
  )].sort();

  const languageOptions = uniqueLanguageOptions(
    voices
      .flatMap(v => [...toList(v.languages), ...toList(v.labels?.languages), ...toList(v.labels?.language)])
      .filter(Boolean)
  );

  const toneOptions = [...new Set(
    voices
      .flatMap((v) => getVoiceToneTags(v))
      .map(normalize)
      .filter(Boolean)
  )].sort();

  const activeChips = [
    filters.q ? { key: "q", label: `Search: ${filters.q}` } : null,
    (safeGenderFilter && safeGenderFilter !== "__all__")
      ? { key: "gender", label: `Gender: ${safeGenderFilter}` }
      : null,
    filters.language
      ? {
          key: "language",
          label: (
            <>
              Language: <LanguageLabel value={filters.language} />
            </>
          ),
        }
      : null,
    filters.tone ? { key: "tone", label: `Tone: ${filters.tone}` } : null,
    filters.pitch ? { key: "pitch", label: `Pitch: ${filters.pitch}` } : null,
  ].filter(Boolean);

  const modal = (
    <div className="wecast-overlay flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-[min(92vw,560px)] rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Filter Voices - Speaker {speakerIndex + 1}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-black/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Search</label>
            <input
              value={filters.q || ""}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Search by voice name..."
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-neutral-900 text-black dark:text-white placeholder:text-black/45 dark:placeholder:text-white/45 caret-black dark:caret-white border-neutral-300 dark:border-white/15"
            />
          </div>

          {/* Gender and Language row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Gender</label>
              <div className="relative">
                <select
                  value={safeGenderFilter}
                  onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                  className="w-full appearance-none pr-10 px-3 py-2 border rounded-lg bg-white dark:bg-neutral-900 text-black dark:text-white border-neutral-300 dark:border-white/15 [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="__all__">All Genders</option>
                  {genderOptions.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50 dark:text-white/60" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Language</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, languageMenuOpen: !filters.languageMenuOpen })}
                  className="flex min-h-10 w-full items-center rounded-lg border border-neutral-300 bg-white px-3 py-2 pr-10 text-start text-sm text-black dark:border-white/15 dark:bg-neutral-900 dark:text-white"
                >
                  {filters.language ? (
                    <LanguageLabel value={filters.language} />
                  ) : (
                    <span className="text-black/55 dark:text-white/55">All Languages</span>
                  )}
                </button>
                {filters.languageMenuOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-[10030] max-h-56 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-neutral-950">
                    <button
                      type="button"
                      onClick={() => setFilters({ ...filters, language: "", languageMenuOpen: false })}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-start text-sm hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      All Languages
                    </button>
                    {languageOptions.map(lang => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setFilters({ ...filters, language: lang, languageMenuOpen: false })}
                        className="flex w-full items-center rounded-lg px-3 py-2 text-start text-sm hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <LanguageLabel value={lang} />
                      </button>
                    ))}
                  </div>
                ) : null}
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50 dark:text-white/60" />
              </div>
            </div>
          </div>

          {/* Tone and Pitch row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tone</label>
              <div className="relative">
                <select
                  value={filters.tone || ""}
                  onChange={(e) => setFilters({ ...filters, tone: e.target.value })}
                  className="w-full appearance-none pr-10 px-3 py-2 border rounded-lg bg-white dark:bg-neutral-900 text-black dark:text-white border-neutral-300 dark:border-white/15 [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="">All Tones</option>
                  {toneOptions.map(tone => (
                    <option key={tone} value={tone}>{tone}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50 dark:text-white/60" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Pitch</label>
              <div className="relative">
                <select
                  value={filters.pitch || ""}
                  onChange={(e) => setFilters({ ...filters, pitch: e.target.value })}
                  className="w-full appearance-none pr-10 px-3 py-2 border rounded-lg bg-white dark:bg-neutral-900 text-black dark:text-white border-neutral-300 dark:border-white/15 [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="">All Pitches</option>
                  {PITCH_VALUES.map((pitch) => (
                    <option key={pitch} value={pitch}>{pitch}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50 dark:text-white/60" />
              </div>
            </div>
          </div>

          {activeChips.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-black/60 dark:text-white/60">Active filters</p>
              <div className="flex flex-wrap gap-2">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setFilters({ ...filters, [chip.key]: chip.key === "gender" ? "__all__" : chip.key === "language" ? DEFAULT_VOICE_LANGUAGE : "" })}
                    className="inline-flex items-center gap-1 rounded-full border border-purple-300/70 dark:border-purple-400/45 bg-purple-50 dark:bg-purple-900/25 px-2.5 py-1 text-xs text-purple-700 dark:text-purple-200"
                    title="Remove filter"
                  >
                    <span>{chip.label}</span>
                    <span>x</span>
                  </button>
                ))}
              </div>
            </div>
          )}

  {activeChips.length > 0 && (
  <button
    onClick={() => setFilters({ q: "", gender: "__all__", language: DEFAULT_VOICE_LANGUAGE, tone: "", pitch: "" })}
    className="px-3 py-1.5 rounded-md border border-purple-500 bg-transparent text-purple-600 font-medium text-sm transition hover:bg-purple-50 dark:text-purple-400 dark:border-purple-400 dark:hover:bg-purple-900/20"
  >
    Clear Filters
  </button>
)}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
  const portalTarget = getPortalTarget();
  return portalTarget ? createPortal(modal, portalTarget) : modal;
}

export default function EditPodcast() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";

  // Core podcast data
  const [podcastId, setPodcastId] = useState(null);
  const [script, setScript] = useState("");
  const [originalScript, setOriginalScript] = useState("");
  const [scriptTemplate, setScriptTemplate] = useState("");
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
  const [speakerVoiceVisibleCounts, setSpeakerVoiceVisibleCounts] = useState({});
  const [activeFilterSpeaker, setActiveFilterSpeaker] = useState(null);
  const VOICE_PAGE_SIZE = 100;

  // Music related
  const [availableTracks, setAvailableTracks] = useState([]);
  const [musicPreview, setMusicPreview] = useState(null);
  const textareaRef = useRef(null);
  const voicePreviewRef = useRef(null);
  const voicePreviewCacheRef = useRef(new Map());
  const [previewLoadingVoiceId, setPreviewLoadingVoiceId] = useState("");

  const [exporting, setExporting] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const isAuthenticated = () => {
  return !!(localStorage.getItem("token") || sessionStorage.getItem("token"));
};
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
  const getVoiceId = (v) => v?.providerVoiceId || v?.id || v?.docId || "";
 const defaultVoiceForGender = (gender, usedIds, voicesList) => {
  if (!gender) return "";
  const available = voicesList.find(v => 
    (v.gender?.toLowerCase() === gender.toLowerCase()) && 
    !usedIds.has(getVoiceId(v))
  );
  return available ? getVoiceId(available) : "";
};
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
            ...authHeaders(),
          }
        });

        if (!res.ok) {
          const errorData = await parseJsonResponse(res);
          throw new Error(errorData.error || `Failed to load podcast: ${res.status}`);
        }
        
        const data = await parseJsonResponse(res);
        console.log("Loaded podcast data:", data);

        const resolvedBaseTitle = data.showTitle || data.title || "Untitled Episode";
        const baseState = {
          script: applyShowTitleToScript(data.script || "", resolvedBaseTitle),
          showTitle: data.showTitle || data.title || "Untitled Episode",
          speakers: data.speakers || [],
          introMusic: data.introMusic || "",
          bodyMusic: data.bodyMusic || "",
          outroMusic: data.outroMusic || "",
          category: data.category || "",
        };
        const draftState = data.editDraft
          ? {
              ...data.editDraft,
              script: applyShowTitleToScript(
                data.editDraft.script || "",
                data.editDraft.showTitle || resolvedBaseTitle
              ),
            }
          : null;
        const nextState = draftState ? { ...baseState, ...draftState } : baseState;

        setScript(nextState.script);
        setOriginalScript(baseState.script);
        setScriptTemplate(data.scriptTemplate || "");
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

  // Load voices from API (matching CreatePro)
  useEffect(() => {
    async function loadVoices() {
      try {
        setLoadingVoices(true);

        const params = new URLSearchParams();
        params.set("provider", "ElevenLabs");
        params.set("limit", "500");

        const url = `${API_BASE}/api/voices?${params.toString()}`;
        const res = await fetch(url, { 
          credentials: "include",
          headers: authHeaders(),
        });

        const data = await parseJsonResponse(res);

        if (!res.ok) {
          throw new Error(data?.error || `Failed to load voices (${res.status})`);
        }

        const raw = Array.isArray(data?.items) ? data.items :
                    Array.isArray(data?.voices) ? data.voices : [];

        setVoices(raw);
      } catch (e) {
        console.error("Failed to load voices", e);
        setVoices([]);
      } finally {
        setLoadingVoices(false);
      }
    }

    loadVoices();
  }, []);

  // Filter voices for a specific speaker (matching CreatePro)
  const getFilteredVoicesForSpeaker = (speakerIndex) => {
    const f = speakerVoiceFilters[speakerIndex] || { q: "", gender: "", language: DEFAULT_VOICE_LANGUAGE, tone: "", pitch: "" };
    const isNeutralGender = (value) => {
      const g = String(value || "").trim().toLowerCase();
      return g.includes("neutral") || g.includes("netural");
    };
    const speakerGenderRaw = String(speakers?.[speakerIndex]?.gender || "").trim().toLowerCase();
    const speakerGender = isNeutralGender(speakerGenderRaw) ? "" : speakerGenderRaw;
    const selectedGender = String(f.gender || "").trim().toLowerCase();
    const effectiveGender = (selectedGender === "__all__" || isNeutralGender(selectedGender))
      ? ""
      : String(selectedGender || speakerGender || "").trim().toLowerCase();
    const toListLower = (value) => {
      if (Array.isArray(value)) return value.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
      if (typeof value === "string") {
        return value
          .split(",")
          .map((x) => x.trim().toLowerCase())
          .filter(Boolean);
      }
      return [];
    };
    const matchFacet = (selected, candidates) => {
      const s = String(selected || "").trim().toLowerCase();
      if (!s) return true;
      return candidates.some((c) => c === s);
    };
    const matchLanguageFacet = (selected, candidates) => {
      const s = normalizeLanguageFilterValue(selected);
      if (!s) return true;
      return candidates.some((c) => {
        const normalized = normalizeLanguageFilterValue(c);
        return normalized === s || normalized.startsWith(`${s}-`) || s.startsWith(`${normalized}-`);
      });
    };

    return voices.filter((v) => {
      const name = String(v.name || "").toLowerCase();
      const desc = String(v.description || "").toLowerCase();
      const q = String(f.q || "").trim().toLowerCase();

      const vGender = String(v.gender || v.labels?.gender || "").toLowerCase();
      const vPitch = getVoicePitchTag(v);
      const vTones = getVoiceToneTags(v);
      const vLangs = [...toListLower(v.languages), ...toListLower(v.labels?.languages), normalizeLanguageFilterValue(v.labels?.language)];

      if (q && !(name.includes(q) || desc.includes(q))) return false;
      if (effectiveGender && vGender !== effectiveGender) return false;
      if (f.pitch && vPitch !== String(f.pitch).toLowerCase()) return false;
      if (!matchFacet(f.tone, vTones)) return false;
      if (!matchLanguageFacet(f.language, vLangs)) return false;

      return true;
    });
  };

  // Preview voice (matching CreatePro)
  const previewVoice = async (voiceId, voiceName = "") => {
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
            ...authHeaders(),
          },
        body: JSON.stringify({
          voiceId,
          voiceName,
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
    return () => {
      if (voicePreviewRef.current) {
        voicePreviewRef.current.pause();
        voicePreviewRef.current = null;
      }
      for (const url of voicePreviewCacheRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      voicePreviewCacheRef.current.clear();
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
        await fetch(`${API_BASE}/api/podcast/${encodeURIComponent(podcastId)}/update`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
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
      const res = await fetch(`${API_BASE}/api/podcast/${encodeURIComponent(podcastId)}/update`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          mode: "draft",
          script: updatedScript,
          speakers,
          introMusic,
          bodyMusic,
          outroMusic,
          category,
          showTitle,
          scriptStyle,
          description: "",
        }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to save draft");
      }

      const savedSnapshot = buildEditableSnapshot({
        nextShowTitle: showTitle,
        nextScript: updatedScript,
        nextSpeakers: speakers,
        nextIntroMusic: introMusic,
        nextBodyMusic: bodyMusic,
        nextOutroMusic: outroMusic,
        nextCategory: category,
      });
      setScript(updatedScript);
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
        await fetch(`${API_BASE}/api/podcast/${encodeURIComponent(podcastId)}/update`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
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
  const resolvedSpeakers = Array.isArray(nextSpeakers) ? nextSpeakers : speakers;

  const res = await fetch(`${API_BASE}/api/podcast/${encodeURIComponent(podcastId)}/update`, {
      method: "POST",
      credentials: "include",
      headers: { 
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        mode: "final",
        script: resolvedScript,
        speakers: resolvedSpeakers,
        introMusic,
        bodyMusic,
        outroMusic,
        category: nextCategory,
        showTitle: nextShowTitle,
        scriptStyle,
        description: "",
      }),
    });

    const responseData = await parseJsonResponse(res);
    console.log("Save response:", responseData);

    if (!res.ok) {
      throw new Error(responseData.error || "Failed to apply updates");
    }

    if (String(nextShowTitle || "").trim()) {
      const titleRes = await fetch(`${API_BASE}/api/podcasts/${encodeURIComponent(podcastId)}/title`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ title: nextShowTitle }),
      });
      const titleData = await parseJsonResponse(titleRes);
      if (!titleRes.ok) {
        throw new Error(titleData.error || "Failed to update episode title");
      }
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
      nextCategory,
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
      nextSpeakers: speakers,
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
      const res = await fetch(`${API_BASE}/api/audio`, {
        method: "POST",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
          ...authHeaders(),
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

      const audioUrl = data.url.startsWith("http")
        ? data.url
        : `${API_BASE}${data.url}`;

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

    setExporting(true);
    
    let scriptContent = script.trim();
    let title = showTitle || "Podcast Script";
    
    if (!scriptContent) {
      setToast({ type: "warning", message: "No script content to export!" });
      setTimeout(() => setToast(null), 3000);
      setExporting(false);
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
  } finally {
    setExporting(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-cream dark:bg-[#0a0a1a] flex items-center justify-center">
        <LoadingOverlay show={true} message="Loading podcast..." />
      </div>
    );
  }

 return (
    <div className="min-h-screen overflow-x-clip bg-white/35 dark:bg-neutral-900/20 text-black dark:text-white">
      {/* Header */}
      <LoadingOverlay 
  show={generatingAudio} 
  message="Generating your podcast audio..." 
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
              const poolIds = new Set(pool.map(getVoiceId));
              const currentId = speaker.voiceId || "";
              const safeValue = poolIds.has(currentId) ? currentId : "";
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
          setSpeakers((arr) => {
            const gender = e.target.value;
            const next = [...arr];

            // Voices used by OTHER speakers
            const usedIds = new Set(
              next
                .filter((_, idx) => idx !== index)
                .map((s) => s.voiceId)
                .filter(Boolean)
            );

            const voiceId = defaultVoiceForGender(gender, usedIds, voices);

            next[index] = {
              ...next[index],
              gender,
              voiceId,
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
                        <p className="text-sm text-black/55 dark:text-white/55">Loading voices...</p>
                      ) : voices.length === 0 ? (
                        <p className="text-sm text-red-500">No voices found. Check ElevenLabs config.</p>
                      ) : (
                        <div className="w-full">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <button
                              onClick={() => {
                                setSpeakerVoiceFilters((prev) => ({
                                  ...prev,
                                  [index]: prev[index] || { q: "", gender: "__all__", language: DEFAULT_VOICE_LANGUAGE, tone: "", pitch: "" },
                                }));
                                setActiveFilterSpeaker(index);
                              }}
                              className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-300/80 bg-white/82 hover:bg-white dark:border-white/15 dark:bg-neutral-900/72 dark:hover:bg-white/10 sm:h-[44px] sm:w-[44px]"
                            >
                              <SlidersHorizontal className="w-5 h-5" />
                              {Object.values(speakerVoiceFilters[index] || {}).some(Boolean) && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-purple-600 ring-2 ring-white" />
                              )}
                            </button>

                            <div className="relative min-w-[min(100%,12rem)] flex-1">
                              <select
                                value={safeValue}
                                onChange={(e) => {
                                  const newVoice = e.target.value;
                                  const alreadyUsed = speakers.some(
                                    (s, idx) => s.voiceId === newVoice && idx !== index
                                  );
                                  if (alreadyUsed) {
                                    alert("This voice is already used by another speaker");
                                    return;
                                  }
                                  const newSpeakers = [...speakers];
                                  newSpeakers[index] = {
                                    ...newSpeakers[index],
                                    voiceId: newVoice,
                                  };
                                  setSpeakers(newSpeakers);

                                  if (newVoice && shouldAutoplayVoicePreview()) {
                                    const selected = pool.find((v) => getVoiceId(v) === newVoice);
                                    previewVoice(newVoice, selected?.name || "");
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
                                      {v.name} {isTaken ? "(used)" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50 dark:text-white/60" />
                            </div>

                            <button
  onClick={() => {
    const selected = pool.find((v) => getVoiceId(v) === currentId);
    previewVoice(currentId, selected?.name || "");
  }}
  disabled={!currentId || previewLoadingVoiceId === currentId}
  className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-purple-500 px-3 py-2 text-sm font-semibold text-purple-600 transition hover:bg-purple-50 disabled:opacity-50 dark:hover:bg-purple-900/20 sm:h-[44px] sm:flex-none sm:px-5 sm:text-base ${isRTL ? "flex-row-reverse" : ""}`}
  title={previewLoadingVoiceId === currentId ? "Generating preview..." : "Preview voice"}
>
  <span>{previewLoadingVoiceId === currentId ? "Generating..." : "Preview"}</span>
  <Play className={`w-4 h-4 ${previewLoadingVoiceId === currentId ? "animate-pulse" : ""}`} />
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
        {["Intro Music", "Body Music", "Outro Music"].map((label, index) => (
          <div key={label} className="flex items-center justify-between border p-3 rounded-xl dark:border-neutral-700">
            <span className="font-medium">{label}</span>

            <div className="flex items-center gap-3">
              <select
                className="p-2 rounded-lg border dark:bg-neutral-800 dark:border-neutral-700"
                value={
                  index === 0 ? introMusic : index === 1 ? bodyMusic : outroMusic
                }
                onChange={(e) => {
                  if (index === 0) setIntroMusic(e.target.value);
                  if (index === 1) setBodyMusic(e.target.value);
                  if (index === 2) setOutroMusic(e.target.value);
                }}
              >
                <option value="">Select track</option>
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
        ))}

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

      {/* Voice Filter Modal */}
      {activeFilterSpeaker !== null && (
        <VoiceFilterModal
          isOpen={true}
          onClose={() => setActiveFilterSpeaker(null)}
          filters={speakerVoiceFilters[activeFilterSpeaker] || { q: "", gender: "__all__", language: DEFAULT_VOICE_LANGUAGE, tone: "", pitch: "" }}
          setFilters={(newFilters) => {
            setSpeakerVoiceFilters({
              ...speakerVoiceFilters,
              [activeFilterSpeaker]: newFilters,
            });
            setSpeakerVoiceVisibleCounts((prev) => ({
              ...prev,
              [activeFilterSpeaker]: VOICE_PAGE_SIZE,
            }));
          }}
          voices={voices}
          speakerIndex={activeFilterSpeaker}
        />
      )}

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
{toastMsg && (
  <div className="fixed top-6 right-6 z-[10000] bg-green-500 text-white px-6 py-3 rounded-xl shadow-2xl border border-green-300 animate-in slide-in-from-right-8 duration-300">
    <div className="flex items-center gap-2 font-semibold">
      {toastMsg}
    </div>
  </div>
)}
    </div>
  );
}
