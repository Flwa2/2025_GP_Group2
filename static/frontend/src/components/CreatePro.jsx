
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
    Mic2,
    Users,
    NotebookPen,
    ChevronLeft,
    ChevronRight,
    Check,
    Info,
    Wand2,
    AlertCircle,
    Play,
    Edit,
    Pause,
    RotateCcw,
    RotateCw,
    Download,
    Headphones,
    Music2,
    Layers,
    SlidersHorizontal,
    ChevronDown,
} from "lucide-react";
import WeCastAudioPlayer from "./WeCastAudioPlayer";
import VoiceFiltersModal from "./VoiceFiltersModal";
import {
    appliedFiltersToModalPatch,
    DEFAULT_MODAL_VOICE_FILTERS,
    filtersModalToApplied,
    getSafeModalGenderFilter,
    hasActiveModalVoiceFilters,
} from "../utils/voiceFilterModal";
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
import {
    markEditNavigationFromCreate,
    markFinalizeNavigationFromCreate,
    syncCreateDraftLease,
} from "../utils/createDraftSession";
import { normalizeGenderToken, isNeutralGenderValue } from "../utils/voiceGender";
import { clientRefineLibraryVoices } from "../utils/voiceLibraryRefine";
import { ensureVoiceLibraryCatalog, getCachedVoiceCatalog } from "../utils/voiceLibraryCache";

const API_BASE = import.meta.env.PROD
    ? "https://wecast.onrender.com"
    : "http://localhost:5000";

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
const VOICE_LANGUAGE_OPTIONS = ["en", "ar"];

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

const voiceLanguageDebugValues = (v) => ({
    name: v?.name || "",
    id: v?.providerVoiceId || v?.id || v?.docId || "",
    language: v?.language || v?.labels?.language || v?.labels?.Language || "",
    languages: v?.languages || [],
    accent: v?.accent || v?.labels?.accent || v?.labels?.Accent || "",
    verified_languages: v?.verified_languages || v?.verifiedLanguages || [],
    languageAccentPairs: v?.languageAccentPairs || v?.languageAccents || [],
});

const debugArabicAccentMetadata = (voicesList, source) => {
    if (typeof console === "undefined" || typeof console.debug !== "function") return;
    const arabicVoices = voicesList.filter((v) => languageMatchesVoice("ar", v));
    const arabicAccentValues = uniqueSortedDisplay(
        arabicVoices.flatMap((v) => accentDisplaysForLanguageFromVoice(v, "ar"))
    );
    if (arabicAccentValues.length) return;
    console.debug("[WeCast voice filters] Arabic voices have no accent metadata in this payload.", {
        source,
        arabicVoiceCount: arabicVoices.length,
        sample: arabicVoices.slice(0, 8).map(voiceLanguageDebugValues),
    });
};

const voiceAccentDebugSummary = (voicesList, language = "ar") => {
    const matchingVoices = voicesList.filter((v) => languageMatchesVoice(language, v));
    return {
        totalVoices: matchingVoices.length,
        accents: uniqueSortedDisplay(
            matchingVoices.flatMap((v) => accentDisplaysForLanguageFromVoice(v, language))
        ),
    };
};

const voiceSearchHaystack = (v) => {
    const parts = [v?.name, v?.description, v?.category];
    if (v?.labels && typeof v.labels === "object") {
        for (const val of Object.values(v.labels)) {
            if (typeof val === "string") parts.push(val);
            else if (Array.isArray(val)) val.forEach((x) => parts.push(String(x)));
        }
    }
    return parts
        .map((s) => String(s || "").toLowerCase())
        .join(" ");
};

const uniqueSortedDisplay = (displays) =>
    Array.from(new Set(displays.map((x) => String(x).trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
    );

const normalizeCategoryLabelKey = (value) =>
    String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_")
        .replace(/_+/g, "_");

const VOICE_ROLE_CATEGORIES = [
    {
        value: "podcast_host",
        label: "Podcast Host",
        keywords: ["podcast", "podcaster", "host", "presenter", "broadcast"],
    },
    {
        value: "narrator",
        label: "Narrator",
        keywords: ["narrator", "narration", "narrative", "storyteller", "storytelling", "voiceover"],
    },
    {
        value: "teacher",
        label: "Teacher",
        keywords: ["teacher", "educator", "educational", "education", "explainer", "instructor", "tutorial"],
    },
    {
        value: "news_reader",
        label: "News Reader",
        keywords: ["news", "journalist", "anchor", "announcer", "reporter", "headline"],
    },
    {
        value: "interview_host",
        label: "Interview Host",
        keywords: ["interview", "interviewer", "conversation", "conversational", "talk show"],
    },
    {
        value: "commercial_voice",
        label: "Commercial Voice",
        keywords: ["commercial", "advertisement", "advertising", "promo", "promotional", "marketing", "brand"],
    },
    {
        value: "audiobook_voice",
        label: "Audiobook Voice",
        keywords: ["audiobook", "audio book", "book", "reading", "literary"],
    },
    {
        value: "documentary_voice",
        label: "Documentary Voice",
        keywords: ["documentary", "docuseries", "documentarian"],
    },
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
    const parts = [
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
    ];
    return parts
        .flatMap((part) => (Array.isArray(part) ? part : [part]))
        .map((part) => String(part || "").toLowerCase())
        .join(" ");
};

const voiceMatchesRoleCategory = (voice, categoryValue) => {
    const category = VOICE_ROLE_CATEGORIES.find((item) => item.value === categoryValue);
    if (!category) return true;
    const haystack = voiceCategoryHaystack(voice);
    return category.keywords.some((keyword) => haystack.includes(keyword));
};

const roleCategoryOptionsForVoices = (voices) =>
    VOICE_ROLE_CATEGORIES.filter((category) =>
        (voices || []).some((voice) => voiceMatchesRoleCategory(voice, category.value))
    );

const VOICE_LIBRARY_PAGE_SIZE = 50;
/** ElevenLabs shared-voices API only accepts these category filters; other values are applied client-side. */
const SHARED_LIBRARY_CATEGORY_API = new Set(["professional", "famous", "high_quality"]);

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

const voiceFiltersForSpeakerGender = (speaker) => ({
    ...emptyAppliedVoiceFilters(),
    gender: normalizeGenderToken(speaker?.gender),
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
    if (applied.category && SHARED_LIBRARY_CATEGORY_API.has(applied.category.toLowerCase())) {
        p.set("category", applied.category.toLowerCase());
    }
    return p;
};

const clientRefineVoicesByTonePitch = (items, tone, pitch) => {
    if (!tone && !pitch) return items;
    return items.filter((v) => {
        if (!voiceMatchesPitch(v, pitch)) return false;
        if (!voiceMatchesTone(v, tone)) return false;
        return true;
    });
};

const STYLE_LIMITS = {
    Interview: [2, 3],
    Storytelling: [1, 2, 3],
    Educational: [1, 2, 3],
    Conversational: [2, 3],
};

const readSessionJson = (key, fallback = {}) => {
    try {
        return JSON.parse(sessionStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
        return fallback;
    }
};

const readStoredPodcastId = () => {
    const editData = readSessionJson("editData");
    return String(editData?.podcastId || "").trim();
};

const getPortalTarget = () => {
    if (typeof document === "undefined") return null;
    return document.body && document.body.nodeType === 1 ? document.body : null;
};


/* -------------------- overlay: rotating logo -------------------- */
function LoadingOverlay({ show, logoSrc = "/logo.png", title, subtitle, logoAlt = "WeCast logo" }) {
    if (!show) return null;
    const safeTitle = String(title || "").replace(/[?؟]/g, "");
    const overlay = (
        <div
            className="wecast-overlay grid place-items-center bg-black/70 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
        >
            <div className="w-[min(92vw,480px)] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl p-6">
                <div className="flex items-center gap-4">
                    <img
                        src={logoSrc}
                        alt={logoAlt}
                        className="w-12 h-12 rounded-full animate-[spin_6s_linear_infinite]"
                    />
                    <div>
                        <p className="font-extrabold text-black dark:text-white">
                            {safeTitle}
                        </p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            {subtitle}
                        </p>
                    </div>
                </div>
                <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div className="h-full w-1/3 animate-[shimmer_1.2s_ease_infinite] bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400" />
                </div>
            </div>
            <style>{`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
        </div>
    );
    const portalTarget = getPortalTarget();
    return portalTarget ? createPortal(overlay, portalTarget) : overlay;
}

/* -------------------- tiny toast -------------------- */
function Toast({ toast, onClose, closeLabel = "Close" }) {
  if (!toast) return null;
  if (!shouldShowEditingNotifications() && toast.type !== "error") return null;

  const fallbackMessage = "Something went wrong. Please try again.";
  const rawMessage = toast?.message;
  const safeMessage = typeof rawMessage === "string"
    ? rawMessage
    : typeof rawMessage === "number" || typeof rawMessage === "boolean"
      ? String(rawMessage)
      : fallbackMessage;

  const toastNode = (
    <div className="fixed top-4 right-4 z-[9998]">
      <div
        className={`rounded-xl px-4 py-3 shadow-lg border ${
          toast.type === "error"
            ? "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-900/20 dark:text-rose-100 dark:border-rose-800/40"
            : "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-100 dark:border-emerald-800/40"
        }`}
      >
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5" />
          <div className="text-sm font-medium">{safeMessage}</div>

          <button
            type="button"
            onClick={onClose}
            className="ml-3 opacity-60 hover:opacity-90"
            aria-label={closeLabel}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
  const portalTarget = getPortalTarget();
  return portalTarget ? createPortal(toastNode, portalTarget) : toastNode;
}


export default function CreatePro() {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === "ar";
    const [step, setStep] = useState(1);
    const [isFromStudioEntry, setIsFromStudioEntry] = useState(() =>
        (window.location.hash || "").includes("from=studio")
    );

    useEffect(() => {
        const onHashChange = () => {
            setIsFromStudioEntry((window.location.hash || "").includes("from=studio"));
        };
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    useEffect(() => {
        sessionStorage.setItem("currentStep", step);
    }, [step]);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }, [step]);

    const [generatedAudio, setGeneratedAudio] = useState(null);
    const [generatingAudio, setGeneratingAudio] = useState(false);
    const [currentPodcastId, setCurrentPodcastId] = useState(readStoredPodcastId);
    const [generatedScript, setGeneratedScript] = useState(null);
    const [showTitle, setShowTitle] = useState("");
    const [scriptTemplate, setScriptTemplate] = useState("");
    const [episodeTitle, setEpisodeTitle] = useState("");
    const [scriptStyle, setScriptStyle] = useState("");
    const [speakersCount, setSpeakersCount] = useState(0);
    const [speakers, setSpeakers] = useState([]);

// ElevenLabs shared Voice Library — seed for default picks; per-speaker lists from API
const [librarySeedVoices, setLibrarySeedVoices] = useState([]);
const [loadingLibrarySeed, setLoadingLibrarySeed] = useState(true);
const [libraryFilterOptions, setLibraryFilterOptions] = useState({
    languages: [],
    locales: [],
    accents: [],
    ages: [],
    use_cases: [],
    categories: [],
});
const [voiceAccentOptionsByLanguage, setVoiceAccentOptionsByLanguage] = useState({});

const [speakerVoiceLibrary, setSpeakerVoiceLibrary] = useState({});
const [speakerVoiceAppliedFilters, setSpeakerVoiceAppliedFilters] = useState({});
const [modalLibraryPreview, setModalLibraryPreview] = useState({});
const [voiceLibraryWarning, setVoiceLibraryWarning] = useState("");
const [elevenLabsAuthFailed, setElevenLabsAuthFailed] = useState(false);
const arabicAccentDebugRef = useRef(new Set());

// filters per speaker (modal draft)
const [speakerVoiceFilters, setSpeakerVoiceFilters] = useState({});
// { [index]: { open, q, gender, language, category, tone, pitch, accent, age } }

const speakerLibInitRef = useRef(new Set());
const speakerVoiceLibraryRef = useRef({});
const speakerVoiceAppliedFiltersRef = useRef({});
const speakerRefinedVoicesRef = useRef({});

const getVoiceId = (v) => v?.providerVoiceId || v?.id || v?.docId || "";

const fetchFallbackVoices = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("limit", "300");
    const res = await fetch(`${API_BASE}/api/voices?${params.toString()}`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `Fallback voices failed (${res.status})`);
    return Array.isArray(data?.items) ? data.items : [];
}, []);

const fetchLibraryItemsPage = useCallback(async (applied, page, pageSize = VOICE_LIBRARY_PAGE_SIZE) => {
    if (elevenLabsAuthFailed) {
        throw new Error("ElevenLabs API key is invalid or unauthorized.");
    }
    const params = buildLibraryUrlSearchParams(applied, page, pageSize);
    const url = `${API_BASE}/api/voices/elevenlabs?${params.toString()}`;
    const res = await fetch(url, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data?.error || `Failed to load voices (${res.status})`;
        if (String(msg).includes("401") || res.status === 401) {
            setElevenLabsAuthFailed(true);
        }
        throw new Error(msg);
    }
    const raw = Array.isArray(data.items) ? data.items : [];
    return {
        items: raw,
        hasMore: !!data.has_more,
        totalCount: typeof data.total_count === "number" ? data.total_count : raw.length,
    };
}, [elevenLabsAuthFailed]);

const loadSharedVoiceCatalog = useCallback(async () => {
    return ensureVoiceLibraryCatalog({
        fetchSeedPage: () => fetchLibraryItemsPage(emptyAppliedVoiceFilters(), 0, 100),
        fetchPageForAgeBuckets: (filters, page = 0, pageSize = 100) =>
            fetchLibraryItemsPage(filters, page, pageSize),
        fetchAccountVoices: async () => {
            const params = new URLSearchParams();
            params.set("provider", "ElevenLabs");
            params.set("limit", "300");
            const res = await fetch(`${API_BASE}/api/voices?${params.toString()}`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return [];
            return Array.isArray(data?.items) ? data.items : [];
        },
        fetchFallbackVoices: fetchFallbackVoices,
    });
}, [fetchFallbackVoices, fetchLibraryItemsPage]);

useEffect(() => {
    if (!librarySeedVoices.length) return;
    setVoiceAccentOptionsByLanguage((prev) => {
        const next = { ...prev };
        for (const language of VOICE_LANGUAGE_OPTIONS) {
            const normalizedLanguage = normalizeLanguageFilterValue(language);
            const options = buildAccentOptionsForLanguage(librarySeedVoices, normalizedLanguage);
            if (options.length) next[normalizedLanguage] = options;
        }
        return next;
    });
}, [librarySeedVoices]);

const applyVoiceLibraryForSpeaker = useCallback(
    async (speakerIndex, applied) => {
        setSpeakerVoiceAppliedFilters((prev) => ({ ...prev, [speakerIndex]: { ...applied } }));
        setSpeakerVoiceLibrary((prev) => ({
            ...prev,
            [speakerIndex]: {
                rawItems: [],
                hasMore: false,
                totalCount: 0,
                loading: true,
                nextPage: null,
                error: null,
                preFiltered: false,
            },
        }));
        try {
            const catalog = await loadSharedVoiceCatalog();
            const refined = clientRefineLibraryVoices(catalog, applied);
            speakerRefinedVoicesRef.current[speakerIndex] = refined;
            const pageSize = VOICE_LIBRARY_PAGE_SIZE;
            const firstPage = refined.slice(0, pageSize);
            setSpeakerVoiceLibrary((prev) => ({
                ...prev,
                [speakerIndex]: {
                    rawItems: firstPage,
                    hasMore: refined.length > pageSize,
                    totalCount: refined.length,
                    loading: false,
                    nextPage: refined.length > pageSize ? 1 : null,
                    error: null,
                    preFiltered: true,
                },
            }));
        } catch (e) {
            console.error(e);
            let fallbackItems = [];
            try {
                fallbackItems = await fetchFallbackVoices();
            } catch (fallbackErr) {
                console.error("fallback voices", fallbackErr);
            }
            if (String(e?.message || e).toLowerCase().includes("401") || String(e?.message || e).toLowerCase().includes("unauthorized")) {
                setElevenLabsAuthFailed(true);
            }
            setVoiceLibraryWarning("Unable to load ElevenLabs voices. Showing default voices.");
            speakerRefinedVoicesRef.current[speakerIndex] = fallbackItems;
            setSpeakerVoiceLibrary((prev) => ({
                ...prev,
                [speakerIndex]: {
                    rawItems: fallbackItems.slice(0, VOICE_LIBRARY_PAGE_SIZE),
                    hasMore: fallbackItems.length > VOICE_LIBRARY_PAGE_SIZE,
                    totalCount: fallbackItems.length,
                    loading: false,
                    nextPage: fallbackItems.length > VOICE_LIBRARY_PAGE_SIZE ? 1 : null,
                    error: fallbackItems.length ? null : (e.message || String(e)),
                    preFiltered: true,
                },
            }));
        }
    },
    [fetchFallbackVoices, loadSharedVoiceCatalog]
);

const appendVoiceLibraryPageForSpeaker = useCallback((speakerIndex) => {
    const st = speakerVoiceLibraryRef.current[speakerIndex];
    if (!st?.hasMore || st.nextPage == null || st.loading) return;
    const refined = speakerRefinedVoicesRef.current[speakerIndex] || [];
    const page = st.nextPage;
    const pageSize = VOICE_LIBRARY_PAGE_SIZE;
    const end = (page + 1) * pageSize;
    setSpeakerVoiceLibrary((prev) => ({
        ...prev,
        [speakerIndex]: {
            ...(prev[speakerIndex] || {}),
            rawItems: refined.slice(0, end),
            hasMore: refined.length > end,
            totalCount: refined.length,
            loading: false,
            nextPage: refined.length > end ? page + 1 : null,
            error: null,
            preFiltered: true,
        },
    }));
}, []);

useEffect(() => {
    speakerVoiceLibraryRef.current = speakerVoiceLibrary;
}, [speakerVoiceLibrary]);

useEffect(() => {
    speakerVoiceAppliedFiltersRef.current = speakerVoiceAppliedFilters;
}, [speakerVoiceAppliedFilters]);

useEffect(() => {
    let cancelled = false;
    (async () => {
        try {
            const items = await loadSharedVoiceCatalog();
            if (!cancelled) {
                setLibrarySeedVoices(items);
                if (!items.length) {
                    setVoiceLibraryWarning("Unable to load ElevenLabs voices. Showing default voices.");
                }
            }
        } catch (e) {
            console.error("library seed", e);
            if (!cancelled) setLibrarySeedVoices([]);
        } finally {
            if (!cancelled) setLoadingLibrarySeed(false);
        }
    })();
    return () => {
        cancelled = true;
    };
}, [loadSharedVoiceCatalog]);

useEffect(() => {
    (async () => {
        try {
            const res = await fetch(`${API_BASE}/api/voices/library-options`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return;
            setLibraryFilterOptions({
                languages: Array.isArray(data.languages) ? data.languages : [],
                locales: Array.isArray(data.locales) ? data.locales : [],
                accents: Array.isArray(data.accents) ? data.accents : [],
                ages: Array.isArray(data.ages) ? data.ages : [],
                use_cases: Array.isArray(data.use_cases) ? data.use_cases : [],
                categories: Array.isArray(data.categories) ? data.categories : [],
            });
        } catch (e) {
            console.error("library-options", e);
        }
    })();
}, []);

useEffect(() => {
    const n = speakers.length;
    for (const k of [...speakerLibInitRef.current]) {
        if (k >= n) speakerLibInitRef.current.delete(k);
    }
}, [speakers.length]);

useEffect(() => {
    speakers.forEach((speaker, i) => {
        if (speakerLibInitRef.current.has(i)) return;
        speakerLibInitRef.current.add(i);
        applyVoiceLibraryForSpeaker(i, voiceFiltersForSpeakerGender(speaker));
    });
}, [speakers, applyVoiceLibraryForSpeaker]);

const openFilterSpeakerIdx = useMemo(() => {
    for (let i = 0; i < speakers.length; i++) {
        if (speakerVoiceFilters[i]?.open) return i;
    }
    return -1;
}, [speakers.length, speakerVoiceFilters]);

const openFilterDraftKey = useMemo(() => {
    if (openFilterSpeakerIdx < 0) return "";
    return JSON.stringify(filtersModalToApplied(speakerVoiceFilters[openFilterSpeakerIdx] || {}));
}, [openFilterSpeakerIdx, speakerVoiceFilters]);

useEffect(() => {
    if (openFilterSpeakerIdx < 0) return;
    const i = openFilterSpeakerIdx;
    const t = setTimeout(() => {
        const f = speakerVoiceFilters[i];
        if (!f?.open) return;
        const applied = filtersModalToApplied(f);
        const catalog = getCachedVoiceCatalog() || librarySeedVoices;
        if (!catalog.length) {
            setModalLibraryPreview((p) => ({
                ...p,
                [i]: { totalCount: null, refinedCount: null, loading: true },
            }));
            return;
        }
        const accentApplied = { ...applied, accent: "" };
        const accentPool = clientRefineLibraryVoices(catalog, accentApplied);
        const refined = clientRefineLibraryVoices(catalog, applied);
        if (normalizeLanguageFilterValue(accentApplied.language) === "ar") {
            const accentValues = uniqueSortedDisplay(
                accentPool
                    .filter((v) => languageMatchesVoice("ar", v))
                    .flatMap((v) => accentDisplaysForLanguageFromVoice(v, "ar"))
            );
            const debugKey = `${i}:${JSON.stringify(accentApplied)}:${accentPool.length}:${accentValues.join("|")}`;
            if (!accentValues.length && !arabicAccentDebugRef.current.has(debugKey)) {
                arabicAccentDebugRef.current.add(debugKey);
                debugArabicAccentMetadata(accentPool, "Create/Add Speaker modal language preview");
            }
        }
        setModalLibraryPreview((p) => ({
            ...p,
            [i]: { totalCount: catalog.length, refinedCount: refined.length, loading: false, accentItems: accentPool },
        }));
    }, 150);
    return () => clearTimeout(t);
}, [openFilterDraftKey, openFilterSpeakerIdx, librarySeedVoices, speakerVoiceFilters]);

// Ensure each speaker has filter modal state
useEffect(() => {
    setSpeakerVoiceFilters((prev) => {
        const next = { ...prev };

        speakers.forEach((_, i) => {
            if (!next[i])
                next[i] = {
                    open: false,
                    q: "",
                    gender: "__all__",
                    language: DEFAULT_VOICE_LANGUAGE,
                    category: "",
                    tone: "",
                    pitch: "",
                    accent: "",
                    age: "",
                };
        });

        Object.keys(next).forEach((k) => {
            const idx = Number(k);
            if (idx >= speakers.length) delete next[k];
        });

        return next;
    });
}, [speakers]);

    const [description, setDescription] = useState("");
    const [errors, setErrors] = useState({});
    /** Per-speaker voice validation messages (step 2). */
    const [speakerVoiceErrors, setSpeakerVoiceErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [hoverKey, setHoverKey] = useState(null);
    const [guidelineKey, setGuidelineKey] = useState("");
    const [guidelineVisible, setGuidelineVisible] = useState(false);
    const [musicPreview, setMusicPreview] = useState(null);
    const guidelineHideTimerRef = useRef(null);
    const voicePreviewRef = useRef(null);
    const voicePreviewCacheRef = useRef(new Map());
    const [previewLoadingVoiceId, setPreviewLoadingVoiceId] = useState("");
    const [category, setCategory] = useState("");
    const [introMusic, setIntroMusic] = useState("");
    const [bodyMusic, setBodyMusic] = useState("");
    const [outroMusic, setOutroMusic] = useState("");
    const [availableTracks, setAvailableTracks] = useState([]);
    const [showSampleReplaceModal, setShowSampleReplaceModal] = useState(false);
    const [pendingSampleLang, setPendingSampleLang] = useState("en");

    const previewVoice = async (voiceId, voiceObj = null) => {
        if (!voiceId) {
            if (!voiceLibraryWarning) {
                setToast({ type: "error", message: t("create.speakers.selectVoice") });
            }
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

            if (elevenLabsAuthFailed) {
                setToast({
                    type: "error",
                    message: "Preview unavailable until ElevenLabs API key is valid.",
                });
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
                    Authorization: `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token")}`,
                },
                body: JSON.stringify({
                    voiceId,
                    text: "Hi, this is a WeCast sample.",
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                if (!voiceLibraryWarning) {
                    setToast({ type: "error", message: err?.error || "Preview failed" });
                }
                return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            voicePreviewCacheRef.current.set(voiceId, url);
            const audio = new Audio(url);
            voicePreviewRef.current = audio;
            await audio.play();
        } catch (e) {
            console.error(e);
            if (!voiceLibraryWarning) {
                setToast({ type: "error", message: "Preview failed" });
            }
        } finally {
            setPreviewLoadingVoiceId("");
        }
    };

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

    const rawDisplayedScript =
        scriptTemplate && showTitle
            ? scriptTemplate.replaceAll("{{SHOW_TITLE}}", showTitle)
            : generatedScript || "";

    const displayedScript = React.useMemo(() => {
        if (!rawDisplayedScript) return "";
        if (i18n.language !== "ar") return rawDisplayedScript;

        return rawDisplayedScript
            .replace(/\bINTRO\b/g, t("create.script.intro"))
            .replace(/\bBODY\b/g, t("create.script.body"))
            .replace(/\bOUTRO\b/g, t("create.script.outro"))
            .replace(/\[music\]/gi, t("create.script.musicTag"));
    }, [rawDisplayedScript, i18n.language, t]);

    // restore title and template when page reloads or user comes back
    useEffect(() => {
        syncCreateDraftLease(window.location.hash || "");
        let editData = readSessionJson("editData");
        if (import.meta.env.DEV && editData && Object.keys(editData).length) {
            console.log(
                "[create-rehydrate] source=sessionStorage:editData keys=",
                Object.keys(editData).join(",")
            );
        }

        if (editData.showTitle) {
            setShowTitle(editData.showTitle);
        }
        if (editData.scriptTemplate) {
            setScriptTemplate(editData.scriptTemplate);
        }
        if (editData.scriptStyle) {
            setScriptStyle(editData.scriptStyle);
        }
        if (editData.speakersCount) {
            setSpeakersCount(Number(editData.speakersCount));
        }
        if (Array.isArray(editData.speakers) && editData.speakers.length) {
            setSpeakers(editData.speakers);
        }
        if (editData.description) {
            setDescription(String(editData.description));
        }
    }, [t]);

    useEffect(() => {
        syncCreateDraftLease(window.location.hash || "");
        const draft = JSON.parse(sessionStorage.getItem("studioCreateDraft") || "{}");
        if (!draft || !draft.fromStudioCreate) return;

        if (draft.showTitle) {
            setShowTitle(draft.showTitle);
            setEpisodeTitle(draft.showTitle);
        }
        if (draft.scriptStyle) setScriptStyle(draft.scriptStyle);
        if (draft.speakersCount) setSpeakersCount(Number(draft.speakersCount));
        if (draft.description) setDescription(String(draft.description));

        sessionStorage.removeItem("studioCreateDraft");
    }, []);


    //  ElevenLabs voices

    const MIN = 500;
    const MAX = 2500;
    const countWords = (text) => String(text || "").trim().split(/\s+/).filter(Boolean).length;
    const resolveContentLanguage = (text) => {
        const raw = String(text || "");
        const arabicChars = (raw.match(/[\u0600-\u06FF]/g) || []).length;
        const latinChars = (raw.match(/[A-Za-z]/g) || []).length;
        if (arabicChars > 0 && arabicChars >= latinChars) return "ar";
        return "en";
    };

    const EN_SAMPLE_TEXT = `Qiddiya: Saudi Arabia's Emerging Global Capital of Entertainment, Sports, and Culture
Qiddiya stands as one of the boldest and most imaginative components of Saudi Arabia's Vision 2030. Located just 40 kilometers southwest of Riyadh, the project is designed to transform the Kingdom's entertainment and cultural landscape, offering world-class experiences that appeal to residents, tourists, and global enthusiasts alike. Stretching across more than 360 square kilometers, Qiddiya is not simply a recreational zone. It is an entire city built around the idea that entertainment, creativity, and human connection can reshape how people live, learn, and spend their time.
From its inception, Qiddiya was envisioned as a place where people can break away from routine and immerse themselves in new experiences. The city's master plan blends natural landscapes with cutting-edge architecture, creating environments that support adventure, performance, learning, and relaxation. Its massive scope makes it one of the largest entertainment developments in the world, and it aims to position Saudi Arabia as a major global destination in this sector.
One of Qiddiya's most anticipated attractions is its flagship theme park district, which will feature thrill rides, family activities, and landmark amusement experiences. Among these attractions is Falcon's Flight, expected to be the world's fastest, tallest, and longest roller coaster. This ride alone has already drawn worldwide attention, signaling Qiddiya's intention to push boundaries and set new records. Alongside the theme parks, the city will host a state-of-the-art water park, outdoor adventure zones, and immersive digital entertainment centers that reflect the growing demand for interactive experiences.
Qiddiya is equally committed to developing sports. The project includes facilities for football, basketball, swimming, climbing, and extreme sports, as well as a motorsport complex capable of holding major international events. The motorsport zone will include tracks designed for speed, precision, and professional competitions, helping create new opportunities for athletes, teams, and spectators. By investing in these areas, Qiddiya aims to nurture local talent and promote a more active, engaged lifestyle for the Saudi population.
Culture and arts form another core pillar of the project. Qiddiya will feature performance theaters, museums, creative studios, and festival venues that support both Saudi and international art forms. These spaces will offer opportunities for learning, innovation, and artistic exchange, encouraging young creators to explore their talents and share their stories. With a focus on education and creative development, Qiddiya aims to inspire the next generation of Saudi artists, designers, and performers.
Economically, the impact of Qiddiya is expected to be significant. The project will generate thousands of jobs across a wide range of fields, from technology and engineering to hospitality, design, and operations. Its location near Riyadh positions it to attract millions of visitors each year, contributing to the growth of both domestic and international tourism. As the Kingdom continues diversifying its economy, Qiddiya will play a key role in helping build a sustainable entertainment sector that supports long-term growth.
In terms of lifestyle, Qiddiya's residential areas will integrate seamlessly with its recreational spaces. Housing, retail centers, hotels, green parks, and community facilities will form a vibrant environment where people can live close to entertainment, culture, and nature. This approach reflects a modern vision of city planning that prioritizes convenience, quality of life, and social connection.
Qiddiya represents a powerful statement about the future Saudi Arabia is building. It is more than a destination. It is a symbol of innovation, ambition, and cultural transformation. As it continues to develop, the city promises not only unforgettable experiences, but also new opportunities for learning, creativity, and community. By blending entertainment with education, nature with technology, and global trends with local identity, Qiddiya is set to redefine what a modern entertainment city can be.`;

    const AR_SAMPLE_TEXT = `القدية: عاصمة سعودية صاعدة للترفيه والرياضة والثقافة
تُعد القدية واحدة من أكثر مشاريع رؤية السعودية 2030 طموحًا وابتكارًا. تقع على بُعد نحو 40 كيلومترًا جنوب غرب الرياض، وقد صُممت لإحداث نقلة نوعية في مشهد الترفيه والثقافة داخل المملكة، من خلال تقديم تجارب عالمية المستوى تستهدف السكان والزوار والمهتمين من مختلف أنحاء العالم. وتمتد القدية على مساحة تتجاوز 360 كيلومترًا مربعًا، وهي ليست مجرد منطقة ترفيهية، بل مدينة متكاملة تقوم على فكرة أن الترفيه والإبداع والتواصل الإنساني يمكن أن يعيدوا تشكيل طريقة عيش الناس وتعلمهم وقضاء أوقاتهم.
منذ انطلاق فكرتها، تم تصور القدية كمكان يبتعد فيه الناس عن الروتين وينغمسون في تجارب جديدة. وتمزج الخطة الرئيسية للمدينة بين الطبيعة والهندسة المعمارية الحديثة، لتوفير بيئات تدعم المغامرة والعروض الفنية والتعلم والاسترخاء. ويجعلها حجمها الضخم واحدة من أكبر وجهات الترفيه قيد التطوير في العالم، كما تهدف إلى ترسيخ مكانة السعودية كوجهة عالمية رئيسية في هذا القطاع.
ومن أبرز معالم القدية المرتقبة منطقة المدن الترفيهية الكبرى، التي ستضم ألعابًا حماسية وأنشطة عائلية وتجارب ترفيهية فريدة. ومن بين هذه المعالم لعبة فالكونز فلايت، المتوقع أن تكون الأسرع والأطول والأعلى في العالم. وقد لاقت هذه اللعبة اهتمامًا عالميًا واسعًا، ما يعكس رغبة القدية في تجاوز الحدود التقليدية وصناعة أرقام قياسية جديدة. وإلى جانب المدن الترفيهية، ستضم المدينة حديقة مائية متطورة، ومناطق مغامرات خارجية، ومراكز ترفيه رقمي تفاعلي تواكب الطلب المتزايد على التجارب الحديثة.
كما تولي القدية اهتمامًا كبيرًا بالرياضة، إذ تشمل مرافق لكرة القدم وكرة السلة والسباحة والتسلق والرياضات المتطرفة، إضافة إلى مجمع رياضي للمحركات قادر على استضافة بطولات دولية كبرى. وسيضم هذا المجمع حلبات مصممة للسرعة والدقة والمنافسات الاحترافية، بما يفتح آفاقًا جديدة للرياضيين والفرق والجماهير. ومن خلال هذه الاستثمارات، تسعى القدية إلى تنمية المواهب المحلية وتعزيز نمط حياة أكثر نشاطًا وحيوية في المجتمع السعودي.
وتُعد الثقافة والفنون ركيزة أساسية أخرى في المشروع. إذ ستحتضن القدية مسارح للعروض ومتاحف واستوديوهات إبداعية ومواقع للمهرجانات تدعم الفنون السعودية والعالمية. وستوفر هذه المساحات فرصًا للتعلم والابتكار والتبادل الفني، بما يشجع الجيل الجديد على اكتشاف مواهبه والتعبير عن قصصه. ومع التركيز على التعليم والتطوير الإبداعي، تهدف القدية إلى إلهام جيل جديد من الفنانين والمصممين والمبدعين في المملكة.
اقتصاديًا، من المتوقع أن يكون أثر القدية كبيرًا، حيث ستوفر آلاف الوظائف في مجالات متنوعة مثل التقنية والهندسة والضيافة والتصميم والتشغيل. كما أن قربها من الرياض يجعلها مؤهلة لاستقطاب ملايين الزوار سنويًا، بما يدعم نمو السياحة المحلية والدولية. ومع استمرار المملكة في تنويع اقتصادها، ستلعب القدية دورًا محوريًا في بناء قطاع ترفيهي مستدام يدعم النمو طويل الأجل.
وعلى مستوى نمط الحياة، ستتكامل المناطق السكنية في القدية مع مساحات الترفيه بسلاسة. فالمنازل ومراكز التسوق والفنادق والحدائق والمرافق المجتمعية ستشكّل بيئة نابضة بالحياة يعيش فيها الناس بالقرب من الثقافة والطبيعة والأنشطة المتنوعة. ويعكس هذا التوجه رؤية حديثة للتخطيط الحضري تركز على الراحة وجودة الحياة وتعزيز الروابط الاجتماعية.
تمثل القدية رسالة قوية عن المستقبل الذي تبنيه السعودية. فهي ليست مجرد وجهة، بل رمز للابتكار والطموح والتحول الثقافي. ومع استمرار تطورها، تعد المدينة بتقديم تجارب لا تُنسى وفرص جديدة للتعلم والإبداع وبناء المجتمع. ومن خلال المزج بين الترفيه والتعليم، والطبيعة والتقنية، والاتجاهات العالمية والهوية المحلية، تستعد القدية لإعادة تعريف مفهوم مدينة الترفيه الحديثة.`;

    const ensureMinWords = (baseText) => {
        const chunks = [];
        while (countWords(chunks.join("\n\n")) < MIN) {
            chunks.push(baseText);
        }
        return chunks.join("\n\n");
    };

    const buildSampleText = (lang = "en") => {
        const base = lang === "ar" ? AR_SAMPLE_TEXT : EN_SAMPLE_TEXT;
        return ensureMinWords(base);
    };

    const applySampleText = (lang = "en") => {
        setDescription(buildSampleText(lang));
        setErrors((prev) => ({ ...prev, description: "", server: "" }));
    };

    const handleUseSampleText = (lang = "en") => {
        if (description.trim()) {
            setPendingSampleLang(lang);
            setShowSampleReplaceModal(true);
            return;
        }
        applySampleText(lang);
    };

    useEffect(() => {
        const handleNavigation = () => {
            syncCreateDraftLease(window.location.hash || "");
            const urlParams = new URLSearchParams(window.location.search);
            const stepParam = urlParams.get("step");
            const forceStep = sessionStorage.getItem("forceStep");
            const editData = readSessionJson("editData");
            const saved = sessionStorage.getItem("currentStep");

            if (editData.fromEdit && (editData.currentScript || editData.generatedScript || editData.scriptTemplate)) {
                const directScript =
                    String(editData.currentScript || "").trim() ||
                    String(editData.generatedScript || "").trim();
                const template = directScript ? "" : (editData.scriptTemplate || "");

                const titleFromStorage =
                    (editData.showTitle || "").trim() ||
                    (editData.episodeTitle || "").trim() ||
                    t("create.defaults.podcastShow");


                const rendered = directScript || (template.includes("{{SHOW_TITLE}}")
                    ? template.replaceAll("{{SHOW_TITLE}}", titleFromStorage)
                    : template);

                setGeneratedScript(rendered);
                setScriptTemplate(template);
                setShowTitle(titleFromStorage);
                setEpisodeTitle(titleFromStorage);

                setScriptStyle(editData.scriptStyle || "");
                setSpeakersCount(editData.speakersCount || 0);
                setSpeakers(editData.speakers || []);
                setDescription(editData.description || "");

                setStep(4);

                sessionStorage.removeItem("forceStep");
                const cleanEditData = { ...editData };
                delete cleanEditData.fromEdit;
                sessionStorage.setItem("editData", JSON.stringify(cleanEditData));
                return;
            }

            const storedScript =
                String(editData.currentScript || "").trim() ||
                String(editData.generatedScript || "").trim();
            const targetStep = Number.parseInt(forceStep || stepParam || saved || "", 10);
            if (storedScript && Number.isFinite(targetStep) && targetStep >= 4) {
                setGeneratedScript(storedScript);
                setScriptTemplate("");
                const titleFromStorage =
                    (editData.showTitle || "").trim() ||
                    (editData.episodeTitle || "").trim() ||
                    t("create.defaults.podcastShow");
                setShowTitle(titleFromStorage);
                setEpisodeTitle(titleFromStorage);
                setScriptStyle(editData.scriptStyle || "");
                setSpeakersCount(editData.speakersCount || 0);
                setSpeakers(editData.speakers || []);
                setDescription(editData.description || "");
            }

            if (forceStep) {
                const nextStep = Number.parseInt(forceStep, 10);
                setStep(Number.isFinite(nextStep) && nextStep > 0 ? nextStep : 1);
                sessionStorage.removeItem("forceStep");
                return;
            }

            if (stepParam) {
                const nextStep = Number.parseInt(stepParam, 10);
                setStep(Number.isFinite(nextStep) && nextStep > 0 ? nextStep : 1);
                return;
            }

            if (saved) {
                const nextStep = Number.parseInt(saved, 10);
                setStep(Number.isFinite(nextStep) && nextStep > 0 ? nextStep : 1);
            }
        };

        handleNavigation();
    }, [t]);


    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            const editData = readSessionJson("editData");

            if (hash === '#/edit' && generatedScript) {
                setStep(4);
            } else if (hash === '#/create') {
                if (editData.fromEdit && (editData.currentScript || editData.generatedScript)) {
                    const editedScript = editData.currentScript || editData.generatedScript;
                    setGeneratedScript(editedScript);
                    setScriptStyle(editData.scriptStyle || "");
                    setSpeakersCount(editData.speakersCount || 0);
                    setSpeakers(editData.speakers || []);
                    setDescription(editData.description || "");

                    let titleFromStorage =
                        (editData.showTitle || "").trim() ||
                        (editData.episodeTitle || "").trim();

                    if (!titleFromStorage) {
                        titleFromStorage = t("create.defaults.podcastShow");
                    }


                    setScriptTemplate("");
                    if (titleFromStorage) {
                        setShowTitle(titleFromStorage);
                        setEpisodeTitle(titleFromStorage);
                    }

                    setStep(4);
                    const cleanEditData = { ...editData };
                    delete cleanEditData.fromEdit;
                    sessionStorage.setItem('editData', JSON.stringify(cleanEditData));
                } else if (generatedScript) {
                    setStep(4);
                }
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        handleHashChange();

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [generatedScript, t]);



    /* ---------- rules ---------- */
    const STYLE_GUIDELINES = {
        Interview: {
            tone: t("create.guidelines.interview.tone"),
            flow: t("create.guidelines.interview.flow"),
            goal: t("create.guidelines.interview.goal"),
        },
        Storytelling: {
            tone: t("create.guidelines.storytelling.tone"),
            flow: t("create.guidelines.storytelling.flow"),
            goal: t("create.guidelines.storytelling.goal"),
        },
        Educational: {
            tone: t("create.guidelines.educational.tone"),
            flow: t("create.guidelines.educational.flow"),
            goal: t("create.guidelines.educational.goal"),
        },
        Conversational: {
            tone: t("create.guidelines.conversational.tone"),
            flow: t("create.guidelines.conversational.flow"),
            goal: t("create.guidelines.conversational.goal"),
        },
    };

    const styleCards = [
        {
            key: "Interview",
            title: t("create.styles.interview.title"),
            caption: t("create.styles.interview.caption"),
            bullets: [
                t("create.styles.interview.bullets.hosts"),
                t("create.styles.interview.bullets.guests"),
                t("create.styles.interview.bullets.pacing"),
            ],
            valid: t("create.styles.interview.valid"),
        },
        {
            key: "Storytelling",
            title: t("create.styles.storytelling.title"),
            caption: t("create.styles.storytelling.caption"),
            bullets: [
                t("create.styles.storytelling.bullets.hosts"),
                t("create.styles.storytelling.bullets.guests"),
                t("create.styles.storytelling.bullets.pacing"),
            ],
            valid: t("create.styles.storytelling.valid"),
        },
        {
            key: "Educational",
            title: t("create.styles.educational.title"),
            caption: t("create.styles.educational.caption"),
            bullets: [
                t("create.styles.educational.bullets.hosts"),
                t("create.styles.educational.bullets.guests"),
                t("create.styles.educational.bullets.pacing"),
            ],
            valid: t("create.styles.educational.valid"),
        },
        {
            key: "Conversational",
            title: t("create.styles.conversational.title"),
            caption: t("create.styles.conversational.caption"),
            bullets: [
                t("create.styles.conversational.bullets.hosts"),
                t("create.styles.conversational.bullets.guests"),
                t("create.styles.conversational.bullets.pacing"),
            ],
            valid: t("create.styles.conversational.valid"),
        },
    ];

    const defaultCount = (style) =>
        style === "Interview" ? 2 : style === "Conversational" ? 2 : 1;

    const styleLabelMap = useMemo(() => ({
        Interview: t("create.styles.interview.title"),
        Storytelling: t("create.styles.storytelling.title"),
        Educational: t("create.styles.educational.title"),
        Conversational: t("create.styles.conversational.title"),
    }), [t]);

    const activeGuidelineTarget = hoverKey || "";

    useEffect(() => {
        if (guidelineHideTimerRef.current) {
            clearTimeout(guidelineHideTimerRef.current);
            guidelineHideTimerRef.current = null;
        }

        if (activeGuidelineTarget) {
            setGuidelineKey(activeGuidelineTarget);
            const raf = requestAnimationFrame(() => setGuidelineVisible(true));
            return () => cancelAnimationFrame(raf);
        }

        setGuidelineVisible(false);
        guidelineHideTimerRef.current = setTimeout(() => {
            setGuidelineKey("");
            guidelineHideTimerRef.current = null;
        }, 220);

        return () => {
            if (guidelineHideTimerRef.current) {
                clearTimeout(guidelineHideTimerRef.current);
                guidelineHideTimerRef.current = null;
            }
        };
    }, [activeGuidelineTarget]);

    useEffect(() => () => {
        if (guidelineHideTimerRef.current) {
            clearTimeout(guidelineHideTimerRef.current);
            guidelineHideTimerRef.current = null;
        }
    }, []);

    const roleLabelFor = (role) => {
        if (role === "host") return t("create.roles.host");
        if (role === "guest") return t("create.roles.guest");
        if (role === "cohost") return t("create.roles.cohost");
        if (role === "narrator") return t("create.roles.narrator");
        return t("create.roles.speaker");
    };




    useEffect(() => {
        if (!scriptStyle) return;

        setSpeakers((prev) => {
            const limits = STYLE_LIMITS[scriptStyle] || [];

            let count = prev.length || Number(speakersCount) || 0;

            if (!count || !limits.includes(count)) {
                count = defaultCount(scriptStyle);
                setSpeakersCount(count);
            }

            const next = Array.from({ length: count }).map((_, i) => {
                const old = prev[i] || {};
                const gender = old.gender || (i === 0 ? "Male" : "Female");

                return {
                    name: old.name || "",
                    gender,
                    role: old.role || "host",
                    voiceId: old.voiceId || "",
                    filterPreset: old.filterPreset || "all",
                };
            });

            if (scriptStyle === "Interview") {
                if (count === 2) {
                    next[0].role = "host";
                    next[1].role = "guest";
                } else {
                    next[0].role = "host";
                    next[1].role = "host";
                    next[2].role = "guest";
                }
            } else if (scriptStyle === "Conversational") {
                next.forEach((s) => {
                    s.role = "host";
                });
            } else if (scriptStyle === "Educational" || scriptStyle === "Storytelling") {
                if (count === 1) {
                    next[0].role = "host";
                } else if (count === 2) {
                    next[0].role = "host";
                    next[1].role = "guest";
                } else if (count === 3) {
                    next[0].role = "host";
                    next[1].role = "guest";
                    next[2].role = "guest";
                }
            }
            // other styles: keep roles as they are

            return next;
        });

        setErrors({});
    }, [scriptStyle, speakersCount]);



    useEffect(() => {
        if (!scriptStyle || !speakersCount) return;
        const count = Number(speakersCount);
        const limits = STYLE_LIMITS[scriptStyle] || [];
        if (!limits.includes(count)) return;

        setSpeakers((prev) => {
            const next = Array.from({ length: count }).map((_, i) => {
                const old = prev[i] || {};
                const gender = old.gender || "Male";
                return {
                    name: old.name || "",
                    gender,
                    role: old.role || "host",
                    voiceId: old.voiceId || "",
                    filterPreset: old.filterPreset || "all",
                };
            });

            if (scriptStyle === "Interview") {
                if (count === 2) {
                    next[0].role = "host";
                    next[1].role = "guest";
                } else {
                    next[0].role = "host";
                    next[1].role = "host";
                    next[2].role = "guest";
                }
            } else if (scriptStyle === "Conversational") {
                next.forEach((s) => (s.role = "host"));
            } else if (scriptStyle === "Educational" || scriptStyle === "Storytelling") {
                if (count === 1) next[0].role = "host";
                else if (count === 2) {
                    next[0].role = "host";
                    next[1].role = "guest";
                } else if (count === 3) {
                    next[0].role = "host";
                    next[1].role = "guest";
                    next[2].role = "guest";
                }
            } else {
                if (count === 1) next[0].role = "host";
                if (count === 2) {
                    next[0].role = "host";
                    next[1].role = "guest";
                }
                if (count === 3) {
                    next[0].role = "host";
                    next[1].role = "guest";
                    next[2].role = "guest";
                }
            }
            return next;
        });
    }, [speakersCount, scriptStyle, librarySeedVoices.length]);

    /* ---------- helpers ---------- */
    const allowedCounts = useMemo(() => STYLE_LIMITS[scriptStyle] || [], [scriptStyle]);
    const anyEmptySpeakerName = speakers.some((s) => !String(s.name || "").trim());

    const normalizeName = (s = "") =>
        s.trim().toLowerCase().replace(/\s+/g, " ");

    // Duplicate names:
    const hasDuplicateNames = useMemo(() => {
        const names = speakers
            .map((s) => normalizeName(s.name))
            .filter(Boolean); // ignore empty
        return new Set(names).size !== names.length;
    }, [speakers]);

    const continueFromStyle = () => {
        if (!scriptStyle) {
            setErrors({ script_style: t("create.errors.chooseStyle") });
            setToast({ type: "error", message: t("create.toasts.chooseStyle") });
            setTimeout(() => setToast(null), 2600);
            return;
        }
        const count = Number(speakersCount) || defaultCount(scriptStyle);
        const editData = {
            ...readSessionJson("editData"),
            scriptStyle,
            speakersCount: count,
            speakers,
            description,
        };
        sessionStorage.setItem("editData", JSON.stringify(editData));
        sessionStorage.setItem("currentStep", "2");
        setSpeakersCount(count);
        setErrors({});
        setStep(2);
        setToast({ type: "success", message: t("create.toasts.styleSelected") });
        setTimeout(() => setToast(null), 2400);
    };

    const onContinueFromSpeakers = () => {
        const errs = {};
        if (!scriptStyle) errs.script_style = t("create.errors.chooseStyle");
        if (!allowedCounts.includes(Number(speakersCount))) {
            errs.speakers = t("create.errors.invalidSpeakersCount");
        }
        if (anyEmptySpeakerName) {
            errs.speaker_names = t("create.errors.missingSpeakerNames");
        } else if (hasDuplicateNames) {
            errs.speaker_names = t("create.errors.duplicateSpeakerNames");
        }

        const voiceErrs = {};
        speakers.forEach((speaker, index) => {
            if (!String(speaker?.voiceId || "").trim()) {
                voiceErrs[index] = t("create.errors.missingSpeakerVoice");
            }
        });
        if (Object.keys(voiceErrs).length > 0) {
            setSpeakerVoiceErrors(voiceErrs);
            errs.speaker_voices = t("create.errors.missingSpeakerVoices");
        } else {
            setSpeakerVoiceErrors({});
        }

        setErrors(errs);
        if (Object.keys(errs).length === 0) {
            const editData = {
                ...readSessionJson("editData"),
                scriptStyle,
                speakersCount,
                speakers,
                description,
            };
            sessionStorage.setItem("editData", JSON.stringify(editData));
            sessionStorage.setItem("currentStep", "3");
            setStep(3);
            setToast({ type: "success", message: t("create.toasts.speakersSet") });
            setTimeout(() => setToast(null), 2400);
        } else {
            const toastMessage =
                errs.speaker_voices ||
                errs.speaker_names ||
                errs.speakers ||
                errs.script_style ||
                Object.values(errs)[0];
            setToast({ type: "error", message: toastMessage });
            setTimeout(() => setToast(null), 2800);
        }
    };

    const clearSpeakerVoiceError = (speakerIndex) => {
        setSpeakerVoiceErrors((prev) => {
            if (!prev[speakerIndex]) return prev;
            const next = { ...prev };
            delete next[speakerIndex];
            return next;
        });
        setErrors((prev) => {
            if (!prev.speaker_voices) return prev;
            const next = { ...prev };
            delete next.speaker_voices;
            return next;
        });
    };

    const handleGenerate = async () => {
        const words = description.trim().split(/\s+/).filter(Boolean).length;
        const requestedLanguage = resolveContentLanguage(description);
        if (words < MIN) {
            setErrors({ description: t("create.errors.minWords", { min: MIN }) });
            return;
        }
        if (words > MAX) {
            setErrors({ description: t("create.errors.maxWords", { max: MAX }) });
            return;
        }

        setSubmitting(true);
        setErrors({});

        try {
            const res = await fetch(`${API_BASE}/api/generate`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    script_style: scriptStyle,
                    speakers: Number(speakersCount),
                    speakers_info: speakers,
                    description,
                    content_language: requestedLanguage,
                    language: requestedLanguage,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.script) {
        setErrors({ server: data.error || t("create.errors.generationFailed") });
                setSubmitting(false);
                return;
            }
            const podcastId = data.podcastId;
            setCurrentPodcastId(podcastId || "");
            const template = data.script;

            const backendTitle =
                data.show_title || data.title || t("create.defaults.podcastEpisode");

            setScriptTemplate(template);
            setShowTitle(backendTitle);
            setEpisodeTitle(backendTitle);

            const rendered = template.replaceAll("{{SHOW_TITLE}}", backendTitle);
            setGeneratedScript(rendered);


            const editData = {
                podcastId,
                scriptStyle,
                speakersCount,
                speakers,
                description,
                scriptTemplate: template,
                showTitle: backendTitle,
                episodeTitle: backendTitle,
                generatedScript: rendered,
                language: requestedLanguage,
            };
            sessionStorage.setItem("editData", JSON.stringify(editData));
            sessionStorage.removeItem("guestEditDraft");


            setToast({
                type: "success",
                message: t("create.toasts.scriptGenerated"),
            });
            setTimeout(() => setToast(null), 2400);
            setStep(4);
        } catch {
            setErrors({ server: t("create.errors.generationFailedBackend") });
        } finally {
            setSubmitting(false);
        }
    };

    const handleGenerateAudio = async () => {
        if (!generatedScript) {
            setToast({ type: "error", message: t("create.toasts.generateFirst") });
            setTimeout(() => setToast(null), 2800);
            return;
        }

        // 🔽 ADD THIS BLOCK HERE
        let editData = JSON.parse(sessionStorage.getItem("editData") || "{}");
        let podcastId = editData.podcastId || currentPodcastId;
        const scriptLanguage = editData.language || resolveContentLanguage(generatedScript || description);

        if (!podcastId) {
            try {
                const draftRes = await fetch(`${API_BASE}/api/draft`, {
                    credentials: "include",
                });
                if (draftRes.ok) {
                    const draft = await draftRes.json();
                    if (draft && draft.podcastId) {
                        podcastId = draft.podcastId;
                        editData = { ...editData, podcastId };
                        setCurrentPodcastId(podcastId);
                        sessionStorage.setItem("editData", JSON.stringify(editData));
                    }
                }
            } catch {
                // ignore and fall back to error toast
            }
        }

        if (!podcastId) {
            setToast({
            type: "error",
            message: t("create.errors.missingPodcastId"),
            });
            setTimeout(() => setToast(null), 2800);
            return; // ❗ stop BEFORE audio generation
        }
        // 🔼 END ADDITION

        setGeneratingAudio(true);
        setGeneratedAudio(null);

        try {
            const response = await fetch(`${API_BASE}/api/audio`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                scriptText: generatedScript,
                podcastId,          // ✅ IMPORTANT
                script_style: scriptStyle,
                speakers_info: speakers,
                language: scriptLanguage,
            }),
            });

            const data = await response.json();

            if (!response.ok || !data.url) {
            throw new Error(data.error || t("create.errors.audioGenerationFailed"));
            }

            const baseAudioUrl = data.url.startsWith("http")
            ? data.url
            : `${API_BASE}${data.url}`;

            const previewPayload = {
            url: baseAudioUrl,
            audioKey: data.audioKey || "",
            words: data.words || [],
            title: audioTitle,
            episodeTitle: audioTitle,
            podcastTitle: audioTitle,
            showTitle: showTitle || episodeTitle || audioTitle,
            generatedTitle: showTitle || episodeTitle || audioTitle,
            language: scriptLanguage,
            category,
            script: generatedScript,
            description,
            style: scriptStyle,
            speakers,
            };
            console.debug("[WeCast guest restore] title before login", {
                title: previewPayload.title,
                episodeTitle: previewPayload.episodeTitle,
                podcastTitle: previewPayload.podcastTitle,
                showTitle: previewPayload.showTitle,
                generatedTitle: previewPayload.generatedTitle,
            });
            sessionStorage.setItem("wecast_preview", JSON.stringify(previewPayload));

            setCurrentPodcastId(podcastId);
            setGeneratedAudio(baseAudioUrl);

            setToast({
            type: "success",
            message: t("create.toasts.audioGenerated"),
            });
            setTimeout(() => setToast(null), 2400);

        } catch (error) {
            console.error("Audio generation error:", error);
            setToast({
            type: "error",
            message: t("create.errors.audioGenerationFailedRetry"),
            });
            setTimeout(() => setToast(null), 2800);
        } finally {
            setGeneratingAudio(false);
        }
        };


    const navigateToEdit = () => {
        if (!generatedScript) {
            setToast({
                type: "error",
                message: t("create.toasts.generateFirstToEdit"),
            });
            setTimeout(() => setToast(null), 2800);
            return;
        }

        const editData = {
            podcastId: currentPodcastId || readStoredPodcastId(),
            scriptStyle,
            speakersCount,
            speakers,
            currentScript: generatedScript,
            generatedScript,
            description,
            scriptTemplate,
            showTitle,
            episodeTitle: showTitle,
        };

        sessionStorage.setItem("editData", JSON.stringify(editData));
        sessionStorage.setItem("currentStep", "4");
        markEditNavigationFromCreate();
        window.location.hash = "#/edit";
    };

    const navigateToFinalize = () => {
        const editData = JSON.parse(sessionStorage.getItem("editData") || "{}");
        const podcastId = editData.podcastId || currentPodcastId;

        if (!podcastId) {
            setToast({
                type: "error",
                message: t("create.errors.missingPodcastId"),
            });
            setTimeout(() => setToast(null), 2800);
            return;
        }

        markFinalizeNavigationFromCreate();
        window.location.hash = `#/finalize?podcastId=${encodeURIComponent(podcastId)}`;
    };

// Add this function before the return statement
const exportScript = async (format = "pdf") => {
  try {
    if (!generatedScript) {
      setToast({ type: "error", message: "No script content to export!" });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const exportHandler = format === "txt" ? exportScriptTxt : exportScriptPdf;

    await exportHandler({
      scriptContent: generatedScript,
      title: showTitle || "Podcast Script",
      scriptStyle,
      fileNameBase: showTitle || "podcast_script",
    });
    
    setToast({ type: "success", message: `Script exported as ${format.toUpperCase()} successfully!` });
    setTimeout(() => setToast(null), 3000);
    
  } catch (error) {
    console.error("Error exporting script:", error);
    setToast({ type: "error", message: "Failed to export script. Please try again." });
    setTimeout(() => setToast(null), 3000);
  }
};
    /* ---------- stepper ---------- */
    const stepTitles = {
        1: t("create.step1.title"),
        2: t("create.step2.title"),
        3: t("create.step3.title"),
        4: t("create.step4.title"),
        5: t("create.step5.title"),
        6: t("create.step6.title"),
    };

    const stepDescriptions = {
        1: t("create.step1.desc"),
        2: t("create.step2.desc"),
        3: t("create.step3.desc"),
        4: t("create.step4.desc"),
        5: t("create.step5.desc"),
        6: t("create.step6.desc"),
    };

    const stepperLabels = [
        t("create.stepper.chooseStyle"),
        t("create.stepper.addSpeakers"),
        t("create.stepper.writeContent"),
        t("create.stepper.reviewEdit"),
        t("create.stepper.selectMusic"),
        t("create.stepper.generateAudio"),
        t("finalizePublish"),
    ];
    const StepDot = ({ n, label }) => {
        const state = step === n ? "active" : step > n ? "done" : "pending";
        const dot = state === "active" ? "bg-purple-600 text-white shadow" :
            state === "done" ? "bg-neutral-300 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200" :
                "bg-black/10 dark:bg-white/10 text-black/70 dark:text-white/70";
        const labelCls = state === "active" ? "text-purple-600" :
            state === "done" ? "text-neutral-500 dark:text-neutral-400" :
                "text-black/60 dark:text-white/60";
        return (
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className={`w-8 h-8 rounded-full grid place-items-center text-sm font-bold ${dot}`}>
                    {n}
                </div>
                <div className={`hidden text-sm font-semibold sm:block ${labelCls}`}>{label}</div>
            </div>
        );
    };

    const StepLine = ({ on }) => (
        <div className={`h-[3px] flex-1 rounded-full ${on ? "bg-gradient-to-r from-purple-600 to-pink-500" : "bg-black/10 dark:bg-white/10"}`} />
    );

    const roleCounts = useMemo(() => {
        const counts = {};
        speakers.forEach((s) => {
            const r = s.role || "Speaker";
            counts[r] = (counts[r] || 0) + 1;
        });
        return counts;
    }, [speakers]);

    const roleUsage = {};

    const audioTitle = React.useMemo(
        () =>
            (showTitle && showTitle.trim()) ||
            (episodeTitle && episodeTitle.trim()) ||
            (scriptStyle
                ? t("create.audioTitleWithStyle", {
                      style: styleLabelMap[scriptStyle] || scriptStyle,
                      count: speakersCount,
                  })
                : t("create.defaults.podcastEpisode")),
        [showTitle, episodeTitle, scriptStyle, speakersCount, styleLabelMap, t]
    );
    const studioGlassPanelClass = "border border-black/10 bg-white/45 backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.08)]";
    const studioTopPanelClass = "border border-black/10 bg-white/70 backdrop-blur-sm shadow-[0_10px_30px_rgba(0,0,0,0.08)]";
    const studioCardClass = isFromStudioEntry ? `ui-card ${studioGlassPanelClass}` : "ui-card";



    return (
        <div className={`min-h-screen ${isFromStudioEntry ? "bg-cream dark:bg-[#0a0a1a]" : "bg-cream dark:bg-[#0a0a0a]"}`}>
            {!isFromStudioEntry && <div className="h-2 bg-purple-gradient" />}
            <main className={`w-full ${isFromStudioEntry ? "max-w-full border-b border-black/10 bg-white/70 dark:bg-neutral-900/45 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm" : "mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10"}`}>
                <div className={isFromStudioEntry ? "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 bg-white/35 dark:bg-neutral-900/20" : ""}>
                {/* Title */}
                {isFromStudioEntry ? (
                    <header className="-mx-4 sm:-mx-6 lg:-mx-8 mb-6 bg-white/75 dark:bg-neutral-900/45 border-b border-black/10 dark:border-white/10 backdrop-blur-sm">
                        <div className="px-4 sm:px-6 lg:px-8 py-4">
                            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                            <button
                                type="button"
                                onClick={() => { window.location.hash = "#/episodes"; }}
                                className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg"
                                aria-label="Back to Cast Studio"
                                title="Back to Cast Studio"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-black sm:text-2xl dark:text-white">Create New Episode</h1>
                                <p className="mt-1 text-sm text-black/60 dark:text-white/60">{stepTitles[step]} - {stepDescriptions[step]}</p>
                            </div>
                        </div>
                            </div>
                    </header>
                ) : (
                    <header className="mb-6 text-center">
                        <h1 className="text-3xl md:text-4xl font-extrabold text-black dark:text-white">
                            {stepTitles[step]}
                        </h1>

                        <p className="mt-2 text-black/70 dark:text-white/70">
                            {stepDescriptions[step]}
                        </p>
                    </header>
                )}



                {/* Stepper */}
                {step > 0 && (
                    <div className={`w-full max-w-[1400px] mx-auto rounded-2xl border p-3 sm:p-4 mb-8 overflow-x-auto ${
                        isFromStudioEntry
                            ? `${studioTopPanelClass} dark:bg-neutral-900/45 dark:border-white/10`
                            : "bg-white/60 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800"
                    }`}>
                        <div className="flex min-w-max items-center gap-2">
                            <StepDot n={1} label={stepperLabels[0]} />
                            <StepLine on={step > 1} />

                            <StepDot n={2} label={stepperLabels[1]} />
                            <StepLine on={step > 2} />

                            <StepDot n={3} label={stepperLabels[2]} />
                            <StepLine on={step > 3} />

                            <StepDot n={4} label={stepperLabels[3]} />
                            <StepLine on={step > 4} />

                            <StepDot n={5} label={stepperLabels[4]} />
                            <StepLine on={step > 5} />

                            <StepDot n={6} label={stepperLabels[5]} />
                            <StepLine on={false} />
                            <StepDot n={7} label={stepperLabels[6]} />
                        </div>
                    </div>
                )}




                <div className="max-w-5xl mx-auto">
                    {/* STEP 1: STYLE */}
                    {step === 1 && (
                        <section className={studioCardClass}>
                            <h2 className="ui-card-title flex items-center gap-2 justify-center">
                                <Mic2 className="w-4 h-4" /> {t("create.sections.podcastStyle")}
                            </h2>
                            <div className="mt-4 grid grid-cols-1 gap-4 justify-items-center sm:grid-cols-2">
                                {styleCards.map((s) => {
                                    const guideline = STYLE_GUIDELINES[s.key];
                                    const isGuidelineMounted = guidelineKey === s.key;
                                    const isGuidelineShown = isGuidelineMounted && guidelineVisible;

                                    return (
                                        <label
                                            key={s.key}
                                            onClick={() => setScriptStyle(s.key)}
                                            onMouseEnter={() => setHoverKey(s.key)}
                                            onMouseLeave={() => setHoverKey((k) => (k === s.key ? null : k))}
                                            onFocusCapture={() => setHoverKey(s.key)}
                                            onBlurCapture={(e) => {
                                                if (!e.currentTarget.contains(e.relatedTarget)) {
                                                    setHoverKey((k) => (k === s.key ? null : k));
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    setScriptStyle(s.key);
                                                }
                                            }}
                                            tabIndex={0}
                                            className={`group relative w-full max-w-xl rounded-xl border p-4 transition cursor-pointer ${
                                                isGuidelineMounted ? "z-20" : "z-0"
                                            } ${
                                                isFromStudioEntry
                                                    ? scriptStyle === s.key
                                                        ? "border-purple-500/80 bg-white text-black dark:bg-neutral-900 dark:text-white dark:border-purple-400/70"
                                                        : "border-purple-200/90 bg-white text-black hover:border-purple-300/95 hover:bg-white dark:bg-neutral-900 dark:text-white dark:border-white/15 dark:hover:border-purple-400/70 dark:hover:bg-neutral-900"
                                                    : scriptStyle === s.key
                                                        ? "border-purple-400/60 bg-purple-500/10"
                                                        : "border-neutral-300 dark:border-neutral-800 hover:bg-black/5 dark:hover:bg-white/5"
                                            }`}
                                        >
                                            {isGuidelineMounted && (
                                                <div
                                                    className={`pointer-events-none absolute inset-x-4 bottom-full mb-3 transition-[opacity,transform] duration-200 ease-out sm:inset-x-auto sm:w-[18.5rem] ${
                                                        isRTL ? "sm:right-4" : "sm:left-4"
                                                    } ${
                                                        isGuidelineShown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                                                    }`}
                                                >
                                                    <div className="relative overflow-hidden rounded-3xl border border-white/80 bg-[linear-gradient(155deg,rgba(255,255,255,0.98)_0%,rgba(250,245,255,0.96)_54%,rgba(241,232,255,0.95)_100%)] p-4 shadow-[0_22px_50px_rgba(109,40,217,0.18)] ring-1 ring-purple-100/80 backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(155deg,rgba(25,19,38,0.96)_0%,rgba(45,27,78,0.94)_58%,rgba(79,35,120,0.92)_100%)] dark:ring-purple-400/20">
                                                        <span
                                                            className={`absolute -bottom-2 h-4 w-4 rotate-45 rounded-[4px] border-r border-b border-white/80 bg-[#f2e8ff] dark:border-white/10 dark:bg-[#512c7e] ${
                                                                isRTL ? "right-8" : "left-8"
                                                            }`}
                                                        />
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                                                                <Info className="h-4 w-4 text-purple-500 dark:text-purple-300" />
                                                                <span>{t("create.guidelines.title")}</span>
                                                            </div>
                                                            <span className="rounded-full border border-purple-200/80 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-purple-600 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-purple-100">
                                                                {s.title}
                                                            </span>
                                                        </div>
                                                        <div className="mt-3 space-y-2.5 text-sm leading-5 text-slate-700 dark:text-white/85">
                                                            <p>
                                                                <span className="font-semibold text-slate-950 dark:text-white">
                                                                    {t("create.guidelines.tone")}:
                                                                </span>{" "}
                                                                {guideline.tone}
                                                            </p>
                                                            <p>
                                                                <span className="font-semibold text-slate-950 dark:text-white">
                                                                    {t("create.guidelines.flow")}:
                                                                </span>{" "}
                                                                {guideline.flow}
                                                            </p>
                                                            <p>
                                                                <span className="font-semibold text-slate-950 dark:text-white">
                                                                    {t("create.guidelines.goal")}:
                                                                </span>{" "}
                                                                {guideline.goal}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-start gap-3">
                                                <input type="radio" checked={scriptStyle === s.key} readOnly className="accent-purple-600 mt-1" />
                                                <div className="w-full">
                                                    <div className="flex items-center gap-2 font-bold">
                                                        <span className="truncate">{s.title}</span>
                                                        {scriptStyle === s.key && (
                                                            <span className="text-xs text-purple-500 flex items-center gap-1">
                                                                <Check className="w-3 h-3" /> {t("create.common.selected")}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm mt-1 text-black/80 dark:text-white/80">{s.caption}</p>
                                                    <ul className="flex flex-wrap gap-2 mt-2 text-xs text-black/70 dark:text-white/70">
                                                        {s.bullets.map((b, i) => (
                                                            <li
                                                                key={i}
                                                                className={`px-2 py-1 rounded ${
                                                                    isFromStudioEntry ? "bg-purple-50 text-purple-900/85 border border-purple-100 dark:bg-purple-900/25 dark:text-purple-200 dark:border-purple-400/30" : "bg-black/5 dark:bg-white/5"
                                                                }`}
                                                            >
                                                                {b}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    <p className="text-xs text-purple-500 mt-2">
                                                        {t("create.common.valid")}: {s.valid}
                                                    </p>
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                            {errors.script_style && <p className="text-rose-500 mt-3 flex items-center gap-2 justify-center"><AlertCircle className="w-4 h-4" /> {errors.script_style}</p>}
                            <div className="mt-6 flex justify-end">
                                <button onClick={continueFromStyle} className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold">
                                    {t("create.common.continue")} <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                                </button>
                            </div>
                        </section>
                    )}

                    {/* STEP 2: SPEAKERS */}
                    {step === 2 && (
                        <section className={studioCardClass}>
                            <h2 className="ui-card-title flex items-center gap-2 justify-center"><Users className="w-4 h-4" /> {t("create.sections.speakers")}</h2>
                            {!scriptStyle && (
                                <div className="mt-5 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <p>{t("create.errors.chooseStyle")}</p>
                                    </div>
                                </div>
                            )}
                            {scriptStyle && (
                                <div className="flex items-center gap-2 flex-wrap mt-3 justify-center">
                                    {allowedCounts.map((n) => (
                                        <button
                                            key={n}
                                            onClick={() => setSpeakersCount(n)}
                                            className={`px-4 py-2 text-sm font-semibold rounded-xl transition border ${
                                                speakersCount === n
                                                    ? "bg-purple-600 text-white border-purple-600"
                                                    : "bg-black/5 dark:bg-white/5 border-neutral-300 dark:border-neutral-800 text-black/70 dark:text-white/70 hover:bg-black/10"
                                            }`}
                                        >
                                            {n} {n === 1 ? t("create.common.speaker") : t("create.common.speakers")}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {speakers.length > 0 && (
                                <div className={`mt-5 grid gap-5 ${speakers.length === 1 ? "grid-cols-1 max-w-md" : speakers.length === 2 ? "grid-cols-1 md:grid-cols-2 max-w-4xl" : "grid-cols-1 md:grid-cols-3 max-w-5xl"} mx-auto`}>
                                    {speakers.map((sp, i) => {

                                        let rawRole = sp.role || "guest";

                                        const totalHosts = roleCounts["Host"] || roleCounts["host"] || 0;

                                        let roleKey;

                                        if (rawRole === "host" && totalHosts > 1) {
                                            roleKey = "cohost";
                                        } else if (rawRole === "host") {
                                            roleKey = "host";
                                        } else if (rawRole === "cohost") {
                                            roleKey = "cohost";
                                        } else if (rawRole === "narrator") {
                                            roleKey = "narrator";
                                        } else {
                                            roleKey = "guest";
                                        }

                                        roleUsage[roleKey] = (roleUsage[roleKey] || 0) + 1;
                                        const occurrence = roleUsage[roleKey];

                                        const roleLabel = t(`create.roles.${roleKey}`);
                                        const label =
                                            roleCounts[rawRole] > 1 && roleKey !== "host"
                                                ? `${roleLabel} ${occurrence}`
                                                : roleLabel;
                                        const isHostLocked = false;

                                        return (
                                            <div
                                                key={i}
                                                className="rounded-xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 w-full"
                                            >
                                                {/* Card title */}
                                                <h3 className="text-sm font-bold text-black/80 dark:text-white/80">
                                                    {label}
                                                </h3>
                                                <p className="mt-1 text-xs text-neutral-500">
                                                    {t("create.speakers.help")}
                                                </p>

                                                <div className="mt-3 space-y-3">
                                                    {/* Name */}
                                                    <div>
                                                        <label className="form-label">{t("create.speakers.name")}</label>
                                                        <input
                                                            value={sp.name}
                                                            disabled={isHostLocked}
                                                            onChange={(e) => {
                                                                const cleaned = e.target.value
                                                                    .replace(/[^\p{L}\s]/gu, "")
                                                                    .replace(/\s{2,}/g, " ");
                                                                setSpeakers((arr) => {
                                                                    const next = [...arr];
                                                                    next[i] = { ...next[i], name: cleaned };
                                                                    return next;
                                                                });
                                                            }}
                                                            placeholder={t("create.speakers.namePlaceholder", { label })}
                                                            className={`form-input ${errors.speaker_names && !sp.name.trim()
                                                                ? "border-rose-400"
                                                                : ""
                                                                } ${isHostLocked ? "opacity-70 cursor-not-allowed" : ""}`}
                                                        />
                                                    </div>

                                                    {/* Gender */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="form-label">{t("create.speakers.gender")}</label>
                                                            <select
                                                                value={sp.gender}
                                                                disabled={isHostLocked}
                                                                onChange={(e) => {
                                                                    setSpeakers((arr) => {
                                                                        const gender = e.target.value;
                                                                        const next = [...arr];

                                                                        const appliedPrev = speakerVoiceAppliedFiltersRef.current[i] || emptyAppliedVoiceFilters();
                                                                        const appliedNext = {
                                                                            ...appliedPrev,
                                                                            gender: normalizeGenderToken(gender),
                                                                        };

                                                                        // Clear selection until list refreshes; preserve if still valid later.
                                                                        next[i] = {
                                                                            ...next[i],
                                                                            gender,
                                                                            voiceId: "", // will be re-selected only if still in filtered list
                                                                        };

                                                                        // Apply gender to the same voice source used by Select Voice dropdown
                                                                        applyVoiceLibraryForSpeaker(i, appliedNext);

                                                                        return next;
                                                                    });
                                                                }}
                                                                dir={isRTL ? "rtl" : "ltr"}
                                                                className={`form-input select-input [color-scheme:light] dark:[color-scheme:dark] text-start ${isHostLocked ? "opacity-70 cursor-not-allowed" : ""}`}
                                                                style={{
                                                                    backgroundPosition: isRTL ? "left 0.75rem center" : "right 1rem center",
                                                                    paddingLeft: isRTL ? "2.25rem" : undefined,
                                                                    paddingRight: isRTL ? "1rem" : "2.5rem",
                                                                }}
                                                            >
                                                                <option value="Male">{t("create.speakers.genderMale")}</option>
                                                                <option value="Female">{t("create.speakers.genderFemale")}</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Voice picker */}
                                                    <div>
                                                        <label className="form-label">{t("create.speakers.voice")}</label>
                                                        {voiceLibraryWarning ? (
                                                            <p className="mb-2 text-xs text-amber-600 dark:text-amber-300">{voiceLibraryWarning}</p>
                                                        ) : null}
                                                        {(() => {
                                                            const applied = speakerVoiceAppliedFilters[i] || emptyAppliedVoiceFilters();
                                                            const libr = speakerVoiceLibrary[i] || {
                                                                rawItems: [],
                                                                loading: true,
                                                                hasMore: false,
                                                                totalCount: 0,
                                                                nextPage: null,
                                                                error: null,
                                                            };
                                                            const rawPool = libr.rawItems || [];
                                                            const catalogSource =
                                                                getCachedVoiceCatalog()?.length
                                                                    ? getCachedVoiceCatalog()
                                                                    : librarySeedVoices?.length
                                                                      ? librarySeedVoices
                                                                      : rawPool;
                                                            const allRefined = clientRefineLibraryVoices(catalogSource, applied);
                                                            const pageEnd =
                                                                libr.preFiltered && libr.nextPage != null
                                                                    ? (libr.nextPage + 1) * VOICE_LIBRARY_PAGE_SIZE
                                                                    : allRefined.length;
                                                            const pool = allRefined.slice(0, Math.min(pageEnd, allRefined.length));
                                                            const poolIds = new Set(pool.map(getVoiceId));
                                                            const currentId = sp.voiceId || "";
                                                            const safeValue = poolIds.has(currentId) ? currentId : "";
                                                            const listLoading = libr.loading && rawPool.length === 0;
                                                            const loadFailed = Boolean(!listLoading && libr.error);
                                                            const listEmpty = !listLoading && !loadFailed && pool.length === 0;
                                                            const hasMoreVoices = Boolean(libr.hasMore && !libr.loading);
                                                            return (
                                                                <div className="w-full">
                                                                    {listLoading ? (
                                                                        <p className="text-sm text-black/60 dark:text-white/60 mb-2">
                                                                            {t("create.speakers.loadingVoices")}
                                                                        </p>
                                                                    ) : null}
                                                                    {loadFailed ? (
                                                                        <p className="text-sm text-rose-500 mb-2">{libr.error}</p>
                                                                    ) : null}
                                                                    {listEmpty ? (
                                                                        <p className="text-sm text-black/60 dark:text-white/60 mb-2">
                                                                            {applied.accent
                                                                                ? t("create.speakers.noMatchingAccentVoices", {
                                                                                      defaultValue:
                                                                                          "No voices found for this accent. Try another accent or clear the accent filter.",
                                                                                  })
                                                                                : t("create.speakers.noVoicesFiltered", {
                                                                                      defaultValue: "No voices found. Try changing filters.",
                                                                                  })}
                                                                        </p>
                                                                    ) : null}
                                                                    <div className="flex items-center gap-3">
                                                                    {/* Filters dropdown (per speaker) */}
                                                                    {(() => {
                                                                    const f = speakerVoiceFilters[i] || {
                                                                        open: false,
                                                                        q: "",
                                                                        gender: "__all__",
                                                                        language: DEFAULT_VOICE_LANGUAGE,
                                                                        category: "",
                                                                        tone: "",
                                                                        pitch: "",
                                                                        accent: "",
                                                                        age: "",
                                                                    };
                                                                    const safeGenderFilter = getSafeModalGenderFilter(f.gender);

                                                                    const setF = (patch) => {
                                                                        setSpeakerVoiceFilters((prev) => ({
                                                                            ...prev,
                                                                            [i]: { ...prev[i], ...patch },
                                                                        }));
                                                                    };

                                                                    const selectedLanguage = normalizeLanguageFilterValue(f.language || DEFAULT_VOICE_LANGUAGE);
                                                                    const modalAccentItems = Array.isArray(modalLibraryPreview[i]?.accentItems)
                                                                        ? modalLibraryPreview[i].accentItems
                                                                        : [];
                                                                    const accentSourceVoices = Array.from(
                                                                        new Map(
                                                                            [...modalAccentItems, ...rawPool, ...librarySeedVoices]
                                                                                .filter(Boolean)
                                                                                .map((v, idx) => [getVoiceId(v) || `voice-${idx}`, v])
                                                                        ).values()
                                                                    );
                                                                    const stableOptionVoices = Array.from(
                                                                        new Map(
                                                                            [...librarySeedVoices, ...rawPool, ...accentSourceVoices]
                                                                                .filter(Boolean)
                                                                                .map((v, idx) => [getVoiceId(v) || `voice-${idx}`, v])
                                                                        ).values()
                                                                    );
                                                                    const accentOptionsForLanguage = (language) =>
                                                                        buildAccentOptionsForLanguage(
                                                                            stableOptionVoices,
                                                                            language,
                                                                            DEFAULT_VOICE_LANGUAGE
                                                                        );
                                                                    const accentOptions = accentOptionsForLanguage(selectedLanguage);
                                                                    const categoryOptions = roleCategoryOptionsForVoices(stableOptionVoices);
                                                                    const ageOptions = collectVoiceAgeOptions([
                                                                        ...VOICE_AGE_BUCKETS.map((age) => ({ age })),
                                                                        ...libraryFilterOptions.ages.map((age) => ({ age })),
                                                                        ...stableOptionVoices,
                                                                    ]);
                                                                    const hasActive = hasActiveModalVoiceFilters(f, safeGenderFilter);

                                                                    return (
                                                                        <>
                                                                    <button
                                                                    type="button"
                                                                    disabled={isHostLocked}
                                                                    onClick={() => {
                                                                        const a = speakerVoiceAppliedFilters[i] || emptyAppliedVoiceFilters();
                                                                        const speakerGenderTok = normalizeGenderToken(speakers?.[i]?.gender);
                                                                        const modalPatch = appliedFiltersToModalPatch(a);
                                                                        if (!a.gender) {
                                                                            modalPatch.gender = speakerGenderTok || "__all__";
                                                                        }
                                                                        setSpeakerVoiceFilters((prev) => ({
                                                                            ...prev,
                                                                            [i]: {
                                                                                ...prev[i],
                                                                                ...modalPatch,
                                                                                open: true,
                                                                            },
                                                                        }));
                                                                    }}
                                                                    className={`relative inline-flex items-center justify-center h-[44px] w-[44px] rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 transition
                                                                        ${isHostLocked ? "opacity-60 cursor-not-allowed" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
                                                                    aria-label={t("create.speakers.filters")}
                                                                    title={t("create.speakers.filters")}
                                                                    >
                                                                    <SlidersHorizontal className="w-5 h-5" />
                                                                    {hasActive ? (
                                                                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-purple-600 ring-2 ring-white dark:ring-neutral-900" />
                                                                    ) : null}
                                                                    </button>

                                                                        <VoiceFiltersModal
                                                                            open={!!f.open && !isHostLocked}
                                                                            onClose={() => setF({ open: false })}
                                                                            filters={f}
                                                                            onFiltersChange={(next) => setF(next)}
                                                                            accentOptions={accentOptions}
                                                                            ageOptions={ageOptions}
                                                                            categoryOptions={categoryOptions}
                                                                            isRTL={isRTL}
                                                                            normalizeCategoryLabelKey={normalizeCategoryLabelKey}
                                                                            formatVoiceCategoryLabel={formatVoiceCategoryLabel}
                                                                            onClear={() => {
                                                                                const speakerGenderTok = normalizeGenderToken(speakers?.[i]?.gender);
                                                                                const patch = {
                                                                                    ...DEFAULT_MODAL_VOICE_FILTERS,
                                                                                    gender: speakerGenderTok || "__all__",
                                                                                };
                                                                                setF(patch);
                                                                                applyVoiceLibraryForSpeaker(i, filtersModalToApplied(patch));
                                                                            }}
                                                                            onDone={(sanitized) => {
                                                                                const modalGenderTok = normalizeGenderToken(sanitized.gender);
                                                                                const modalGenderLabel =
                                                                                    modalGenderTok === "female"
                                                                                        ? "Female"
                                                                                        : modalGenderTok === "male"
                                                                                            ? "Male"
                                                                                            : "";
                                                                                if (modalGenderLabel) {
                                                                                    setSpeakers((arr) => {
                                                                                        const next = [...arr];
                                                                                        const prev = next[i] || {};
                                                                                        const prevTok = normalizeGenderToken(prev.gender);
                                                                                        const genderChanged = prevTok && modalGenderTok && prevTok !== modalGenderTok;
                                                                                        next[i] = {
                                                                                            ...prev,
                                                                                            gender: modalGenderLabel,
                                                                                            voiceId: genderChanged ? "" : (prev.voiceId || ""),
                                                                                        };
                                                                                        return next;
                                                                                    });
                                                                                }
                                                                                setF({ ...sanitized, open: false });
                                                                                applyVoiceLibraryForSpeaker(i, filtersModalToApplied(sanitized));
                                                                            }}
                                                                            preview={modalLibraryPreview[i]}
                                                                        />
                                                                        </>
                                                                    );
                                                                    })()}
                                                                    <select
                                                                        dir={isRTL ? "rtl" : "ltr"}
                                                                        disabled={isHostLocked}
                                                                        aria-invalid={Boolean(speakerVoiceErrors[i])}
                                                                        className={`form-input select-input flex-1 [color-scheme:light] dark:[color-scheme:dark] text-start ${
                                                                            speakerVoiceErrors[i]
                                                                                ? "border-rose-500 ring-1 ring-rose-500/40 dark:border-rose-400 dark:ring-rose-400/35"
                                                                                : ""
                                                                        } ${isHostLocked ? "opacity-70 cursor-not-allowed" : ""}`}
                                                                        style={{
                                                                            backgroundPosition: isRTL ? "left 0.75rem center" : "right 1rem center",
                                                                            paddingLeft: isRTL ? "2.25rem" : undefined,
                                                                            paddingRight: isRTL ? "1rem" : "2.5rem",
                                                                        }}
                                                                        value={safeValue}
                                                                        onChange={(e) => {
                                                                            const newVoice = e.target.value;

                                                                            // Prevent duplicate assignment
                                                                            const alreadyUsed = speakers.some(
                                                                                (s, idx) => s.voiceId === newVoice && idx !== i
                                                                            );

                                                                            if (alreadyUsed) {
                                                                                setToast({ type: "warning", message: t("create.speakers.voiceAlreadyUsed") });
                                                                                setTimeout(() => setToast(null), 2600);
                                                                                return;
                                                                            }

                                                                            setSpeakers((arr) => {
                                                                                const n = [...arr];
                                                                                n[i] = { ...n[i], voiceId: newVoice };
                                                                                return n;
                                                                            });
                                                                            if (newVoice) clearSpeakerVoiceError(i);

                                                                            if (newVoice && shouldAutoplayVoicePreview()) {
                                                                                const selected = pool.find(
                                                                                    (v) => (v.providerVoiceId || v.id || v.docId) === newVoice
                                                                                );
                                                                                previewVoice(newVoice, selected || null);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <option value="">{t("create.speakers.selectVoice")}</option>
                                                                        {pool.map((v) => {
                                                                        const vid = v.providerVoiceId || v.id || v.docId;
                                                                        const isTaken = speakers.some((s, idx) => s.voiceId === vid && idx !== i);

                                                                        return (
                                                                            <option key={vid} value={vid} disabled={isTaken}>
                                                                            {i18n.language === "ar"
                                                                                ? t(`create.voiceNames.${vid}`, { defaultValue: v.name })
                                                                                : v.name}{" "}
                                                                            {isTaken ? `(${t("create.speakers.alreadyUsed")})` : ""}
                                                                            </option>
                                                                        );
                                                                        })}
                                                                    </select>

                                                                    <button
                                                                    type="button"
                                                                    disabled={isHostLocked || !sp.voiceId || previewLoadingVoiceId === sp.voiceId || (elevenLabsAuthFailed && !String((pool.find((v) => (v.providerVoiceId || v.id || v.docId) === sp.voiceId)?.preview_url || "")).trim())}
                                                                    onClick={() => {
                                                                        const selected = pool.find((v) => (v.providerVoiceId || v.id || v.docId) === sp.voiceId);
                                                                        previewVoice(sp.voiceId, selected || null);
                                                                    }}
                                                                    className={`inline-flex items-center justify-center gap-2 px-5 h-[44px] rounded-xl border border-purple-500 text-purple-600 font-semibold transition ${
                                                                        (isHostLocked || !sp.voiceId || previewLoadingVoiceId === sp.voiceId) ? "opacity-60 cursor-not-allowed" : "hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                                                    } ${isRTL ? "flex-row-reverse" : ""}`}
                                                                    title={previewLoadingVoiceId === sp.voiceId ? "Generating preview..." : t("create.common.preview")}
                                                                    >
                                                                    {t("create.common.preview")} <Play className={`w-4 h-4 ${previewLoadingVoiceId === sp.voiceId ? "animate-pulse" : ""}`} />
                                                                    </button>
                                                                    </div>
                                                                    {hasMoreVoices ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => appendVoiceLibraryPageForSpeaker(i)}
                                                                            className="mt-2 text-xs font-semibold text-purple-600 dark:text-purple-300 hover:underline"
                                                                        >
{t("create.speakers.loadMoreVoices", {
  shown: pool.length,
  total: libr.totalCount || pool.length,
})}
                                                                        </button>
                                                                    ) : null}
                                                                </div>
                                                            );
                                                        })()}
                                                        {speakerVoiceErrors[i] ? (
                                                            <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                                                                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                                                {speakerVoiceErrors[i]}
                                                            </p>
                                                        ) : (
                                                            <p className="form-help text-xs mt-1">
                                                                {t("create.speakers.voiceHelp")}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {(errors.speaker_names || errors.speakers || errors.speaker_voices) && (
                                <p className="text-rose-500 mt-4 text-center flex items-center gap-2 justify-center">
                                    <AlertCircle className="w-4 h-4" />{" "}
                                    {errors.speaker_names || errors.speaker_voices || errors.speakers}
                                </p>
                            )}
                            <div className="mt-6 flex justify-between">
                                <button onClick={() => setStep(1)} className="px-4 py-2 border rounded-xl">{t("create.common.back")}</button>
                                <button onClick={onContinueFromSpeakers} className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold">
                                    {t("create.common.continue")} <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                                </button>
                            </div>
                        </section>
                    )}

                    {/* STEP 3: ENTER TEXT */}
                    {step === 3 && (
                        <section className={studioCardClass}>
                            <h2 className="ui-card-title flex items-center gap-2">
                                <NotebookPen className="w-4 h-4" />
                                {t("create.step3.enterTextTitle")}
                            </h2>
                            <div className={`mb-2 flex ${isRTL ? "justify-start" : "justify-end"}`}>
                                <button
                                    type="button"
                                    onClick={() => handleUseSampleText("en")}
                                    className="inline-flex items-center rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-black/80 dark:text-white/85 hover:bg-black/5 dark:hover:bg-white/10 transition"
                                >
                                    {t("create.step3.useEnglishSample")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleUseSampleText("ar")}
                                    className="ml-2 inline-flex items-center rounded-lg border border-black/10 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-black/80 dark:text-white/85 hover:bg-black/5 dark:hover:bg-white/10 transition"
                                >
                                    {t("create.step3.useArabicSample")}
                                </button>
                            </div>

                            <textarea
                                id="wecast_textarea"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t("create.step3.textPlaceholder", { min: MIN, max: MAX })}
                                dir="auto"
                                className={`form-textarea mt-3 text-start`}
                                rows={8}
                            />

                            {(() => {
                                const wordCount = countWords(description);

                                return (
                                    <div className={`mt-2 text-sm flex ${isRTL ? "flex-row-reverse" : ""} justify-between`}>
                                        <span
                                            className={
                                                wordCount < MIN || wordCount > MAX
                                                    ? "text-rose-500"      // red if too short OR too long
                                                    : "text-purple-500"    // normal color inside range
                                            }
                                        >
                                            {wordCount} / {MAX} {t("create.common.words")}
                                        </span>
                                        {errors.description && (
                                            <span className="text-rose-500">{errors.description}</span>
                                        )}
                                    </div>
                                );
                            })()}

                            {errors.server && (
                                <p className="text-rose-600 mt-3 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> {errors.server}
                                </p>
                            )}

                            <div className="mt-6 flex justify-between">
                                <button
                                    onClick={() => setStep(2)}
                                    className="px-4 py-2 border rounded-xl"
                                >
                                    {t("create.common.back")}
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={submitting}
                                    className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold disabled:opacity-50"
                                >
                                    {submitting ? (
                                            t("create.common.generatingScript")
                                    ) : (
                                        <>
                                            {t("create.common.generateScript")} <Wand2 className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </section>
                    )}


                    {/* STEP 4: REVIEW & EDIT */}
                    {step === 4 && generatedScript && (
                        <section className={studioCardClass}>
                            {/* Header with title and export button on opposite sides */}
        <div className="flex items-center justify-between mb-4">
            <h2 className="ui-card-title flex items-center gap-2">
                <Edit className="w-4 h-4" />
                {t("create.step4.reviewTitle")}
            </h2>
            
            <div className="relative">
                <button
                    onClick={() => setShowExportMenu((prev) => !prev)}
                    disabled={!generatedScript}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed bg-purple-600 hover:bg-purple-700 text-white"
                    title="Export script"
                >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t("editScript.export")}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showExportMenu ? "rotate-180" : ""}`} />
                </button>
                {showExportMenu && generatedScript && (
                    <div className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-2xl border border-black/10 bg-white/96 p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-white/10 dark:bg-neutral-900/96">
                        <button
                            onClick={() => {
                                setShowExportMenu(false);
                                exportScript("pdf");
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-black/80 transition hover:bg-purple-50 hover:text-purple-700 dark:text-white/80 dark:hover:bg-purple-900/20 dark:hover:text-purple-200"
                        >
                            <Download className="w-4 h-4" />
                                {t("editScript.exportPdf")}
                        </button>
                        <button
                            onClick={() => {
                                setShowExportMenu(false);
                                exportScript("txt");
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-black/80 transition hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/10"
                        >
                            <Download className="w-4 h-4" />
                            {t("editScript.exportTxt")}
                        </button>
                    </div>
                )}
            </div>
        </div>

                            <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 border border-green-200 dark:border-green-800 mb-6">
                                <h3 className="text-xl font-bold text-green-700 dark:text-green-300 mb-4 flex items-center gap-2">
                                    <Check className="w-5 h-5" /> {t("create.step4.scriptGeneratedTitle")}
                                </h3>

                                {/* Script Information ABOVE the script */}
                                <div className="bg-white dark:bg-neutral-800 rounded-xl p-4 mb-4">
                                    <h4 className="font-semibold mb-3 text-black dark:text-white">
                                        {t("create.step4.scriptInfoTitle")}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p>
                                                <strong>{t("create.step4.style")}:</strong> {styleLabelMap[scriptStyle] || scriptStyle}
                                            </p>
                                            <p>
                                                <strong>{t("create.step4.speakers")}:</strong> {speakersCount}
                                            </p>
                                            <p>
                                                <strong>{t("create.step4.totalWords")}:</strong>{" "}
                                                {generatedScript.split(/\s+/).filter(Boolean).length}
                                            </p>
                                        </div>
                                        <div>
                                            <p>
                                                <strong>{t("create.step4.speakerRoles")}:</strong>{" "}
                                                {speakers.map((s) => roleLabelFor(s.role)).join(", ")}
                                            </p>
                                            <p>
                                                <strong>{t("create.step4.status")}:</strong> {t("create.step4.readyForAudio")}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Script Preview */}
                                <div className="bg-white dark:bg-neutral-800 rounded-xl p-4">
                                    <h4 className="font-semibold mb-3 text-black dark:text-white">
                                        {t("create.step4.scriptPreview")}
                                    </h4>
                                    <div className="whitespace-pre-wrap text-sm text-black/80 dark:text-white/80 leading-relaxed max-h-96 overflow-y-auto">
                                        {displayedScript}
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-1 items-stretch gap-3 min-[430px]:grid-cols-3 md:flex md:items-center md:justify-between">
                                <button
                                    onClick={() => {
                                        // go back to text step and allow regeneration
                                        setStep(3);
                                    }}
                                    className="inline-flex h-11 w-full min-w-0 items-center justify-center rounded-xl border border-neutral-300 px-3 py-2 text-center text-sm font-semibold leading-tight transition hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5 md:h-auto md:w-auto md:px-4 md:text-base md:font-normal"
                                >
                                    <span className="min-w-0 truncate">{t("create.common.backToText")}</span>
                                </button>

                                <div className="contents md:flex md:gap-3">
                                    <button
                                        onClick={navigateToEdit}
                                        className="inline-flex h-11 w-full min-w-0 items-center justify-center rounded-xl border border-purple-500 px-3 py-2 text-center text-sm font-semibold leading-tight text-purple-600 transition hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 md:h-auto md:w-auto md:px-4 md:text-base md:font-normal"
                                    >
                                        <span className="min-w-0 truncate">{t("create.step4.editInEditor")}</span>
                                    </button>
                                    <button
                                        onClick={() => setStep(5)}
                                        className="btn-cta inline-flex h-11 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-center text-sm font-semibold leading-tight md:h-auto md:w-auto md:gap-2 md:px-7 md:py-3 md:text-base"
                                    >
                                        <span className="min-w-0 truncate">{t("create.common.continueToMusic")}</span>
                                        <ChevronRight className={`h-4 w-4 shrink-0 ${isRTL ? "rotate-180" : ""}`} />
                                    </button>
                                </div>
                            </div>
                        </section>
                    )}
                    {/* STEP 5: TRANSITION MUSIC */}
                    {step === 5 && (
                        <section className={studioCardClass}>
                            <h2 className="ui-card-title flex items-center gap-2 justify-center">
                                <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/40">
                                    <Headphones className="w-4 h-4" />
                                </span>
                                <span>{t("create.step5.title")}</span>
                            </h2>

                            <p className="text-center text-sm text-black/60 dark:text-white/60 mt-2">
                                {t("create.step5.subtitle")}
                            </p>

                            {/* CATEGORY SELECT */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                                {Object.keys(MUSIC_CATEGORIES).map((cat) => {
                                    const isActive = category === cat;

                                    const labelText =
                                        cat === "dramatic"
                                            ? t("create.music.categories.dramatic.title")
                                            : cat === "chill"
                                                ? t("create.music.categories.chill.title")
                                                : cat === "classics"
                                                    ? t("create.music.categories.classics.title")
                                                    : t("create.music.categories.arabic.title");

                                    const description =
                                        cat === "dramatic"
                                            ? t("create.music.categories.dramatic.desc")
                                            : cat === "arabic"
                                                ? t("create.music.categories.arabic.desc")
                                                : cat === "chill"
                                                    ? t("create.music.categories.chill.desc")
                                                    : t("create.music.categories.classics.desc");

                                    return (
                                        <label
                                            key={cat}
                                            onClick={() => {
                                                // Only reset if user actually switched to a different category
                                                if (category !== cat) {
                                                    setCategory(cat);
                                                    setAvailableTracks(MUSIC_CATEGORIES[cat]);

                                                    // reset selections when switching category
                                                    setIntroMusic("");
                                                    setBodyMusic("");
                                                    setOutroMusic("");

                                                    // stop any playing preview
                                                    setMusicPreview(null);
                                                }
                                            }}
                                            className={`cursor-pointer group relative w-full p-5 rounded-2xl border transition ${
                                                isFromStudioEntry
                                                    ? isActive
                                                        ? "border-purple-500/80 bg-white/95 text-black backdrop-blur-sm shadow-[0_16px_32px_rgba(124,58,237,0.12)] dark:bg-neutral-900 dark:text-white dark:border-purple-400/70"
                                                        : "border-purple-200/90 bg-white/82 text-black backdrop-blur-sm shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:border-purple-300/95 hover:bg-white/92 dark:bg-neutral-900 dark:text-white dark:border-white/15 dark:hover:border-purple-400/70 dark:hover:bg-neutral-900"
                                                    : isActive
                                                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-sm"
                                                        : "border-neutral-300 dark:border-neutral-800 hover:bg-black/5 dark:hover:bg-white/5"
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
                                                        {/* tiny music icon bubble */}
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
                                                    {t("create.common.selected")}
                                                </span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>

                            {/* TRACK LIST */}
                            {category && availableTracks.length > 0 && (
                                <div className="mt-8 space-y-4">
                                    {[t("create.music.intro"), t("create.music.body"), t("create.music.outro")].map((label, index) => (
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
                                                    <option value="">{t("create.common.select")}</option>
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
                                                            setMusicPreview(
                                                                `${API_BASE}/static/music/${selected}`
                                                            );

                                                        }
                                                    }}
                                                >
                                                    <Play className="w-4 h-4" />
                                                    <span>{t("create.common.preview")}</span>
                                                </button>

                                            </div>
                                        </div>
                                    ))}

                                    {musicPreview && (
                                        <audio autoPlay src={musicPreview} onEnded={() => setMusicPreview(null)} />
                                    )}
                                </div>
                            )}

                            <div className="mt-8 flex justify-between items-center">
                                <button
                                    onClick={() => setStep(4)}
                                    className="px-4 py-2 border rounded-xl"
                                >
                                    {t("create.common.back")}
                                </button>

                                <div className="flex items-center gap-3">
                                    {/* Skip Button */}
                                    <button
                                        onClick={async () => {
                                            try {

                                                await fetch(`${API_BASE}/api/save-music`, {
                                                    method: "POST",
                                                    credentials: "include",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({
                                                        introMusic: null,
                                                        bodyMusic: null,
                                                        outroMusic: null,
                                                    }),
                                                });
                                            } catch (e) {
                                                console.error("Failed to clear music selection", e);
                                            }

                                            // Clear on frontend too
                                            setIntroMusic("");
                                            setBodyMusic("");
                                            setOutroMusic("");

                                            // Go to audio step without music
                                            setStep(6);
                                        }}
                                        className="px-5 py-2 rounded-xl border border-neutral-400 text-neutral-700 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10 transition"
                                    >
                                    {t("create.common.skip")}
                                    </button>


                                    {/* Continue Button */}
                                    <button

                                        disabled={!introMusic || !bodyMusic || !outroMusic}
                                        onClick={async () => {
                                            await fetch(`${API_BASE}/api/save-music`, {
                                                method: "POST",
                                                credentials: "include",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ introMusic, bodyMusic, outroMusic }),
                                            });
                                            setStep(6);
                                        }}
                                        className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold disabled:opacity-50"
                                    >
                                        {t("create.common.continueToAudio")}
                                    </button>
                                </div>
                            </div>

                        </section>
                    )}


                    {/* STEP 6: AUDIO */}
                    {step === 6 && (
                        <section className={`${studioCardClass} w-full max-w-full overflow-hidden p-4 sm:p-6`}>
                            <h2 className="ui-card-title flex items-center gap-2 justify-center"><Mic2 className="w-4 h-4" /> {t("create.step6.generateAudioTitle")}</h2>

                            {!generatedAudio ? (
                                // Audio generation section
                                <div className="space-y-5 text-center sm:space-y-6">
                                    <div className="w-full max-w-full rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20 sm:rounded-2xl sm:p-6">
                                        <h3 className="mb-2 text-lg font-bold leading-tight text-purple-700 dark:text-purple-300 sm:mb-3 sm:text-xl">{t("create.step6.readyTitle")}</h3>
                                        <p className="mb-4 text-sm leading-6 text-black/70 dark:text-white/70 sm:text-base">
                                            {t("create.step6.readySubtitle")}
                                        </p>

                                        <div className="grid grid-cols-1 gap-3 text-start sm:gap-4 md:grid-cols-2">
                                            <div className="min-w-0 text-sm leading-6 [overflow-wrap:anywhere] sm:text-base">
                                                <h4 className="font-semibold mb-2">{t("create.step6.detailsTitle")}</h4>
                                                <p><strong>{t("create.step6.detailsStyle")}:</strong> {styleLabelMap[scriptStyle] || scriptStyle}</p>
                                                <p><strong>{t("create.step6.detailsSpeakers")}:</strong> {speakersCount}</p>
                                                <p><strong>{t("create.step6.detailsWords")}:</strong> {(generatedScript || "").split(/\s+/).filter(Boolean).length}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex w-full flex-wrap justify-center gap-2 sm:gap-4">
                                        <button
                                            onClick={() => setStep(5)}
                                            className="min-h-10 flex-1 basis-[6.5rem] rounded-xl border border-neutral-300 px-2.5 py-2 text-sm font-semibold transition hover:bg-black/5 dark:border-neutral-700 dark:hover:bg-white/5 sm:flex-none sm:basis-auto sm:px-6 sm:py-3 sm:text-base sm:font-normal"
                                        >
                                            {t("create.common.back")}
                                        </button>
                                        <button
                                            onClick={navigateToEdit}
                                            className="min-h-10 flex-1 basis-[6.5rem] rounded-xl border border-purple-500 px-2.5 py-2 text-sm font-semibold text-purple-600 transition hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 sm:flex-none sm:basis-auto sm:px-6 sm:py-3 sm:text-base sm:font-normal"
                                        >
                                            {t("create.step6.editScript")}
                                        </button>
                                        <button
                                            onClick={handleGenerateAudio}
                                            disabled={generatingAudio}
                                            className="btn-cta inline-flex min-h-10 flex-1 basis-[6.5rem] items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold disabled:opacity-50 sm:flex-none sm:basis-auto sm:gap-2 sm:px-7 sm:py-3 sm:text-base"
                                        >
                                            {generatingAudio ? t("create.common.generatingAudio") : <>{t("create.common.generateAudio")} <Play className="w-4 h-4" /></>}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Audio playback section
                                <div className="space-y-6">
                                    <div
                                        className="rounded-2xl border border-purple-200/90 bg-gradient-to-br from-white via-purple-50/50 to-white p-4 shadow-md shadow-purple-500/[0.08] ring-1 ring-purple-500/[0.06] sm:p-6
                                        dark:border-purple-400/25 dark:bg-gradient-to-br dark:from-[#211333] dark:via-[#15101f] dark:to-[#1b1228] dark:shadow-[0_18px_42px_rgba(88,28,135,0.24)] dark:ring-purple-400/15"
                                    >
                                        <h3 className="mb-1 flex items-center justify-center gap-2 text-center text-lg font-bold leading-snug text-neutral-900 sm:mb-2 sm:text-xl dark:text-purple-100">
                                            <Check className="h-5 w-5 shrink-0 text-purple-medium dark:text-purple-300" strokeWidth={2.5} aria-hidden />
                                            {t("create.step6.audioGeneratedTitle")}
                                        </h3>

                                        {/* Audio Player */}
                                        <div className="mt-4 sm:mt-5">
                                            <WeCastAudioPlayer
                                                variant="createSuccess"
                                                src={generatedAudio}
                                                title={audioTitle}
                                                downloadUrl={
                                                  currentPodcastId
                                                    ? `${API_BASE}/api/audio/${encodeURIComponent(currentPodcastId)}/download`
                                                    : ""
                                                }
                                            />
                                        </div>

                                        {/* Additional Actions */}
                                        <div className="mt-5 grid w-full grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-3 sm:gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setStep(4)}
                                                className="inline-flex h-11 min-h-[2.75rem] w-full items-center justify-center rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-800 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/30 dark:border-purple-300/30 dark:bg-white/5 dark:text-purple-100 dark:shadow-none dark:hover:bg-purple-500/12"
                                            >
                                                {t("create.common.back")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
        let editData = JSON.parse(sessionStorage.getItem("editData") || "{}");
        let podcastId = editData.podcastId || currentPodcastId;
                                                const isLoggedIn = Boolean(localStorage.getItem("token") || sessionStorage.getItem("token"));
                                                const previewSource = isFromStudioEntry ? "studio_create" : "create";
                                                sessionStorage.setItem("preview_from", previewSource);
                                                window.location.hash = isLoggedIn && podcastId ? `#/preview?id=${podcastId}&from=${previewSource}` : `#/preview?from=${previewSource}`;
                                                }}
                                                className="inline-flex h-11 min-h-[2.75rem] w-full items-center justify-center rounded-xl border border-purple-200 bg-purple-50/80 px-3 text-sm font-semibold text-purple-800 shadow-sm transition hover:border-purple-300 hover:bg-purple-100/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/35 dark:border-purple-300/35 dark:bg-purple-500/10 dark:text-purple-100 dark:shadow-none dark:hover:bg-purple-500/18"
                                            >
                                                {t("create.step6.previewEpisode")}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={navigateToFinalize}
                                                className="inline-flex h-11 min-h-[2.75rem] w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-purple-medium to-purple-700 px-3 text-sm font-semibold text-white shadow-md shadow-purple-500/25 transition hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/50 active:brightness-[0.98] dark:from-purple-500 dark:via-purple-600 dark:to-purple-700 dark:shadow-purple-900/40"
                                            >
                                                {t("create.step6.episodeCover")}{" "}
                                                <ChevronRight className={`h-4 w-4 shrink-0 ${isRTL ? "rotate-180" : ""}`} aria-hidden />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* overlays */}
                <LoadingOverlay
                    show={submitting}
                    title={t("create.loading.scriptTitle")}
                    subtitle={t("create.loading.scriptSubtitle")}
                    logoAlt={t("create.common.logoAlt")}
                />
                <LoadingOverlay
                    show={generatingAudio}
                    title={t("create.loading.audioTitle")}
                    subtitle={t("create.loading.audioSubtitle")}
                    logoAlt={t("create.common.logoAlt")}
                />
                {showSampleReplaceModal && (
                    <div className="wecast-overlay flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                        <div className="w-[min(92vw,460px)] rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6">
                            <h2 className="text-lg font-bold text-black dark:text-white mb-2">
                                Replace Existing Text?
                            </h2>
                            <p className="text-sm text-black/70 dark:text-white/70 mb-5">
                                This action will replace your current editor content with the selected sample text.
                            </p>
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowSampleReplaceModal(false)}
                                    className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        applySampleText(pendingSampleLang);
                                        setShowSampleReplaceModal(false);
                                    }}
                                    className="px-4 py-2 rounded-xl bg-black text-white dark:bg-white dark:text-black text-sm font-semibold hover:opacity-90 transition"
                                >
                                    Replace Text
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <Toast
                    toast={toast}
                    onClose={() => setToast(null)}
                    closeLabel={t("create.common.close")}
                />
                </div>
            </main >
        </div >
    );
}
