
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Mic2,
    Users,
    NotebookPen,
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
} from "lucide-react";
import WeCastAudioPlayer from "./WeCastAudioPlayer";

const API_BASE = import.meta.env.PROD
    ? "https://wecast.onrender.com"
    : "http://localhost:5000";


/* -------------------- overlay: rotating logo -------------------- */
function LoadingOverlay({ show, logoSrc = "/logo.png", title, subtitle, logoAlt = "WeCast logo" }) {
    if (!show) return null;
    return (
        <div
            className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 backdrop-blur-sm"
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
                            {title}
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
}

/* -------------------- tiny toast -------------------- */
function Toast({ toast, onClose, closeLabel = "Close" }) {
  if (!toast) return null;

  return (
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
          <div className="text-sm font-medium">{toast.message}</div>

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
}


export default function CreatePro() {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === "ar";
    const [step, setStep] = useState(0);
    const [podcastMode, setPodcastMode] = useState("");
    const [seriesList, setSeriesList] = useState([]);
    const [seriesLoading, setSeriesLoading] = useState(false);
    const [seriesId, setSeriesId] = useState("");
    const [seriesTitle, setSeriesTitle] = useState("");
    const [newSeriesTitle, setNewSeriesTitle] = useState("");
    const [seriesLockedHosts, setSeriesLockedHosts] = useState(false);
    const [seriesLockedStyle, setSeriesLockedStyle] = useState(false);

    useEffect(() => {
        sessionStorage.setItem("currentStep", step);
    }, [step]);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }, [step]);

    useEffect(() => {
        if (podcastMode !== "series") return;
        let isMounted = true;
        const loadSeries = async () => {
            try {
                setSeriesLoading(true);
                const res = await fetch(`${API_BASE}/api/series`, {
                    credentials: "include",
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Failed to load series");
                let items = Array.isArray(data?.items) ? data.items : [];

                if (!items.length) {
                    try {
                        const epRes = await fetch(`${API_BASE}/api/episodes`, {
                            credentials: "include",
                        });
                        const epData = await epRes.json();
                        if (epRes.ok) {
                            const grouped = {};
                            (epData?.items || []).forEach((ep) => {
                                const title = (ep.seriesTitle || "").trim();
                                if (!title) return;
                                if (!grouped[title]) grouped[title] = 0;
                                grouped[title] += 1;
                            });
                            items = Object.entries(grouped).map(([title, count]) => ({
                                id: "",
                                title,
                                episodeCount: count,
                            }));
                        }
                    } catch {}
                }

                if (isMounted) {
                    setSeriesList(items);
                }
            } catch (e) {
                if (isMounted) setSeriesList([]);
            } finally {
                if (isMounted) setSeriesLoading(false);
            }
        };
        loadSeries();
        return () => {
            isMounted = false;
        };
    }, [podcastMode]);

    useEffect(() => {
        if (podcastMode === "series") return;
        setSeriesId("");
        setSeriesTitle("");
        setNewSeriesTitle("");
        setSeriesLockedHosts(false);
        setSeriesLockedStyle(false);
    }, [podcastMode]);
    const [generatedAudio, setGeneratedAudio] = useState(null);
    const [generatingAudio, setGeneratingAudio] = useState(false);
    const [generatedScript, setGeneratedScript] = useState(null);
    const [showTitle, setShowTitle] = useState("");
    const [scriptTemplate, setScriptTemplate] = useState("");
    const [episodeTitle, setEpisodeTitle] = useState("");
    const [scriptStyle, setScriptStyle] = useState("");
    const [speakersCount, setSpeakersCount] = useState(0);
    const [speakers, setSpeakers] = useState([]);

// ElevenLabs voices (load once)
const [voices, setVoices] = useState([]);
const [loadingVoices, setLoadingVoices] = useState(true);

// filters per speaker
const [speakerVoiceFilters, setSpeakerVoiceFilters] = useState({});
// { [index]: { open:false, q:"", gender:"", language:"", tone:"", pitch:"" } }

const getVoiceId = (v) => v?.providerVoiceId || v?.id || v?.docId || "";

// Load ALL voices once
useEffect(() => {
  async function loadVoices() {
    try {
      setLoadingVoices(true);

      const params = new URLSearchParams();
      params.set("provider", "ElevenLabs");
      params.set("limit", "200");

      const url = `${API_BASE}/api/voices?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });

      console.log("GET /api/voices status:", res.status);

      const data = await res.json();
      console.log("GET /api/voices response:", data);

      if (!res.ok) {
        throw new Error(data?.error || `Failed to load voices (${res.status})`);
      }

      const raw =
        Array.isArray(data?.items) ? data.items :
        Array.isArray(data?.voices) ? data.voices :
        Array.isArray(data?.data?.items) ? data.data.items :
        Array.isArray(data?.data?.voices) ? data.data.voices :
        Array.isArray(data) ? data :
        [];

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

// Ensure each speaker has filters (NOW speakers is defined)
useEffect(() => {
  setSpeakerVoiceFilters((prev) => {
    const next = { ...prev };

    speakers.forEach((_, i) => {
      if (!next[i]) next[i] = { open: false, q: "", gender: "", language: "", tone: "", pitch: "" };
    });

    Object.keys(next).forEach((k) => {
      const idx = Number(k);
      if (idx >= speakers.length) delete next[k];
    });

    return next;
  });
}, [speakers.length]);

// Group voices by gender (supports backend labels too)
const voiceGroups = useMemo(() => {
  const groups = { male: [], female: [], other: [] };

  voices.forEach((v) => {
    const g = String(v.gender || v.labels?.gender || v.labels?.Gender || "").toLowerCase();
    if (g === "male") groups.male.push(v);
    else if (g === "female") groups.female.push(v);
    else groups.other.push(v);
  });

  return groups;
}, [voices]);

// default voice assignment (returns providerVoiceId)
const defaultVoiceForGender = (gender = "Male", usedIds = new Set()) => {
  const isFemale = String(gender || "").toLowerCase() === "female";
  const key = isFemale ? "female" : "male";

  const pool = voiceGroups[key].length ? voiceGroups[key] : voices;
  if (!pool.length) return "";

  const unusedInPool = pool.find((v) => {
    const id = getVoiceId(v);
    return id && !usedIds.has(id);
  });
  if (unusedInPool) return getVoiceId(unusedInPool);

  const unusedAny = voices.find((v) => {
    const id = getVoiceId(v);
    return id && !usedIds.has(id);
  });
  if (unusedAny) return getVoiceId(unusedAny);

  return getVoiceId(pool[0]) || getVoiceId(voices[0]) || "";
};

// Filter voices for a specific speaker (frontend)
const getFilteredVoicesForSpeaker = (speakerIndex) => {
  const f = speakerVoiceFilters[speakerIndex] || { q: "", gender: "", language: "", tone: "", pitch: "" };

  return voices.filter((v) => {
    const name = String(v.name || "").toLowerCase();
    const desc = String(v.description || "").toLowerCase();
    const q = String(f.q || "").trim().toLowerCase();

    const vGender = String(v.gender || v.labels?.gender || "").toLowerCase();
    const vPitch = String(v.pitch || v.labels?.pitch || "").toLowerCase();
    const vTones = Array.isArray(v.tone) ? v.tone.map((x) => String(x).toLowerCase())
      : Array.isArray(v.labels?.tone) ? v.labels.tone.map((x) => String(x).toLowerCase())
      : [];
    const vLangs = Array.isArray(v.languages) ? v.languages.map((x) => String(x).toLowerCase())
      : Array.isArray(v.labels?.languages) ? v.labels.languages.map((x) => String(x).toLowerCase())
      : [];

    if (q && !(name.includes(q) || desc.includes(q))) return false;
    if (f.gender && vGender !== String(f.gender).toLowerCase()) return false;
    if (f.pitch && vPitch !== String(f.pitch).toLowerCase()) return false;
    if (f.tone && !vTones.includes(String(f.tone).toLowerCase())) return false;
    if (f.language && !vLangs.includes(String(f.language).toLowerCase())) return false;

    return true;
  });
};

    const [description, setDescription] = useState("");
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);
    const [hoverKey, setHoverKey] = useState(null);
    const [musicPreview, setMusicPreview] = useState(null);
    const [category, setCategory] = useState("");
    const [introMusic, setIntroMusic] = useState("");
    const [bodyMusic, setBodyMusic] = useState("");
    const [outroMusic, setOutroMusic] = useState("");
    const [availableTracks, setAvailableTracks] = useState([]);

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
        let editData = JSON.parse(sessionStorage.getItem("editData") || "{}");

        if (editData.showTitle) {
            setShowTitle(editData.showTitle);
        }
        if (editData.scriptTemplate) {
            setScriptTemplate(editData.scriptTemplate);
        }
    }, []);


    //  ElevenLabs voices

    const MIN = 500;
    const MAX = 2500;

    useEffect(() => {
        const handleNavigation = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const stepParam = urlParams.get("step");
            const forceStep = sessionStorage.getItem("forceStep");
            const editData = JSON.parse(sessionStorage.getItem("editData") || "{}");
            const saved = sessionStorage.getItem("currentStep");

            if (editData.fromEdit && (editData.generatedScript || editData.scriptTemplate)) {
                const template =
                    editData.scriptTemplate || editData.generatedScript || "";

                const titleFromStorage =
                    (editData.showTitle || "").trim() ||
                    (editData.episodeTitle || "").trim() ||
                    t("create.defaults.podcastShow");


                const rendered = template.includes("{{SHOW_TITLE}}")
                    ? template.replaceAll("{{SHOW_TITLE}}", titleFromStorage)
                    : template;

                setGeneratedScript(rendered);
                setScriptTemplate(template);
                setShowTitle(titleFromStorage);
                setEpisodeTitle(titleFromStorage);

                setScriptStyle(editData.scriptStyle || "");
                setSpeakersCount(editData.speakersCount || 0);
                setSpeakers(editData.speakers || []);
                setDescription(editData.description || "");
                if (editData.seriesId) setSeriesId(editData.seriesId);
                if (editData.seriesTitle) setSeriesTitle(editData.seriesTitle);

                setStep(4);

                sessionStorage.removeItem("forceStep");
                const cleanEditData = { ...editData };
                delete cleanEditData.fromEdit;
                sessionStorage.setItem("editData", JSON.stringify(cleanEditData));
                return;
            }


            if (forceStep) {
                setStep(parseInt(forceStep));
                sessionStorage.removeItem("forceStep");
                return;
            }

            if (stepParam) {
                setStep(parseInt(stepParam));
                return;
            }

            if (saved) {
                setStep(parseInt(saved));
            }
        };

        handleNavigation();
    }, []);


    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            const editData = JSON.parse(sessionStorage.getItem('editData') || '{}');

            if (hash === '#/edit' && generatedScript) {
                setStep(4);
            } else if (hash === '#/create') {
                if (editData.fromEdit && editData.generatedScript) {
                    setGeneratedScript(editData.generatedScript);
                    setScriptStyle(editData.scriptStyle || "");
                    setSpeakersCount(editData.speakersCount || 0);
                    setSpeakers(editData.speakers || []);
                    setDescription(editData.description || "");
                    if (editData.seriesId) setSeriesId(editData.seriesId);
                    if (editData.seriesTitle) setSeriesTitle(editData.seriesTitle);

                    let titleFromStorage =
                        (editData.showTitle || "").trim() ||
                        (editData.episodeTitle || "").trim();

                    if (!titleFromStorage) {
                        titleFromStorage = t("create.defaults.podcastShow");
                    }


                    if (editData.scriptTemplate) {
                        setScriptTemplate(editData.scriptTemplate);
                    }
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
    }, [generatedScript]);



    /* ---------- rules ---------- */
    // limits the number of speakers per style
    const styleLimits = {
        Interview: [2, 3],
        Storytelling: [1, 2, 3],
        Educational: [1, 2, 3],
        Conversational: [2, 3],
    };

    const STYLE_GUIDELINES = {
        Interview: (
            <>
                <strong>{t("create.guidelines.tone")}:</strong> {t("create.guidelines.interview.tone")}
                <br />
                <strong>{t("create.guidelines.flow")}:</strong> {t("create.guidelines.interview.flow")}
                <br />
                <strong>{t("create.guidelines.goal")}:</strong> {t("create.guidelines.interview.goal")}
            </>
        ),
        Storytelling: (
            <>
                <strong>{t("create.guidelines.tone")}:</strong> {t("create.guidelines.storytelling.tone")}
                <br />
                <strong>{t("create.guidelines.flow")}:</strong> {t("create.guidelines.storytelling.flow")}
                <br />
                <strong>{t("create.guidelines.goal")}:</strong> {t("create.guidelines.storytelling.goal")}
            </>
        ),
        Educational: (
            <>
                <strong>{t("create.guidelines.tone")}:</strong> {t("create.guidelines.educational.tone")}
                <br />
                <strong>{t("create.guidelines.flow")}:</strong> {t("create.guidelines.educational.flow")}
                <br />
                <strong>{t("create.guidelines.goal")}:</strong> {t("create.guidelines.educational.goal")}
            </>
        ),
        Conversational: (
            <>
                <strong>{t("create.guidelines.tone")}:</strong> {t("create.guidelines.conversational.tone")}
                <br />
                <strong>{t("create.guidelines.flow")}:</strong> {t("create.guidelines.conversational.flow")}
                <br />
                <strong>{t("create.guidelines.goal")}:</strong> {t("create.guidelines.conversational.goal")}
            </>
        ),
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

    const styleLabelMap = {
        Interview: t("create.styles.interview.title"),
        Storytelling: t("create.styles.storytelling.title"),
        Educational: t("create.styles.educational.title"),
        Conversational: t("create.styles.conversational.title"),
    };

    const roleLabelFor = (role) => {
        if (role === "host") return t("create.roles.host");
        if (role === "guest") return t("create.roles.guest");
        if (role === "cohost") return t("create.roles.cohost");
        if (role === "narrator") return t("create.roles.narrator");
        return t("create.roles.speaker");
    };




    useEffect(() => {
        if (!scriptStyle || seriesLockedHosts) return;

        setSpeakers((prev) => {
            const limits = styleLimits[scriptStyle] || [];

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
    }, [scriptStyle, speakersCount, seriesLockedHosts]);



    useEffect(() => {
        if (loadingVoices || !voices.length || !speakers.length) return;

        setSpeakers((prev) => {
            const usedIds = new Set(
                prev.map((s) => s.voiceId).filter(Boolean)
            );

            const next = prev.map((s) => {
                if (s.voiceId) return s;

                const voiceId = defaultVoiceForGender(s.gender, usedIds);
                if (voiceId) usedIds.add(voiceId);

                return { ...s, voiceId };
            });

            return next;
        });
    }, [loadingVoices, voices.length, speakers.length]);


    useEffect(() => {
        if (!scriptStyle || !speakersCount || seriesLockedHosts) return;
        const count = Number(speakersCount);
        const limits = styleLimits[scriptStyle] || [];
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
    }, [speakersCount, scriptStyle, voices.length, seriesLockedHosts]);

    /* ---------- helpers ---------- */
    const allowedCounts = useMemo(() => styleLimits[scriptStyle] || [], [scriptStyle]);
    const showRoleSelect = scriptStyle !== "Conversational" && scriptStyle !== "Educational" && scriptStyle !== "Storytelling" && scriptStyle !== "Interview";
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

        setErrors(errs);
        if (Object.keys(errs).length === 0) {
            setStep(3);
            setToast({ type: "success", message: t("create.toasts.speakersSet") });
            setTimeout(() => setToast(null), 2400);
        } else {
            setToast({ type: "error", message: Object.values(errs)[0] });
            setTimeout(() => setToast(null), 2800);
        }
    };

    const handleGenerate = async () => {
        const words = description.trim().split(/\s+/).filter(Boolean).length;
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
                    seriesId: seriesId || undefined,
                    seriesTitle: seriesTitle || newSeriesTitle || undefined,
                    language: i18n.language,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.script) {
        setErrors({ server: data.error || t("create.errors.generationFailed") });
                setSubmitting(false);
                return;
            }
            const podcastId = data.podcastId;
            if (data.seriesId) setSeriesId(data.seriesId);
            if (data.seriesTitle) setSeriesTitle(data.seriesTitle);
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
                seriesId: data.seriesId || seriesId || "",
                seriesTitle: data.seriesTitle || seriesTitle || "",
                episodeNumber: data.episodeNumber || null,
            };
            sessionStorage.setItem("editData", JSON.stringify(editData));
            sessionStorage.removeItem("guestEditDraft");


            setToast({
                type: "success",
                message: t("create.toasts.scriptGenerated"),
            });
            setTimeout(() => setToast(null), 2400);
            setStep(4);
        } catch (e) {
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
        let podcastId = editData.podcastId;

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
                        sessionStorage.setItem("editData", JSON.stringify(editData));
                    }
                }
            } catch (error) {
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
                language: i18n.language,
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
            words: data.words || [],
            title: audioTitle,
            };
            sessionStorage.setItem("wecast_preview", JSON.stringify(previewPayload));

            setGeneratedAudio(baseAudioUrl + "?t=" + Date.now());

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
            scriptStyle,
            speakersCount,
            speakers,
            generatedScript,
            description,
            scriptTemplate,
            showTitle,
            episodeTitle: showTitle,
            seriesId,
            seriesTitle,
        };

        sessionStorage.setItem("editData", JSON.stringify(editData));
        window.location.hash = "#/edit";
    };


    /* ---------- stepper ---------- */
    const stepTitles = {
        0: t("create.preStep.title"),
        1: t("create.step1.title"),
        2: t("create.step2.title"),
        3: t("create.step3.title"),
        4: t("create.step4.title"),
        5: t("create.step5.title"),
        6: t("create.step6.title"),
    };

    const stepDescriptions = {
        0: t("create.preStep.desc"),
        1: t("create.step1.desc"),
        2: t("create.step2.desc"),
        3: t("create.step3.desc"),
        4: t("create.step4.desc"),
        5: t("create.step5.desc"),
        6: t("create.step6.desc"),
    };

    const preStepOptions = [
        {
            key: "episode",
            title: t("create.preStep.episodeTitle"),
            desc: t("create.preStep.episodeDesc"),
            icon: Play,
        },
        {
            key: "series",
            title: t("create.preStep.seriesTitle"),
            desc: t("create.preStep.seriesDesc"),
            icon: Layers,
        },
    ];

    const normalizeSeriesSpeaker = (s = {}) => ({
        name: (s.name || "").trim(),
        gender: (s.gender || "Male").trim(),
        role: (s.role || "host").trim(),
        voiceId: (s.voiceId || s.providerVoiceId || "").trim(),
        filterPreset: s.filterPreset || "all",
    });

    const applySeriesSettings = (seriesData = {}) => {
        const style = (seriesData.style || "").trim();
        const hostSpeakers = Array.isArray(seriesData.hostSpeakers)
            ? seriesData.hostSpeakers.map(normalizeSeriesSpeaker)
            : [];

        if (style) {
            setScriptStyle(style);
            setSeriesLockedStyle(true);
        } else {
            setSeriesLockedStyle(false);
        }

        if (hostSpeakers.length) {
            setSeriesLockedHosts(true);

            const limits = styleLimits[style] || [];
            const minAllowed = limits[0] || hostSpeakers.length;
            const maxAllowed = limits[limits.length - 1] || hostSpeakers.length;

            let targetCount = hostSpeakers.length;
            if (style !== "Conversational") {
                targetCount = hostSpeakers.length + 1;
            }
            targetCount = Math.min(Math.max(targetCount, minAllowed), maxAllowed);

            const next = [...hostSpeakers];
            while (next.length < targetCount) {
                next.push({
                    name: "",
                    gender: "Female",
                    role: "guest",
                    voiceId: "",
                    filterPreset: "all",
                });
            }

            setSpeakersCount(targetCount);
            setSpeakers(next);
        } else {
            setSeriesLockedHosts(false);
        }
    };

    const handlePreStepContinue = async () => {
        if (!podcastMode) {
            setToast({
                type: "error",
                message: t("create.preStep.error"),
            });
            setTimeout(() => setToast(null), 2400);
            return;
        }

        if (podcastMode === "episode") {
            setSeriesId("");
            setSeriesTitle("");
            setSeriesLockedHosts(false);
            setSeriesLockedStyle(false);
            setStep(1);
            return;
        }

        const trimmedTitle = newSeriesTitle.trim();

        try {
            if (trimmedTitle) {
                const res = await fetch(`${API_BASE}/api/series`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: trimmedTitle }),
                });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data?.error || "Failed to create series");
                }
                setSeriesId(data.id);
                setSeriesTitle(data.title || trimmedTitle);
                setNewSeriesTitle("");
                setSeriesLockedHosts(false);
                setSeriesLockedStyle(false);
                setStep(1);
                return;
            }

            if (!seriesId) {
                setToast({
                    type: "error",
                    message: t("create.preStep.seriesPickError"),
                });
                setTimeout(() => setToast(null), 2400);
                return;
            }

            const res = await fetch(`${API_BASE}/api/series/${seriesId}`, {
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data?.error || "Failed to load series");
            }

            setSeriesTitle(data.title || "");
            applySeriesSettings(data);

            if (data.style) {
                setStep(2);
            } else {
                setStep(1);
            }
        } catch (e) {
            setToast({
                type: "error",
                message: t("create.preStep.seriesLoadError"),
            });
            setTimeout(() => setToast(null), 2400);
        }
    };

    const stepperLabels = [
        t("create.stepper.chooseStyle"),
        t("create.stepper.addSpeakers"),
        t("create.stepper.writeContent"),
        t("create.stepper.reviewEdit"),
        t("create.stepper.selectMusic"),
        t("create.stepper.generateAudio"),
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
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full grid place-items-center text-sm font-bold ${dot}`}>
                    {n}
                </div>
                <div className={`text-sm font-semibold ${labelCls}`}>{label}</div>
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



    return (
        <div className="min-h-screen bg-cream dark:bg-[#0a0a0a]">
            <div className="h-2 bg-purple-gradient" />
            <main className="w-full max-w-[1400px] mx-auto px-6 py-10">
                {/* Title */}
                <header className="mb-6 text-center">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-black dark:text-white">
                        {stepTitles[step]}
                    </h1>

                    <p className="mt-2 text-black/70 dark:text-white/70">
                        {stepDescriptions[step]}
                    </p>
                </header>



                {/* Stepper */}
                {step > 0 && (
                    <div className="w-full max-w-[1400px] mx-auto rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 p-4 mb-8">
                        <div className="flex items-center gap-2">
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
                        </div>
                    </div>
                )}




                <div className="max-w-5xl mx-auto">
                    {/* STEP 0: PODCAST MODE */}
                    {step === 0 && (
                        <section className="ui-card">
                            <h2 className="ui-card-title flex items-center gap-2 justify-center">
                                <Mic2 className="w-4 h-4" /> {t("create.preStep.questionTitle")}
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                {preStepOptions.map((opt) => {
                                    const Icon = opt.icon;
                                    const selected = podcastMode === opt.key;
                                    return (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => setPodcastMode(opt.key)}
                                            className={`group w-full rounded-2xl border p-5 transition ${isRTL ? "text-right" : "text-left"} ${
                                                selected
                                                    ? "border-purple-400/70 bg-purple-500/10"
                                                    : "border-neutral-300 dark:border-neutral-800 hover:bg-black/5 dark:hover:bg-white/5"
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className={`grid h-9 w-9 place-items-center rounded-xl ${selected ? "bg-purple-600 text-white" : "bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/70"}`}>
                                                    <Icon className="h-4 w-4" />
                                                </span>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 font-semibold text-black dark:text-white">
                                                        <span>{opt.title}</span>
                                                        {selected && (
                                                            <span className="text-xs text-purple-500 flex items-center gap-1">
                                                                <Check className="w-3 h-3" /> {t("create.common.selected")}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 text-sm text-black/70 dark:text-white/70">
                                                        {opt.desc}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            {podcastMode === "series" && (
                                <div className="mt-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-semibold text-black/80 dark:text-white/80">
                                            {t("create.series.chooseTitle")}
                                        </h3>
                                        {seriesLoading && (
                                            <span className="text-xs text-black/50 dark:text-white/50">
                                                {t("create.series.loading")}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {seriesList.map((s) => {
                                        const selected = seriesId
                                            ? seriesId === s.id
                                            : !!seriesTitle && seriesTitle === s.title;
                                        return (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => {
                                                    setSeriesId(s.id || "");
                                                    setSeriesTitle(s.title || "");
                                                    setNewSeriesTitle("");
                                                }}
                                            className={`w-full rounded-xl border p-4 text-left transition ${
                                                selected
                                                    ? "border-purple-400/70 bg-purple-500/10"
                                                    : "border-neutral-300 dark:border-neutral-800 hover:bg-black/5 dark:hover:bg-white/5"
                                            } ${isRTL ? "text-right" : "text-left"}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-semibold text-black dark:text-white">
                                                    {s.title || t("create.series.untitled")}
                                                </span>
                                                {selected && (
                                                    <span className="text-xs text-purple-500 flex items-center gap-1">
                                                        <Check className="w-3 h-3" /> {t("create.common.selected")}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-black/60 dark:text-white/60">
                                                {t("create.series.episodes", { count: s.episodeCount || 0 })}
                                            </p>
                                        </button>
                                    );
                                    })}
                                        {!seriesList.length && !seriesLoading && (
                                            <div className="text-sm text-black/60 dark:text-white/60">
                                                {t("create.series.empty")}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4">
                                        <label className="form-label">{t("create.series.newLabel")}</label>
                                        <input
                                            value={newSeriesTitle}
                                            onChange={(e) => {
                                                setNewSeriesTitle(e.target.value);
                                                if (e.target.value) {
                                                    setSeriesId("");
                                                    setSeriesTitle("");
                                                }
                                            }}
                                            placeholder={t("create.series.newPlaceholder")}
                                            className="form-input"
                                        />
                                    </div>

                                    {seriesTitle && (
                                        <div className="mt-3 text-xs text-purple-600">
                                            {t("create.series.selected", { title: seriesTitle })}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="mt-6 flex justify-end">
                                <button
                                    type="button"
                                    onClick={handlePreStepContinue}
                                    className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold"
                                >
                                    {t("create.common.continue")} <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                                </button>
                            </div>
                        </section>
                    )}
                    {/* STEP 1: STYLE */}
                    {step === 1 && (
                        <section className="ui-card">
                            <h2 className="ui-card-title flex items-center gap-2 justify-center">
                                <Mic2 className="w-4 h-4" /> {t("create.sections.podcastStyle")}
                            </h2>
                            {seriesLockedStyle && (
                                <p className="mt-2 text-sm text-purple-600 text-center">
                                    {t("create.series.styleLocked")}
                                </p>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 justify-items-center">
                                {styleCards.map((s) => (
                                    <label
                                        key={s.key}
                                        onClick={() => {
                                            if (seriesLockedStyle) return;
                                            setScriptStyle(s.key);
                                        }}
                                        onMouseEnter={() => setHoverKey(s.key)}
                                        onMouseLeave={() => setHoverKey((k) => (k === s.key ? null : k))}
                                        className={`group relative w-full max-w-xl p-4 rounded-xl border transition ${seriesLockedStyle ? "cursor-not-allowed opacity-70" : "cursor-pointer"} ${scriptStyle === s.key ? "border-purple-400/60 bg-purple-500/10" : "border-neutral-300 dark:border-neutral-800 hover:bg-black/5 dark:hover:bg-white/5"}`}
                                    >
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
                                                <p className="text-sm mt-1">{s.caption}</p>
                                                <ul className="flex flex-wrap gap-2 mt-2 text-xs text-black/70 dark:text-white/70">
                                                    {s.bullets.map((b, i) => <li key={i} className="px-2 py-1 rounded bg-black/5 dark:bg-white/5">{b}</li>)}
                                                </ul>
                                                <p className="text-xs text-purple-500 mt-2">
                                                    {t("create.common.valid")}: {s.valid}
                                                </p>
                                            </div>
                                        </div>
                                        {hoverKey === s.key && (
                                            <div className="absolute left-5 right-5 top-[calc(100%+30px)] z-40">
                                                <div className="relative rounded-2xl bg-gradient-to-br from-purple-400 to-violet-700 text-white shadow-2xl border border-white/10 p-4 animate-[popoverIn_120ms_ease-out]">
                                                    <div className="flex items-center gap-2 font-semibold tracking-wide">
                                                        <Info className="w-4 h-4 opacity-90" />
                                                        <span>{t("create.guidelines.title")}</span>
                                                    </div>
                                                    <div className="mt-2 leading-relaxed text-[0.95rem]">{STYLE_GUIDELINES[s.key]}</div>
                                                    <span className="absolute -top-2 left-8 w-3 h-3 rotate-45 bg-purple-600 shadow-[0_6px_16px_rgba(0,0,0,0.25)] border-l border-t border-white/10" />
                                                </div>
                                            </div>
                                        )}
                                    </label>
                                ))}
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
                        <section className="ui-card">
                            <h2 className="ui-card-title flex items-center gap-2 justify-center"><Users className="w-4 h-4" /> {t("create.sections.speakers")}</h2>
                            {seriesLockedHosts && (
                                <p className="mt-2 text-sm text-purple-600 text-center">
                                    {t("create.series.hostLocked")}
                                </p>
                            )}
                            {scriptStyle && (
                                <div className="flex items-center gap-2 flex-wrap mt-3 justify-center">
                                    {allowedCounts.map((n) => (
                                        <button
                                            key={n}
                                            onClick={() => setSpeakersCount(n)}
                                            disabled={seriesLockedHosts}
                                            className={`px-4 py-2 text-sm font-semibold rounded-xl transition border ${
                                                speakersCount === n
                                                    ? "bg-purple-600 text-white border-purple-600"
                                                    : "bg-black/5 dark:bg-white/5 border-neutral-300 dark:border-neutral-800 text-black/70 dark:text-white/70 hover:bg-black/10"
                                            } ${seriesLockedHosts ? "opacity-60 cursor-not-allowed" : ""}`}
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
                                        const isHostLocked = seriesLockedHosts && ["host", "cohost", "narrator"].includes(roleKey);

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
                                                                onChange={(e) =>
                                                                    setSpeakers((arr) => {
                                                                        const gender = e.target.value;
                                                                        const next = [...arr];

                                                                        // Voices used by OTHER speakers
                                                                        const usedIds = new Set(
                                                                            next
                                                                                .filter((_, idx) => idx !== i)
                                                                                .map((s) => s.voiceId)
                                                                                .filter(Boolean)
                                                                        );

                                                                        const voiceId = defaultVoiceForGender(gender, usedIds);

                                                                        next[i] = {
                                                                            ...next[i],
                                                                            gender,
                                                                            voiceId, // assign a fresh unique voice for this gender
                                                                        };

                                                                        return next;
                                                                    })
                                                                }
                                                                dir={isRTL ? "rtl" : "ltr"}
                                                                className={`form-input select-input ${isRTL ? "text-right" : "text-left"} ${isHostLocked ? "opacity-70 cursor-not-allowed" : ""}`}
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
                                                        {loadingVoices ? (
                                                            <p className="text-sm text-black/60 dark:text-white/60">
                                                                {t("create.speakers.loadingVoices")}
                                                            </p>
                                                        ) : voices.length === 0 ? (
                                                            <p className="text-sm text-rose-500">
                                                                {t("create.speakers.noVoices")}
                                                            </p>
                                                        ) : (() => {
                                                            const genderKey =
                                                                (sp.gender || "").toLowerCase() === "female"
                                                                    ? "female"
                                                                    : "male";
                                                            const pool = getFilteredVoicesForSpeaker(i);
                                                            const poolIds = new Set(pool.map(getVoiceId));
                                                            const currentId = sp.voiceId || "";
                                                            const safeValue = poolIds.has(currentId) ? currentId : "";
                                                            return (
                                                                <div className="flex items-center gap-3">
                                                                    {/* Filters dropdown (per speaker) */}
                                                                        {(() => {
                                                                        const f = speakerVoiceFilters[i] || {
                                                                            open: false,
                                                                            q: "",
                                                                            language: "",
                                                                            tone: "",
                                                                            pitch: "",
                                                                        };

                                                                        // Collect options dynamically from voices list
                                                                        const languageOptions = Array.from(
                                                                            new Set(
                                                                            voices
                                                                                .flatMap((v) => (Array.isArray(v.languages) ? v.languages : []))
                                                                                .map((x) => String(x).trim())
                                                                                .filter(Boolean)
                                                                            )
                                                                        ).sort();

                                                                        const toneOptions = Array.from(
                                                                            new Set(
                                                                            voices
                                                                                .flatMap((v) => (Array.isArray(v.tone) ? v.tone : []))
                                                                                .map((x) => String(x).trim())
                                                                                .filter(Boolean)
                                                                            )
                                                                        ).sort();

                                                                        const pitchOptions = Array.from(
                                                                            new Set(
                                                                            voices
                                                                                .map((v) => String(v.pitch || "").trim())
                                                                                .filter(Boolean)
                                                                            )
                                                                        ).sort();

                                                                        const setF = (patch) =>
                                                                            setSpeakerVoiceFilters((prev) => ({
                                                                            ...prev,
                                                                            [i]: { ...prev[i], ...patch },
                                                                            }));

                                                                        return (
                                                                            <div className="mb-3">
                                                                            <button
                                                                                type="button"
                                                                                disabled={isHostLocked}
                                                                                onClick={() => setF({ open: !f.open })}
                                                                                className={`inline-flex items-center gap-2 px-4 h-[40px] rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-semibold transition ${isHostLocked ? "opacity-60 cursor-not-allowed" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
                                                                            >
                                                                                {t("create.speakers.filters")}
                                                                                <span className="text-xs opacity-70">
                                                                                {f.q || f.language || f.tone || f.pitch ? t("create.common.active") : ""}
                                                                                </span>
                                                                            </button>

                                                                            {f.open && !isHostLocked && (
                                                                                <div className="mt-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 shadow-sm">
                                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                                    {/* Search */}
                                                                                    <div>
                                                                                    <label className="form-label">{t("create.speakers.search")}</label>
                                                                                    <input
                                                                                        value={f.q}
                                                                                        onChange={(e) => setF({ q: e.target.value })}
                                                                                        placeholder={t("create.speakers.searchPlaceholder")}
                                                                                        className="form-input"
                                                                                    />
                                                                                    </div>

                                                                                    {/* Language */}
                                                                                    <div>
                                                                                    <label className="form-label">{t("create.speakers.language")}</label>
                                                                                    <select
                                                                                        value={f.language}
                                                                                        onChange={(e) => setF({ language: e.target.value })}
                                                                                        className="form-input"
                                                                                    >
                                                                                        <option value="">{t("create.speakers.allLanguages")}</option>
                                                                                        {languageOptions.map((lang) => (
                                                                                        <option key={lang} value={lang}>
                                                                                            {lang}
                                                                                        </option>
                                                                                        ))}
                                                                                    </select>
                                                                                    </div>

                                                                                    {/* Tone */}
                                                                                    <div>
                                                                                    <label className="form-label">{t("create.speakers.tone")}</label>
                                                                                    <select
                                                                                        value={f.tone}
                                                                                        onChange={(e) => setF({ tone: e.target.value })}
                                                                                        className="form-input"
                                                                                    >
                                                                                        <option value="">{t("create.speakers.allTones")}</option>
                                                                                        {toneOptions.map((t) => (
                                                                                        <option key={t} value={t}>
                                                                                            {t}
                                                                                        </option>
                                                                                        ))}
                                                                                    </select>
                                                                                    </div>

                                                                                    {/* Pitch */}
                                                                                    <div>
                                                                                    <label className="form-label">{t("create.speakers.pitch")}</label>
                                                                                    <select
                                                                                        value={f.pitch}
                                                                                        onChange={(e) => setF({ pitch: e.target.value })}
                                                                                        className="form-input"
                                                                                    >
                                                                                        <option value="">{t("create.speakers.allPitches")}</option>
                                                                                        {pitchOptions.map((p) => (
                                                                                        <option key={p} value={p}>
                                                                                            {p}
                                                                                        </option>
                                                                                        ))}
                                                                                    </select>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="mt-3 flex items-center justify-between">
                                                                                    <button
                                                                                    type="button"
                                                                                    onClick={() => setF({ q: "", language: "", tone: "", pitch: "" })}
                                                                                    className="px-4 h-[38px] rounded-xl border border-neutral-300 dark:border-neutral-700 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition"
                                                                                    >
                                                                                    {t("create.speakers.clearFilters")}
                                                                                    </button>

                                                                                    <button
                                                                                    type="button"
                                                                                    onClick={() => setF({ open: false })}
                                                                                    className="px-4 h-[38px] rounded-xl border border-purple-500 text-purple-600 text-sm font-semibold hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                                                                                    >
                                                                                    {t("create.common.done")}
                                                                                    </button>
                                                                                </div>
                                                                                </div>
                                                                            )}
                                                                            </div>
                                                                        );
                                                                        })()}
                                                                    <select
                                                                        dir={isRTL ? "rtl" : "ltr"}
                                                                        disabled={isHostLocked}
                                                                        className={`form-input select-input flex-1 ${isRTL ? "text-right" : "text-left"} ${isHostLocked ? "opacity-70 cursor-not-allowed" : ""}`}
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
                                                                                alert(t("create.speakers.voiceAlreadyUsed"));
                                                                                return;
                                                                            }

                                                                            setSpeakers((arr) => {
                                                                                const n = [...arr];
                                                                                n[i] = { ...n[i], voiceId: newVoice };
                                                                                return n;
                                                                            });
                                                                        }}
                                                                    >
                                                                        <option value="">{t("create.speakers.selectVoice")}</option>
                                                                        {pool.map((v) => {
                                                                        const vid = v.providerVoiceId || v.id || v.docId;
                                                                        const isTaken = speakers.some((s, idx) => s.voiceId === vid && idx !== i);

                                                                        return (
                                                                            <option key={vid} value={vid} disabled={isTaken}>
                                                                            {v.name} {isTaken ? `(${t("create.speakers.alreadyUsed")})` : ""}
                                                                            </option>
                                                                        );
                                                                        })}
                                                                    </select>

                                                                    <button
                                                                        type="button"
                                                                        disabled={isHostLocked}
                                                                        onClick={() => {
                                                                            const selected =
                                                                                pool.find(
                                                                                    (v) => v.id === currentId
                                                                                ) || pool[0];
                                                                            if (selected?.preview_url) {
                                                                                const audio = new Audio(
                                                                                    selected.preview_url
                                                                                );
                                                                                audio
                                                                                    .play()
                                                                                    .catch((err) =>
                                                                                        console.error(
                                                                                            t("create.speakers.previewFailed"),
                                                                                            err
                                                                                        )
                                                                                    );
                                                                            } else {
                                                                                alert(
                                                                                    t("create.speakers.noPreviewAvailable")
                                                                                );
                                                                            }
                                                                        }}
                                                                        className={`inline-flex items-center justify-center gap-2 px-5 h-[44px] rounded-xl border border-purple-500 text-purple-600 font-semibold transition ${isHostLocked ? "opacity-60 cursor-not-allowed" : "hover:bg-purple-50 dark:hover:bg-purple-900/20"} ${isRTL ? "flex-row-reverse" : ""}`}
                                                                    >
                                                                        {t("create.common.preview")} <Play className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })()}
                                                        <p className="form-help text-xs mt-1">
                                                            {t("create.speakers.voiceHelp")}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {(errors.speaker_names || errors.speakers) && <p className="text-rose-500 mt-4 text-center flex items-center gap-2 justify-center"><AlertCircle className="w-4 h-4" /> {errors.speaker_names || errors.speakers}</p>}
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
                        <section className="ui-card">
                            <h2 className="ui-card-title flex items-center gap-2">
                                <NotebookPen className="w-4 h-4" />
                                {t("create.step3.enterTextTitle")}
                            </h2>

                            <textarea
                                id="wecast_textarea"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder={t("create.step3.textPlaceholder", { min: MIN, max: MAX })}
                                className="form-textarea mt-3"
                                rows={8}
                            />

                            {(() => {
                                const wordCount = description.trim().split(/\s+/).filter(Boolean).length;

                                return (
                                    <div className="mt-2 text-sm flex justify-between">
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
                        <section className="ui-card">
                            <h2 className="ui-card-title flex items-center gap-2">
                                <Edit className="w-4 h-4" />
                                {t("create.step4.reviewTitle")}
                            </h2>

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
                            <div className="flex justify-between items-center">
                                <button
                                    onClick={() => {
                                        // go back to text step and allow regeneration
                                        setStep(3);
                                    }}
                                    className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"
                                >
                                    {t("create.common.backToText")}
                                </button>

                                <div className="flex gap-3">
                                    <button
                                        onClick={navigateToEdit}
                                        className="px-4 py-2 border border-purple-500 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                                    >
                                        {t("create.step4.editInEditor")}
                                    </button>
                                    <button
                                        onClick={() => setStep(5)}
                                        className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold"
                                    >
                                        {t("create.common.continueToMusic")} <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                                    </button>
                                </div>
                            </div>
                        </section>
                    )}
                    {/* STEP 5: TRANSITION MUSIC */}
                    {step === 5 && (
                        <section className="ui-card">
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
                                            className={`cursor-pointer group relative w-full p-5 rounded-2xl border transition 
                                          ${isActive
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
                        <section className="ui-card">
                            <h2 className="ui-card-title flex items-center gap-2 justify-center"><Mic2 className="w-4 h-4" /> {t("create.step6.generateAudioTitle")}</h2>

                            {!generatedAudio ? (
                                // Audio generation section
                                <div className="text-center space-y-6">
                                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800">
                                        <h3 className="text-xl font-bold text-purple-700 dark:text-purple-300 mb-3">{t("create.step6.readyTitle")}</h3>
                                        <p className="text-black/70 dark:text-white/70 mb-4">
                                            {t("create.step6.readySubtitle")}
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-left">
                                            <div>
                                                <h4 className="font-semibold mb-2">{t("create.step6.detailsTitle")}</h4>
                                                <p><strong>{t("create.step6.detailsStyle")}:</strong> {styleLabelMap[scriptStyle] || scriptStyle}</p>
                                                <p><strong>{t("create.step6.detailsSpeakers")}:</strong> {speakersCount}</p>
                                                <p><strong>{t("create.step6.detailsWords")}:</strong> {generatedScript.split(/\s+/).filter(Boolean).length}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 justify-center flex-wrap">
                                        <button
                                            onClick={() => setStep(5)}
                                            className="px-6 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"
                                        >
                                            {t("create.common.back")}
                                        </button>
                                        <button
                                            onClick={handleGenerateAudio}
                                            disabled={generatingAudio}
                                            className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold disabled:opacity-50"
                                        >
                                            {generatingAudio ? t("create.common.generatingAudio") : <>{t("create.common.generateAudio")} <Play className="w-4 h-4" /></>}
                                        </button>
                                        <button
                                            onClick={navigateToEdit}
                                            className="px-6 py-3 border border-purple-500 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                                        >
                                            {t("create.step6.editScriptFirst")}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Audio playback section
                                <div className="space-y-6">
                                    <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 border border-green-200 dark:border-green-800">
                                        <h3 className="text-xl font-bold text-green-700 dark:text-green-300 mb-4 flex items-center gap-2 justify-center">
                                            <Check className="w-5 h-5" /> {t("create.step6.audioGeneratedTitle")}
                                        </h3>

                                        {/* Audio Player */}
                                        <div className="mt-6">
                                            <WeCastAudioPlayer
                                                src={generatedAudio}
                                                title={audioTitle}
                                            />
                                        </div>

                                        {/* Additional Actions */}
                                        <div className="mt-6 flex gap-4 justify-center flex-wrap">
                                            <button
                                                onClick={() => setStep(4)}
                                                className="px-6 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"
                                            >
                                                {t("create.common.backToScript")}
                                            </button>
                                            <button
                                                onClick={handleGenerateAudio}
                                                disabled={generatingAudio}
                                                className="px-6 py-3 border border-purple-500 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                                            >
                                                {t("create.step6.regenerateAudio")}
                                            </button>
                                            <button
                                                onClick={() => {
        let editData = JSON.parse(sessionStorage.getItem("editData") || "{}");
        let podcastId = editData.podcastId;
                                                window.location.hash = podcastId ? `#/preview?id=${podcastId}` : "#/preview";
                                                }}

                                                className="px-6 py-3 border border-purple-500 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                                            >
                                                {t("create.step6.openEpisode")}
                                            </button>

                                            <button
                                                onClick={navigateToEdit}
                                                className="px-6 py-3 border border-purple-500 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                                            >
                                                {t("create.step6.editScript")}
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
                <Toast
                    toast={toast}
                    onClose={() => setToast(null)}
                    closeLabel={t("create.common.close")}
                />
            </main >
        </div >
    );
}
