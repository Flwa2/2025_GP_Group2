import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Mic2,
  Users,
  NotebookPen,
  Check,
  Info,
  AlertCircle,
  Play,
  Edit,
  Pause,
  Download,
  Headphones,
  Music2,
  SlidersHorizontal,
  Save,
  X,
  Trash2,
  Pencil,
  Sparkles,
  Volume2,
  AlertTriangle,
  FileText,
  Volume,
  Disc,
  ChevronLeft,
  ChevronDown
} from "lucide-react";
import WeCastAudioPlayer from "./WeCastAudioPlayer";
import Modal from "../components/Modal";

const API_BASE = import.meta.env.PROD
  ? "https://wecast.onrender.com"
  : "http://localhost:5000";

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
  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 backdrop-blur-sm">
      <div className="w-[min(92vw,480px)] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl p-6">
        <div className="flex items-center gap-4">
          <img
            src={logoSrc}
            alt="WeCast logo"
            className="w-12 h-12 rounded-full animate-spin"
          />
          <div>
            <p className="font-extrabold text-black dark:text-white">{message}</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Please wait a moment</p>
          </div>
        </div>
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div className="h-full w-1/3 animate-pulse bg-gradient-to-r from-purple-400 to-pink-400" />
        </div>
      </div>
    </div>
  );
}

/* -------------------- toast notification -------------------- */
function Toast({ toast, onClose }) {
  if (!toast) return null;
  
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

  const languageOptions = [...new Set(
    voices
      .flatMap(v => [...toList(v.languages), ...toList(v.labels?.languages)])
      .map(normalize)
      .filter(Boolean)
  )].sort();

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
    filters.language ? { key: "language", label: `Language: ${filters.language}` } : null,
    filters.tone ? { key: "tone", label: `Tone: ${filters.tone}` } : null,
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
                <select
                  value={filters.language || ""}
                  onChange={(e) => setFilters({ ...filters, language: e.target.value })}
                  className="w-full appearance-none pr-10 px-3 py-2 border rounded-lg bg-white dark:bg-neutral-900 text-black dark:text-white border-neutral-300 dark:border-white/15 [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="">All Languages</option>
                  {languageOptions.map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/50 dark:text-white/60" />
              </div>
            </div>

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
          </div>

          {activeChips.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-black/60 dark:text-white/60">Active filters</p>
              <div className="flex flex-wrap gap-2">
                {activeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => setFilters({ ...filters, [chip.key]: chip.key === "gender" ? "__all__" : "" })}
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

          <button
            onClick={() => setFilters({ q: "", gender: "__all__", language: "", tone: "", pitch: "" })}
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            Clear Filters
          </button>
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
  const [scriptStyle, setScriptStyle] = useState("");
  const [speakers, setSpeakers] = useState([]);
  const [introMusic, setIntroMusic] = useState("");
  const [bodyMusic, setBodyMusic] = useState("");
  const [outroMusic, setOutroMusic] = useState("");
  const [category, setCategory] = useState("");
  const [generatedAudio, setGeneratedAudio] = useState(null);
  
  // Original values for tracking changes
  const [originalSpeakers, setOriginalSpeakers] = useState([]);
  const [originalIntroMusic, setOriginalIntroMusic] = useState("");
  const [originalBodyMusic, setOriginalBodyMusic] = useState("");
  const [originalOutroMusic, setOriginalOutroMusic] = useState("");

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
  const [showDoneConfirmation, setShowDoneConfirmation] = useState(false);
  const [showAudioGenerationOptions, setShowAudioGenerationOptions] = useState(false);
  const isAuthenticated = () => {
  return !!(localStorage.getItem("token") || sessionStorage.getItem("token"));
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

  // Load podcast data from API (NO MOCK DATA)
  useEffect(() => {
    const loadPodcastData = async () => {
      try {
        setLoading(true);
        
        const editData = JSON.parse(sessionStorage.getItem("editData") || "{}");
        const urlParams = new URLSearchParams(window.location.search);
        const idFromUrl = urlParams.get("id");
        const id = editData.podcastId || idFromUrl;
        
        if (!id) {
          setToast({ type: "error", message: "No podcast ID found" });
          setLoading(false);
          return;
        }
        
        setPodcastId(id);

        // REAL API CALL
        const res = await fetch(`${API_BASE}/api/podcast/${id}`, {
          credentials: "include",
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
          }
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to load podcast: ${res.status}`);
        }
        
        const data = await res.json();
        console.log("Loaded podcast data:", data);

        // Set all data from the API response
        setScript(data.script || "");
        setOriginalScript(data.script || "");
        setScriptTemplate(data.scriptTemplate || "");
        setShowTitle(data.showTitle || data.title || "Untitled Episode");
        setScriptStyle(data.scriptStyle || "");
        setSpeakers(data.speakers || []);
        setOriginalSpeakers(data.speakers || []);
        setIntroMusic(data.introMusic || "");
        setOriginalIntroMusic(data.introMusic || "");
        setBodyMusic(data.bodyMusic || "");
        setOriginalBodyMusic(data.bodyMusic || "");
        setOutroMusic(data.outroMusic || "");
        setOriginalOutroMusic(data.outroMusic || "");
        
        if (data.category) {
          setCategory(data.category);
          setAvailableTracks(MUSIC_CATEGORIES[data.category] || []);
        }

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
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
          }
        });

        const data = await res.json();

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
    const f = speakerVoiceFilters[speakerIndex] || { q: "", gender: "", language: "", tone: "", pitch: "" };
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

    return voices.filter((v) => {
      const name = String(v.name || "").toLowerCase();
      const desc = String(v.description || "").toLowerCase();
      const q = String(f.q || "").trim().toLowerCase();

      const vGender = String(v.gender || v.labels?.gender || "").toLowerCase();
      const vPitch = getVoicePitchTag(v);
      const vTones = getVoiceToneTags(v);
      const vLangs = [...toListLower(v.languages), ...toListLower(v.labels?.languages)];

      if (q && !(name.includes(q) || desc.includes(q))) return false;
      if (effectiveGender && vGender !== effectiveGender) return false;
      if (f.pitch && vPitch !== String(f.pitch).toLowerCase()) return false;
      if (!matchFacet(f.tone, vTones)) return false;
      if (!matchFacet(f.language, vLangs)) return false;

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
          'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
        },
        body: JSON.stringify({
          voiceId,
          voiceName,
          text: "This is a WeCast preview.",
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
  const hasChanges = 
    script !== originalScript ||
    JSON.stringify(speakers) !== JSON.stringify(originalSpeakers) ||
    introMusic !== originalIntroMusic ||
    bodyMusic !== originalBodyMusic ||
    outroMusic !== originalOutroMusic;
  
  setHasUnsavedChanges(hasChanges);
}, [script, speakers, introMusic, bodyMusic, outroMusic, originalScript, originalSpeakers, originalIntroMusic, originalBodyMusic, originalOutroMusic]);
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

  const confirmNavigation = () => {
    setShowExitWarning(false);
    if (pendingNavigation) {
      window.location.hash = pendingNavigation;
    }
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

const saveChanges = async () => {
  if (!podcastId) return;

  setSaving(true);
  try {
    const updatedScript = applySpeakerLabelRenames(script, originalSpeakers, speakers);

    // Save to API with the updated script
    console.log("Saving to API:", {
      podcastId,
      scriptLength: updatedScript.length,
      speakersCount: speakers.length
    });

    const res = await fetch(`${API_BASE}/api/podcast/${podcastId}/update`, {
      method: "POST",
      credentials: "include",
      headers: { 
        "Content-Type": "application/json",
        'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
      },
      body: JSON.stringify({
        script: updatedScript,  // Use the updated script with new speaker names
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

    const responseData = await res.json();
    console.log("Save response:", responseData);

    if (!res.ok) {
      throw new Error(responseData.error || "Failed to save changes");
    }

    // IMPORTANT: Update the original values to match what we just saved
    setOriginalScript(updatedScript);
    setScript(updatedScript);  // Update the displayed script with new speaker names
    setOriginalSpeakers(speakers);
    setOriginalIntroMusic(introMusic);
    setOriginalBodyMusic(bodyMusic);
    setOriginalOutroMusic(outroMusic);
    setHasUnsavedChanges(false);
    
    setToast({ type: "success", message: "Changes saved successfully!" });
    setTimeout(() => setToast(null), 3000);
  } catch (error) {
    console.error("Save error:", error);
    setToast({ type: "error", message: error.message || "Failed to save changes" });
  } finally {
    setSaving(false);
  }
};

  // Regenerate audio
  const regenerateAudio = async () => {
    if (!podcastId) return;

    setGeneratingAudio(true);
    try {
      const res = await fetch(`${API_BASE}/api/audio`, {
        method: "POST",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json",
          'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`
        },
        body: JSON.stringify({
          scriptText: script,
          podcastId,
          script_style: scriptStyle,
          speakers_info: speakers,
          language: i18n.language,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to generate audio");
      }

      const audioUrl = data.url.startsWith("http")
        ? data.url
        : `${API_BASE}${data.url}`;

      setGeneratedAudio(audioUrl);
      setToast({ type: "success", message: "Audio generated successfully!" });
    } catch (error) {
      console.error("Audio generation error:", error);
      setToast({ type: "error", message: error.message || "Failed to generate audio" });
    } finally {
      setGeneratingAudio(false);
    }
  };

      // Export script as PDF with Arabic support
// Export script as PDF with Arabic support
const exportScriptAsPDF = async () => {
  try {
    if (hasUnsavedChanges) {
      setToast({ type: "warning", message: "Please save your changes before exporting" });
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

    // Rest of your PDF export code...
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text(title, 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Exported on: ${new Date().toLocaleString()}`, 20, 30);
    doc.text(`WeCast Podcast Script - ${scriptStyle || "Standard"} Style`, 20, 35);
    
    // Split lines and create table data
    const lines = scriptContent.split(/\r?\n/).filter(line => line.trim());
    
    const tableData = [];
    lines.forEach(line => {
      const colonIndex = line.indexOf(":");
      if (colonIndex > 0) {
        const speaker = line.substring(0, colonIndex).trim();
        const text = line.substring(colonIndex + 1).trim();
        tableData.push([speaker, text]);
      } else {
        tableData.push(["", line]);
      }
    });
    
    // Create the table
    autoTable(doc, {
      head: [["Speaker", "Dialogue"]],
      body: tableData,
      startY: 45,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [147, 51, 234], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 40 },
        1: { cellWidth: 'auto' }
      }
    });
    
    // Save the PDF
    const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_script.pdf`;
    doc.save(fileName);
    
    setToast({ type: "success", message: "Script exported successfully!" });
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

  if (loading) {
    return (
      <div className="min-h-screen bg-cream dark:bg-[#0a0a1a] flex items-center justify-center">
        <LoadingOverlay show={true} message="Loading podcast..." />
      </div>
    );
  }

 return (
    <div className="min-h-screen bg-cream dark:bg-[#0a0a1a] text-black dark:text-white">
      {/* Header */}
      <LoadingOverlay 
  show={generatingAudio} 
  message="Generating your podcast audio..." 
/>
      <div className="bg-white/75 dark:bg-neutral-900/45 border-b border-black/10 dark:border-white/10 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
                  Unsaved changes
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Title Card */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-neutral-900/70 dark:to-neutral-800/60 rounded-xl p-6 border border-purple-100 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                <Mic2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-black/55 dark:text-white/55">Episode Title</p>
                {!isEditingTitle ? (
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-black dark:text-white">
                      {showTitle || "Untitled Episode"}
                    </h2>
                    <button
                      onClick={() => {
                        setDraftTitle(showTitle);
                        setIsEditingTitle(true);
                      }}
                      className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded"
                    >
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      className="px-3 py-1 border rounded-lg text-lg"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (draftTitle.trim()) {
                          setShowTitle(draftTitle.trim());
                          setIsEditingTitle(false);
                        }
                      }}
                      className="px-3 py-1 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingTitle(false)}
                      className="px-3 py-1 border border-black/10 dark:border-white/15 rounded-lg text-sm hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-black/60 dark:text-white/60">
              <span className="px-3 py-1 bg-black/5 dark:bg-white/10 rounded-full">
                {scriptStyle || "No style selected"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Save Button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10">
          <nav className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-1 py-4 text-sm font-medium border-b-2 transition ${
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
          
          {/* Save Changes Button */}
<button
  onClick={() => {
    if (isEditingTitle) {
      setToast({ type: "warning", message: "Please save your title edit before saving" });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    saveChanges();
  }}
  disabled={saving || !hasUnsavedChanges}
  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
    hasUnsavedChanges
      ? "bg-purple-600 text-white hover:bg-purple-700"
      : "bg-black/5 text-black/35 cursor-not-allowed dark:bg-white/10 dark:text-white/40"
  }`}
>
  <Save className="w-4 h-4" />
  {saving ? "Saving..." : "Save Changes"}
</button>
        </div>
      </div>

      {/* Rest of your component... */}

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
             {/* Script Tab */}
        {activeTab === "script" && (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-100 dark:border-blue-800">
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

           <div>
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
    className="w-full px-4 py-3 border rounded-lg font-mono text-sm leading-relaxed bg-white dark:bg-neutral-900/70 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-white/15 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
    style={{ minHeight: "400px" }}
    placeholder="Start typing your script..."
    dir={isRTL ? "rtl" : "ltr"}
  />
</div>

           <div className="flex justify-end gap-3">
{/* Export PDF Button */}
<button
  onClick={() => {
    if (isEditingTitle) {
      setToast({ type: "warning", message: "Please save your title edit before exporting" });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    exportScriptAsPDF();
  }}
  disabled={!script.trim()}
  className="flex items-center gap-2 px-4 py-2 border border-purple-500 text-purple-600 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50"
  title="Export script as PDF"
>
  <Download className="w-4 h-4" />
  Export PDF
</button>
  
  {/* Done Button */}
<button
  onClick={() => {
    if (isEditingTitle) {
      setToast({ type: "warning", message: "Please save your title edit before continuing" });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    if (hasUnsavedChanges) {
      setToast({ type: "warning", message: "Please save your changes before completing the edit" });
      setTimeout(() => setToast(null), 3000);
    } else {
      setShowDoneConfirmation(true);
    }
  }}
  disabled={generatingAudio}
  className="flex items-center gap-2 px-6 py-2 border border-purple-500 text-purple-600 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 font-semibold"
>
  <Check className="w-4 h-4" />
  Done
</button>
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
                <div key={index} className="bg-white dark:bg-neutral-900/70 rounded-lg border border-black/10 dark:border-white/10 p-6">
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
    // Script will be updated when Save Changes is clicked
  }}
  className="w-full px-3 py-2 border rounded-lg max-w-md bg-white dark:bg-neutral-900/70 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-white/15 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
  placeholder="Enter speaker name"
/>
</div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Voice Selection</label>
                      {loadingVoices ? (
                        <p className="text-sm text-black/55 dark:text-white/55">Loading voices...</p>
                      ) : voices.length === 0 ? (
                        <p className="text-sm text-red-500">No voices found. Check ElevenLabs config.</p>
                      ) : (
                        <div className="w-full">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setActiveFilterSpeaker(index)}
                              className="relative inline-flex items-center justify-center h-[44px] w-[44px] rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-white/10"
                            >
                              <SlidersHorizontal className="w-5 h-5" />
                              {Object.values(speakerVoiceFilters[index] || {}).some(Boolean) && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-purple-600 ring-2 ring-white" />
                              )}
                            </button>

                            <div className="relative flex-1">
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
                                }}
                                className="w-full appearance-none pr-10 px-3 py-2 border rounded-lg bg-white dark:bg-neutral-900/70 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-white/15 focus:ring-2 focus:ring-purple-500 focus:border-transparent [color-scheme:light] dark:[color-scheme:dark]"
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
                              className="px-4 py-2 border border-purple-500 text-purple-600 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50"
                              title={previewLoadingVoiceId === currentId ? "Generating preview..." : "Preview voice"}
                            >
                              <Play className={`w-5 h-5 ${previewLoadingVoiceId === currentId ? "animate-pulse" : ""}`} />
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
            
          </div>
        )}

        {/* Music Tab */}
{activeTab === "music" && (
  <div className="space-y-6">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Object.entries(MUSIC_CATEGORIES).map(([key, tracks]) => (
        <button
          key={key}
          onClick={() => {
            setCategory(key);
            setAvailableTracks(tracks);
          }}
          className={`p-4 rounded-lg border text-center transition ${
            category === key
              ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
              : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20"
          }`}
        >
          <Disc className="w-8 h-8 mx-auto mb-2 text-gray-600 dark:text-white/70" />
          <span className="font-medium capitalize">{key}</span>
        </button>
      ))}
    </div>

    {category && (
      <div className="space-y-4">
        {[
          { label: "Intro Music", value: introMusic, setter: setIntroMusic },
          { label: "Body Music", value: bodyMusic, setter: setBodyMusic },
          { label: "Outro Music", value: outroMusic, setter: setOutroMusic },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between p-4 border border-black/10 dark:border-white/10 rounded-lg">
            <span className="font-medium">{item.label}</span>
            <div className="flex gap-2">
              <select
                value={item.value}
                onChange={(e) => item.setter(e.target.value)}
                className="px-3 py-2 border rounded-lg min-w-[200px] bg-white dark:bg-neutral-900/70 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-white/15 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Select track</option>
                {availableTracks.map((track) => (
                  <option key={track.file} value={track.file}>
                    {track.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (item.value) {
                    // Stop current audio if playing
                    if (window.currentAudio) {
                      window.currentAudio.pause();
                      window.currentAudio.currentTime = 0;
                    }
                    
                    // Create and play new audio
                    const audio = new Audio(`${API_BASE}/static/music/${item.value}`);
                    window.currentAudio = audio;
                    audio.play().catch(e => console.error("Playback failed:", e));
                    
                    // Show toast
                    setToast({ type: "success", message: `Playing ${item.label}` });
                    setTimeout(() => setToast(null), 2000);
                  }
                }}
                disabled={!item.value}
                className="px-3 py-2 border border-purple-500 text-purple-600 dark:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50"
                title={`Preview ${item.label}`}
              >
                <Play className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}

        {/* Generated Audio */}
        {generatedAudio && (
          <div className="mt-8 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200">
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-300 mb-4 flex items-center gap-2">
              <Check className="w-5 h-5" />
              Generated Audio
            </h3>
            <WeCastAudioPlayer src={generatedAudio} title={showTitle} />
          </div>
        )}
        {/* Done! Confirmation Modal */}
{showDoneConfirmation && (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="w-[min(92vw,400px)] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
          <Check className="w-5 h-5 text-green-600" />
        </div>
        <h2 className="text-lg font-bold">Complete Edit</h2>
      </div>
      <p className="text-gray-600 dark:text-white/70 mb-6">
        Are you sure you're done with your podcast edit? (Script + Voices + Music)
      </p>
      <div className="flex justify-end gap-3">
        <button
          onClick={() => setShowDoneConfirmation(false)}
          className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium"
        >
          No
        </button>
        <button
          onClick={() => {
            setShowDoneConfirmation(false);
            setShowAudioGenerationOptions(true);
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
        >
          Yes
        </button>
      </div>
    </div>
  </div>
)}

{/* Audio Generation Options Modal */}
{showAudioGenerationOptions && (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="w-[min(92vw,400px)] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-purple-600" />
        </div>
        <h2 className="text-lg font-bold">Generate Audio</h2>
      </div>
      <p className="text-gray-600 dark:text-white/70 mb-6">
        Would you like to generate the audio for your podcast now?
      </p>
      <div className="flex justify-end gap-3">
        <button
          onClick={() => setShowAudioGenerationOptions(false)}
          className="px-4 py-2 border border-gray-300 dark:border-white/15 text-gray-600 dark:text-white/70 rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 font-medium"
        >
          Wait!
        </button>
        <button
          onClick={async () => {
            setShowAudioGenerationOptions(false);
            await regenerateAudio();
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
        >
          Generate Audio
        </button>
      </div>
    </div>
  </div>
)}
      </div>

      {/* Voice Filter Modal */}
      {activeFilterSpeaker !== null && (
        <VoiceFilterModal
          isOpen={true}
          onClose={() => setActiveFilterSpeaker(null)}
          filters={speakerVoiceFilters[activeFilterSpeaker] || {}}
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-[min(92vw,400px)] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <h2 className="text-lg font-bold">Unsaved Changes</h2>
            </div>
            <p className="text-gray-600 dark:text-white/70 mb-6">
              You have unsaved changes. What would you like to do?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowExitWarning(false)}
                className="px-4 py-2 border border-gray-300 dark:border-white/15 rounded-lg hover:bg-gray-50 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
  onClick={async () => {
    await saveChanges();
    setShowExitWarning(false);
    window.location.hash = pendingNavigation || "#/episodes";
  }}
  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
>
  Save & Exit
</button>
              <button
                onClick={confirmNavigation}
                className="px-4 py-2 border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50"
              >
                Discard Changes
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

