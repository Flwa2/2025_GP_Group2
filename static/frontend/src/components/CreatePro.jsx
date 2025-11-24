// src/components/CreatePro.jsx
import React, { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

/* -------------------- Audio Player Component -------------------- */
function WeCastAudioPlayer({ src, title = "Generated Audio" }) {
    const audioRef = React.useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [speed, setSpeed] = useState(1);

    const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

    const formatTime = (sec) => {
        if (!sec || Number.isNaN(sec)) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const applySpeed = (rate) => {
        setSpeed(rate);
        const el = audioRef.current;
        if (el) el.playbackRate = rate;
    };

    const togglePlay = () => {
        const el = audioRef.current;
        if (!el) return;
        if (isPlaying) {
            el.pause();
        } else {
            el.playbackRate = speed;
            el.play().catch((err) => console.error("Play error:", err));
        }
    };

    const skipSeconds = (delta) => {
        const el = audioRef.current;
        if (!el || !duration) return;
        const nextTime = Math.min(Math.max(el.currentTime + delta, 0), duration);
        el.currentTime = nextTime;
        setCurrentTime(nextTime);
        setProgress((nextTime / duration) * 100);
    };

    const handleBarClick = (e) => {
        const el = audioRef.current;
        if (!el || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        const nextTime = Math.min(Math.max(ratio * duration, 0), duration);
        el.currentTime = nextTime;
        setCurrentTime(nextTime);
        setProgress((nextTime / duration) * 100);
    };

    const handleDownload = async () => {
        if (!src) return;

        try {
            // Get the audio file data without leaving the page
            const res = await fetch(src, { credentials: "include" });
            if (!res.ok) {
                console.error("Download failed with status", res.status);
                return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = (title || "Podcast Episode") + ".mp3";
            document.body.appendChild(a);
            a.click();
            a.remove();

            // Clean up in memory
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Download error:", err);
        }
    };


    return (
        <div className="w-full rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 px-5 py-4 shadow-md flex flex-col gap-3">
            {/* hidden audio element */}
            <audio
                ref={audioRef}
                src={src}
                className="hidden"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={(e) => {
                    const d = e.target.duration || 0;
                    setDuration(d);
                }}
                onEnded={() => {
                    setIsPlaying(false);
                    setCurrentTime(duration);
                    setProgress(100);
                }}
                onTimeUpdate={(e) => {
                    const el = e.target;
                    const t = el.currentTime;
                    const d = el.duration || 1;
                    setCurrentTime(t);
                    setProgress((t / d) * 100);
                }}
            />

            {/* TOP ROW: play + title + time + speed + download */}
            <div className="flex items-center gap-4">
                {/* Play / Pause button */}
                <button
                    onClick={togglePlay}
                    className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl hover:brightness-110 active:scale-95 transition"
                >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>

                <div className="flex-1 flex items-center justify-between gap-3">
                    {/* Title + time (left side) */}
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-black/80 dark:text-white">
                            {title}
                        </span>
                        <span className="text-xs text-black/60 dark:text-white/60">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    {/* Time + speed options + download (right side) */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-black/60 dark:text-white/60">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>

                        {/* Speed pill */}
                        <div className="flex items-center gap-1 rounded-full bg-black/5 dark:bg-white/5 px-2 py-1">
                            <span className="text-[0.7rem] uppercase tracking-wide text-black/50 dark:text-white/50 mr-1">
                                Speed
                            </span>
                            {SPEED_OPTIONS.map((opt) => (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => applySpeed(opt)}
                                    className={`px-2 py-0.5 rounded-full text-[0.7rem] font-semibold border transition ${speed === opt
                                        ? "bg-purple-600 text-white border-purple-600"
                                        : "bg-transparent text-black/70 dark:text-white/70 border-transparent hover:bg-black/10 dark:hover:bg-white/10"
                                        }`}
                                >
                                    {opt}×
                                </button>
                            ))}
                        </div>

                        {/* Download button */}
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-neutral-300 dark:border-neutral-700 text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 transition"
                            title="Download audio"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* PROGRESS BAR */}
            <div
                className="mt-1 h-2 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden cursor-pointer"
                onClick={handleBarClick}
            >
                <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 transition-[width]"
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* BOTTOM ROW: skip controls centered */}
            <div className="flex items-center justify-center gap-4 mt-1">
                <button
                    type="button"
                    onClick={() => skipSeconds(-10)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 transition"
                >
                    <RotateCcw className="w-4 h-4" />
                    <span>-10s</span>
                </button>
                <button
                    type="button"
                    onClick={() => skipSeconds(10)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 transition"
                >
                    <RotateCw className="w-4 h-4" />
                    <span>+10s</span>
                </button>
            </div>
        </div>
    );
}

/* -------------------- overlay: rotating logo -------------------- */
function LoadingOverlay({ show, logoSrc = "/logo.png", type = "audio" }) {
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
                        alt="WeCast logo"
                        className="w-12 h-12 rounded-full animate-[spin_6s_linear_infinite]"
                    />
                    <div>
                        <p className="font-extrabold text-black dark:text-white">
                            {type === "audio" ? "Generating audio…" : "Generating your podcast…"}
                        </p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            {type === "audio"
                                ? "Your audio is being generated. Please wait a few seconds."
                                : "We're crafting your script and setting up the editor. This may take a few seconds."
                            }
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
function Toast({ toast, onClose }) {
    if (!toast) return null;
    return (
        <div className="fixed top-4 right-4 z-[9998]">
            <div
                className={`rounded-xl px-4 py-3 shadow-lg border ${toast.type === "error"
                    ? "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-900/20 dark:text-rose-100 dark:border-rose-800/40"
                    : "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-100 dark:border-emerald-800/40"
                    }`}
            >
                <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5" />
                    <div className="text-sm font-medium">{toast.message}</div>
                    <button
                        onClick={onClose}
                        className="ml-3 opacity-60 hover:opacity-90"
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ===================================================================== */

function extractShowTitle(scriptText) {
    if (!scriptText) return "";

    // Match titles inside quotation marks
    const matchQuoted = scriptText.match(/["“](.*?)["”]/);
    if (matchQuoted) return matchQuoted[1].trim();

    // Match titles after “Title:” or “Episode Title:”
    const matchKeyword = scriptText.match(/(?:title|episode title)\s*[:\-]\s*(.+)/i);
    if (matchKeyword) return matchKeyword[1].trim();

    return "";
}


export default function CreatePro() {
    // steps: 1=Style, 2=Speakers, 3=Enter Text, 4=Review & Edit, 5=Transition Music, 6=Audio
    const [step, setStep] = useState(1);
    useEffect(() => {
        sessionStorage.setItem("currentStep", step);
    }, [step]);
    const [generatedAudio, setGeneratedAudio] = useState(null);
    const [generatingAudio, setGeneratingAudio] = useState(false);
    const [generatedScript, setGeneratedScript] = useState(null);
    const [showTitle, setShowTitle] = useState("");
    const [scriptTemplate, setScriptTemplate] = useState("");
    const [episodeTitle, setEpisodeTitle] = useState("");
    const [scriptStyle, setScriptStyle] = useState("");
    const [speakersCount, setSpeakersCount] = useState(0);
    const [speakers, setSpeakers] = useState([]);
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

    //هذي بنخليها بالداتابيس ف اسحبوا عليها 
    const MUSIC_CATEGORIES = {
        dramatic: [
            { file: "Music 1 intro C1.mp3", name: "Epic Build" },
            { file: "Music 1 Body C1.mp3", name: "Dark Piano" },
            { file: "Music 1 Outro C1.mp3", name: " Build" },

        ],
        chill: [
            { file: "chill1.mp3", name: "LoFi Breeze" },
            { file: "chill2.mp3", name: "Soft Guitar" },
        ],
        classics: [
            { file: "classic1.mp3", name: "Beethoven Intro" },
            { file: "classic2.mp3", name: "Soft Symphony" },
        ],
        arabic: [
            { file: "oud1.mp3", name: "Deep Oud" },
            { file: "oud2.mp3", name: "Modern Middle East" },
        ],
    };

    const displayedScript =
        scriptTemplate && showTitle
            ? scriptTemplate.replaceAll("{{SHOW_TITLE}}", showTitle)
            : generatedScript || "";

    // restore title and template when page reloads or user comes back
    useEffect(() => {
        const editData = JSON.parse(sessionStorage.getItem("editData") || "{}");

        if (editData.showTitle) {
            setShowTitle(editData.showTitle);
        }
        if (editData.scriptTemplate) {
            setScriptTemplate(editData.scriptTemplate);
        }
    }, []);


    //  ElevenLabs voices
    const [voices, setVoices] = useState([]);
    const [loadingVoices, setLoadingVoices] = useState(true);

    const MIN = 500;
    const MAX = 2500;

    useEffect(() => {
        const handleNavigation = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const stepParam = urlParams.get("step");
            const forceStep = sessionStorage.getItem("forceStep");
            const editData = JSON.parse(sessionStorage.getItem("editData") || "{}");
            const saved = sessionStorage.getItem("currentStep");

            // 1) Coming from Edit
            // 1) Coming from Edit
            if (editData.fromEdit && editData.generatedScript) {
                setGeneratedScript(editData.generatedScript);
                setScriptStyle(editData.scriptStyle || "");
                setSpeakersCount(editData.speakersCount || 0);
                setSpeakers(editData.speakers || []);
                setDescription(editData.description || "");

                // Restore title and template as well
                let titleFromStorage =
                    (editData.showTitle || "").trim() ||
                    (editData.episodeTitle || "").trim();

                if (!titleFromStorage) {
                    // Last chance: read it from quotes in the script
                    titleFromStorage = extractTitleFromScript(
                        editData.generatedScript || editData.scriptTemplate || ""
                    );
                }

                if (editData.scriptTemplate) {
                    setScriptTemplate(editData.scriptTemplate);
                }
                if (titleFromStorage) {
                    setShowTitle(titleFromStorage);
                    setEpisodeTitle(titleFromStorage);
                }

                setStep(4);

                sessionStorage.removeItem("forceStep");
                const cleanEditData = { ...editData };
                delete cleanEditData.fromEdit;
                sessionStorage.setItem("editData", JSON.stringify(cleanEditData));
                return;
            }


            // 2) Forced step (for deep links etc)
            if (forceStep) {
                setStep(parseInt(forceStep));
                sessionStorage.removeItem("forceStep");
                return;
            }

            // 3) Step from URL
            if (stepParam) {
                setStep(parseInt(stepParam));
                return;
            }

            // 4) Fallback to last saved step
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

                    let titleFromStorage =
                        (editData.showTitle || "").trim() ||
                        (editData.episodeTitle || "").trim();

                    if (!titleFromStorage) {
                        titleFromStorage = extractTitleFromScript(
                            editData.generatedScript || editData.scriptTemplate || ""
                        );
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

    // Group voices by gender label
    const voiceGroups = useMemo(() => {
        const groups = { male: [], female: [], other: [] };
        voices.forEach((v) => {
            const g = (v.labels?.gender || v.labels?.Gender || "").toLowerCase();
            if (g === "male") groups.male.push(v);
            else if (g === "female") groups.female.push(v);
            else groups.other.push(v);
        });
        return groups;
    }, [voices]);

    /* ---------- rules ---------- */
    const styleLimits = {
        Interview: [2, 3],
        Storytelling: [1, 2, 3],
        Educational: [1, 2, 3],
        Conversational: [2, 3],
    };

    const STYLE_GUIDELINES = {
        Interview: (
            <>
                <strong>Tone:</strong> Professional &amp; curious.
                <br />
                <strong>Flow:</strong> Host asks, guest answers (Q&amp;A).
                <br />
                <strong>Goal:</strong> Insight through dialogue.
            </>
        ),
        Storytelling: (
            <>
                <strong>Tone:</strong> Engaging &amp; narrative.
                <br />
                <strong>Flow:</strong> Chronological story with transitions.
                <br />
                <strong>Goal:</strong> Immerse the listener.
            </>
        ),
        Educational: (
            <>
                <strong>Tone:</strong> Clear &amp; structured.
                <br />
                <strong>Flow:</strong> Explain, then clarify with examples.
                <br />
                <strong>Goal:</strong> Teach effectively.
            </>
        ),
        Conversational: (
            <>
                <strong>Tone:</strong> Relaxed &amp; authentic.
                <br />
                <strong>Flow:</strong> Co-host banter and reactions.
                <br />
                <strong>Goal:</strong> Natural, friendly talk.
            </>
        ),
    };

    const styleCards = [
        {
            key: "Interview",
            title: "Interview",
            caption: "Host interviews a guest. Q&A format with dialogue focus.",
            bullets: ["Hosts: 1–2", "Guests: 1", "Pacing: Q&A"],
            valid: "2 (1H+1G) or 3 (2H+1G)",
        },
        {
            key: "Storytelling",
            title: "Storytelling",
            caption: "Narrative-focused with dramatic flow and clarity.",
            bullets: ["Hosts: 1", "Guests: 0–2", "Pacing: Narrative"],
            valid: "1 solo or 1H+1–2G",
        },
        {
            key: "Educational",
            title: "Educational",
            caption: "Teach concepts in sections with clear structure.",
            bullets: ["Hosts: 1", "Guests: 0–2", "Pacing: Organized"],
            valid: "1 solo or 1H+1–2G",
        },
        {
            key: "Conversational",
            title: "Conversational",
            caption: "Co-hosts chatting naturally, relaxed tone.",
            bullets: ["Hosts: 2–3", "Guests: 0", "Pacing: Free talk"],
            valid: "2–3 hosts only",
        },
    ];

    const defaultCount = (style) =>
        style === "Interview" ? 2 : style === "Conversational" ? 2 : 1;

    /* ---------- load voices from backend ---------- */
    useEffect(() => {
        async function loadVoices() {
            try {
                const res = await fetch("/api/voices");
                const data = await res.json();
                if (Array.isArray(data.voices)) {
                    setVoices(data.voices);
                } else if (Array.isArray(data)) {
                    setVoices(data);
                } else {
                    setVoices([]);
                }
            } catch (e) {
                console.error("Failed to load voices", e);
                setVoices([]);
            } finally {
                setLoadingVoices(false);
            }
        }
        loadVoices();
    }, []);

    const defaultVoiceForGender = (gender = "Male") => {
        const isFemale = (gender || "").toLowerCase() === "female";
        const key = isFemale ? "female" : "male";

        const pool = voiceGroups[key].length ? voiceGroups[key] : voices;
        if (!pool.length) return "";

        // Voices already used by other speakers
        const usedIds = new Set(
            speakers
                .map((s) => s.voiceId)
                .filter(Boolean)
        );

        // Try to find an unused voice in the gender pool
        const unusedInPool = pool.find((v) => !usedIds.has(v.id));
        if (unusedInPool) return unusedInPool.id;

        // If all gender voices are used, try any unused voice
        const unusedAny = voices.find((v) => !usedIds.has(v.id));
        if (unusedAny) return unusedAny.id;

        // Fallback to first available
        return pool[0].id || voices[0]?.id || "";
    };


    /* ---------- when style changes: reset speakers ---------- */
    useEffect(() => {
        if (!scriptStyle) return;
        const count = defaultCount(scriptStyle);
        setSpeakersCount(count);

        if (scriptStyle === "Interview") {
            setSpeakers([
                { name: "", gender: "Male", role: "host", voiceId: defaultVoiceForGender("Male") },
                { name: "", gender: "Female", role: "guest", voiceId: defaultVoiceForGender("Female") },
            ]);
        } else if (scriptStyle === "Conversational") {
            setSpeakers([
                { name: "", gender: "Male", role: "host", voiceId: defaultVoiceForGender("Male") },
                { name: "", gender: "Female", role: "host", voiceId: defaultVoiceForGender("Female") },
            ]);
        } else {
            setSpeakers([
                { name: "", gender: "Male", role: "host", voiceId: defaultVoiceForGender("Male") },
            ]);
        }
        setErrors({});
    }, [scriptStyle, voices.length]);

    /* ---------- when voices finish loading, fill missing voiceIds ---------- */
    useEffect(() => {
        if (loadingVoices || !voices.length || !speakers.length) return;
        setSpeakers((prev) =>
            prev.map((s) => ({
                ...s,
                voiceId: s.voiceId || defaultVoiceForGender(s.gender),
            }))
        );
    }, [loadingVoices, voices.length]);

    /* ---------- when count changes: rebuild array & roles ---------- */
    useEffect(() => {
        if (!scriptStyle || !speakersCount) return;
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
                    voiceId: old.voiceId || defaultVoiceForGender(gender),
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
    }, [speakersCount, scriptStyle, voices.length]);

    /* ---------- helpers ---------- */
    const allowedCounts = useMemo(() => styleLimits[scriptStyle] || [], [scriptStyle]);
    const showRoleSelect = scriptStyle !== "Conversational" && scriptStyle !== "Educational" && scriptStyle !== "Storytelling" && scriptStyle !== "Interview";
    const anyEmptySpeakerName = speakers.some((s) => !String(s.name || "").trim());

    const normalizeName = (s = "") =>
        s.trim().toLowerCase().replace(/\s+/g, " ");

    const hasDuplicateNames = useMemo(() => {
        const names = speakers
            .map((s) => normalizeName(s.name))
            .filter(Boolean); // ignore empty
        return new Set(names).size !== names.length;
    }, [speakers]);

    const continueFromStyle = () => {
        if (!scriptStyle) {
            setErrors({ script_style: "Choose a podcast style first." });
            setToast({ type: "error", message: "Please choose a podcast style to continue." });
            setTimeout(() => setToast(null), 2600);
            return;
        }
        setErrors({});
        setStep(2);
        setToast({ type: "success", message: "Style selected. Now configure speakers." });
        setTimeout(() => setToast(null), 2400);
    };

    const onContinueFromSpeakers = () => {
        const errs = {};
        if (!scriptStyle) errs.script_style = "Choose a podcast style first.";
        if (!allowedCounts.includes(Number(speakersCount))) {
            errs.speakers = "Invalid number of speakers for this style.";
        }
        if (anyEmptySpeakerName) {
            errs.speaker_names = "Please enter a name for every speaker before continuing.";
        } else if (hasDuplicateNames) {
            errs.speaker_names = "Speaker names must be unique. Please use different names for each speaker.";
        }

        setErrors(errs);
        if (Object.keys(errs).length === 0) {
            setStep(3);
            setToast({ type: "success", message: "Speakers set. Paste your text to generate the script." });
            setTimeout(() => setToast(null), 2400);
        } else {
            setToast({ type: "error", message: Object.values(errs)[0] });
            setTimeout(() => setToast(null), 2800);
        }
    };


    const handleGenerate = async () => {
        const words = description.trim().split(/\s+/).filter(Boolean).length;
        if (words < MIN) {
            setErrors({ description: `At least ${MIN} words.` });
            return;
        }
        if (words > MAX) {
            setErrors({ description: `Max ${MAX} words.` });
            return;
        }

        setSubmitting(true);
        setErrors({});

        try {
            const res = await fetch("/api/generate", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    script_style: scriptStyle,
                    speakers: Number(speakersCount),
                    speakers_info: speakers,
                    description,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.script) {
                setErrors({ server: data.error || "Generation failed." });
                setSubmitting(false);
                return;
            }

            // template from backend
            const template = data.script;

            // Try all possible keys from backend
            const backendTitle =
                data.show_title || data.title || "Podcast Episode";

            // store template + title
            setScriptTemplate(template);
            setShowTitle(backendTitle);
            setEpisodeTitle(backendTitle);

            // rendered script that the user will SEE
            const rendered = template.replaceAll("{{SHOW_TITLE}}", backendTitle);
            setGeneratedScript(rendered);

            // overwrite editData every generation
            const editData = {
                scriptStyle,
                speakersCount,
                speakers,
                description,
                scriptTemplate: template,
                showTitle: backendTitle,
                episodeTitle: backendTitle,
                generatedScript: rendered,
            };
            sessionStorage.setItem("editData", JSON.stringify(editData));
            sessionStorage.removeItem("guestEditDraft");


            setToast({
                type: "success",
                message: "Script generated successfully! Review it below.",
            });
            setTimeout(() => setToast(null), 2400);
            setStep(4);
        } catch (e) {
            setErrors({ server: "Generation failed. Please check backend." });
        } finally {
            setSubmitting(false);
        }
    };


    const handleGenerateAudio = async () => {
        if (!generatedScript) {
            setToast({ type: "error", message: "Please generate a script first." });
            setTimeout(() => setToast(null), 2800);
            return;
        }

        setGeneratingAudio(true);
        setGeneratedAudio(null);

        try {
            const response = await fetch("/api/audio", {  // ← CHANGED TO /api/audio
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scriptText: generatedScript,  // ← CHANGED TO scriptText
                    script_style: scriptStyle,
                    speakers_info: speakers,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.url) {  // ← CHANGED TO data.url
                throw new Error(data.error || "Audio generation failed");
            }

            setGeneratedAudio(data.url + "?t=" + Date.now());  // ← CHANGED TO data.url
            setToast({
                type: "success",
                message: "Audio generated successfully!",
            });
            setTimeout(() => setToast(null), 2400);

        } catch (error) {
            console.error("Audio generation error:", error);
            setToast({
                type: "error",
                message: "Audio generation failed. Please try again.",
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
                message: "Please generate a script first before editing.",
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
        };

        sessionStorage.setItem("editData", JSON.stringify(editData));
        window.location.hash = "#/edit";
    };


    /* ---------- stepper (done=gray) ---------- */
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

    // Count how many of each role we have (host, guest, etc.)
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
                ? `${scriptStyle} Podcast - ${speakersCount} Speakers`
                : "Podcast Episode"),
        [showTitle, episodeTitle, scriptStyle, speakersCount]
    );



    return (
        <div className="min-h-screen bg-cream dark:bg-[#0a0a0a]">
            <div className="h-2 bg-purple-gradient" />
            <main className="w-full max-w-[1400px] mx-auto px-6 py-10">
                {/* Title */}
                <header className="mb-6 text-center">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-black dark:text-white">
                        {step === 1 && "Choose Style"}
                        {step === 2 && "Add Speakers"}
                        {step === 3 && "Write Your Content"}
                        {step === 4 && "Review & Edit Script"}
                        {step === 5 && "Select Transition Music"}
                        {step === 6 && "Generate Your Podcast Audio"}
                    </h1>

                    <p className="mt-2 text-black/70 dark:text-white/70">
                        {step === 1 && "Choose the overall tone and format for your podcast episode."}
                        {step === 2 && "Add your speakers and choose their names and voices.ss"}
                        {step === 3 && "Paste or write the content you want turned into a structured podcast script."}
                        {step === 4 && "Review your script, make quick edits, and get it ready for audio."}
                        {step === 5 && "Choose a transition track to give your podcast smoother flow."}
                        {step === 6 && "Turn your script into polished, natural-sounding podcast audio."}
                    </p>
                </header>



                {/* Stepper */}
                <div className="w-full max-w-[1400px] mx-auto rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 p-4 mb-8">
                    <div className="flex items-center gap-2">
                        <StepDot n={1} label="Choose Style" />
                        <StepLine on={step > 1} />

                        <StepDot n={2} label="Add Speakers" />
                        <StepLine on={step > 2} />

                        <StepDot n={3} label="Write Content" />
                        <StepLine on={step > 3} />

                        <StepDot n={4} label="Review & Edit Script" />
                        <StepLine on={step > 4} />

                        <StepDot n={5} label="Select Music" />
                        <StepLine on={step > 5} />

                        <StepDot n={6} label="Generate Audio" />
                    </div>
                </div>




                <div className="max-w-5xl mx-auto">
                    {/* STEP 1: STYLE */}
                    {step === 1 && (
                        <section className="ui-card">
                            <h2 className="ui-card-title flex items-center gap-2 justify-center">
                                <Mic2 className="w-4 h-4" /> Podcast Style
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 justify-items-center">
                                {styleCards.map((s) => (
                                    <label key={s.key} onClick={() => setScriptStyle(s.key)} onMouseEnter={() => setHoverKey(s.key)} onMouseLeave={() => setHoverKey((k) => (k === s.key ? null : k))} className={`group relative w-full max-w-xl p-4 rounded-xl border transition cursor-pointer ${scriptStyle === s.key ? "border-purple-400/60 bg-purple-500/10" : "border-neutral-300 dark:border-neutral-800 hover:bg-black/5 dark:hover:bg-white/5"}`}>
                                        <div className="flex items-start gap-3">
                                            <input type="radio" checked={scriptStyle === s.key} readOnly className="accent-purple-600 mt-1" />
                                            <div className="w-full">
                                                <div className="flex items-center gap-2 font-bold">
                                                    <span className="truncate">{s.title}</span>
                                                    {scriptStyle === s.key && <span className="text-xs text-purple-500 flex items-center gap-1"><Check className="w-3 h-3" /> Selected</span>}
                                                </div>
                                                <p className="text-sm mt-1">{s.caption}</p>
                                                <ul className="flex flex-wrap gap-2 mt-2 text-xs text-black/70 dark:text-white/70">
                                                    {s.bullets.map((b, i) => <li key={i} className="px-2 py-1 rounded bg-black/5 dark:bg-white/5">{b}</li>)}
                                                </ul>
                                                <p className="text-xs text-purple-500 mt-2">Valid: {s.valid}</p>
                                            </div>
                                        </div>
                                        {hoverKey === s.key && (
                                            <div className="absolute left-5 right-5 top-[calc(100%+30px)] z-40">
                                                <div className="relative rounded-2xl bg-gradient-to-br from-purple-400 to-violet-700 text-white shadow-2xl border border-white/10 p-4 animate-[popoverIn_120ms_ease-out]">
                                                    <div className="flex items-center gap-2 font-semibold tracking-wide"><Info className="w-4 h-4 opacity-90" /><span>Style guidelines</span></div>
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
                                <button onClick={continueFromStyle} className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold">Continue <ChevronRight className="w-4 h-4" /></button>
                            </div>
                        </section>
                    )}

                    {/* STEP 2: SPEAKERS */}
                    {step === 2 && (
                        <section className="ui-card">
                            <h2 className="ui-card-title flex items-center gap-2 justify-center"><Users className="w-4 h-4" /> Speakers</h2>
                            {scriptStyle && (
                                <div className="flex items-center gap-2 flex-wrap mt-3 justify-center">
                                    {allowedCounts.map((n) => (
                                        <button key={n} onClick={() => setSpeakersCount(n)} className={`px-4 py-2 text-sm font-semibold rounded-xl transition border ${speakersCount === n ? "bg-purple-600 text-white border-purple-600" : "bg-black/5 dark:bg-white/5 border-neutral-300 dark:border-neutral-800 text-black/70 dark:text-white/70 hover:bg-black/10"}`}>
                                            {n} {n === 1 ? "Speaker" : "Speakers"}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {speakers.length > 0 && (
                                <div className={`mt-5 grid gap-5 ${speakers.length === 1 ? "grid-cols-1 max-w-md" : speakers.length === 2 ? "grid-cols-1 md:grid-cols-2 max-w-4xl" : "grid-cols-1 md:grid-cols-3 max-w-5xl"} mx-auto`}>
                                    {speakers.map((sp, i) => {
                                        // 1) Normalize the role coming from your style
                                        // Normalize the role name coming from the style
                                        let rawRole = sp.role || "guest";

                                        // Count how many hosts exist
                                        const totalHosts = roleCounts["Host"] || roleCounts["host"] || 0;

                                        // Convert roles into UI roles
                                        let role;

                                        // If multiple hosts → turn all of them into Co-hosts
                                        if (rawRole === "host" && totalHosts > 1) {
                                            role = "Co-host";
                                        } else if (rawRole === "host") {
                                            role = "Host";
                                        } else if (rawRole === "cohost") {
                                            role = "Co-host";
                                        } else if (rawRole === "narrator") {
                                            role = "Narrator";
                                        } else {
                                            role = "Guest";
                                        }

                                        // Track usage for numbering (Guest 1, Co-host 1, etc.)
                                        roleUsage[role] = (roleUsage[role] || 0) + 1;
                                        const occurrence = roleUsage[role];

                                        // Build label
                                        const label =
                                            roleCounts[rawRole] > 1 && role !== "Host"
                                                ? `${role} ${occurrence}`
                                                : role;

                                        return (
                                            <div
                                                key={i}
                                                className="rounded-xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 w-full"
                                            >
                                                {/* Card title now uses role label */}
                                                <h3 className="text-sm font-bold text-black/80 dark:text-white/80">
                                                    {label}
                                                </h3>
                                                <p className="mt-1 text-xs text-neutral-500">
                                                    Roles are fixed for this style. You can edit the name, gender, and voice.
                                                </p>

                                                <div className="mt-3 space-y-3">
                                                    {/* Name */}
                                                    <div>
                                                        <label className="form-label">Name</label>
                                                        <input
                                                            value={sp.name}
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
                                                            placeholder={`${label} name`}
                                                            className={`form-input ${errors.speaker_names && !sp.name.trim()
                                                                ? "border-rose-400"
                                                                : ""
                                                                }`}
                                                        />
                                                    </div>

                                                    {/* Gender ONLY (Role field removed) */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="form-label">Gender</label>
                                                            <select
                                                                value={sp.gender}
                                                                onChange={(e) =>
                                                                    setSpeakers((arr) => {
                                                                        const n = [...arr];
                                                                        const gender = e.target.value;
                                                                        n[i] = {
                                                                            ...n[i],
                                                                            gender,
                                                                            voiceId:
                                                                                n[i].voiceId ||
                                                                                defaultVoiceForGender(gender),
                                                                        };
                                                                        return n;
                                                                    })
                                                                }
                                                                className="form-input"
                                                            >
                                                                <option>Male</option>
                                                                <option>Female</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Voice picker (unchanged) */}
                                                    <div>
                                                        <label className="form-label">Voice</label>
                                                        {loadingVoices ? (
                                                            <p className="text-sm text-black/60 dark:text-white/60">
                                                                Loading voices…
                                                            </p>
                                                        ) : voices.length === 0 ? (
                                                            <p className="text-sm text-rose-500">
                                                                No voices found. Check ElevenLabs config.
                                                            </p>
                                                        ) : (() => {
                                                            const genderKey =
                                                                (sp.gender || "").toLowerCase() === "female"
                                                                    ? "female"
                                                                    : "male";
                                                            const pool = voiceGroups[genderKey].length
                                                                ? voiceGroups[genderKey]
                                                                : voices;
                                                            const currentId = sp.voiceId || pool[0]?.id || "";
                                                            return (
                                                                <div className="flex items-center gap-3">
                                                                    <select
                                                                        className="form-input flex-1"
                                                                        value={currentId}
                                                                        onChange={(e) => {
                                                                            const newVoice = e.target.value;

                                                                            // Prevent duplicate assignment
                                                                            const alreadyUsed = speakers.some(
                                                                                (s, idx) => s.voiceId === newVoice && idx !== i
                                                                            );

                                                                            if (alreadyUsed) {
                                                                                alert("⚠️ This voice is already used by another speaker. Please choose a different one.");
                                                                                return;
                                                                            }

                                                                            setSpeakers((arr) => {
                                                                                const n = [...arr];
                                                                                n[i] = { ...n[i], voiceId: newVoice };
                                                                                return n;
                                                                            });
                                                                        }}
                                                                    >
                                                                        <option value="">Select Voice</option>
                                                                        {pool.map((v) => {
                                                                            const isTaken = speakers.some(
                                                                                (s, idx) => s.voiceId === v.id && idx !== i
                                                                            );

                                                                            return (
                                                                                <option key={v.id} value={v.id} disabled={isTaken}>
                                                                                    {v.name} {isTaken ? "(Already Used)" : ""}
                                                                                </option>
                                                                            );
                                                                        })}
                                                                    </select>
                                                                    <button
                                                                        type="button"
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
                                                                                            "Preview failed",
                                                                                            err
                                                                                        )
                                                                                    );
                                                                            } else {
                                                                                alert(
                                                                                    "No preview available for this voice."
                                                                                );
                                                                            }
                                                                        }}
                                                                        className="inline-flex items-center justify-center gap-2 px-5 h-[44px] rounded-xl border border-purple-500 text-purple-600 font-semibold hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                                                                    >
                                                                        <Play className="w-4 h-4" /> Preview
                                                                    </button>
                                                                </div>
                                                            );
                                                        })()}
                                                        <p className="form-help text-xs mt-1">
                                                            This voice will be used when generating audio for this speaker.
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
                                <button onClick={() => setStep(1)} className="px-4 py-2 border rounded-xl">Back</button>
                                <button onClick={onContinueFromSpeakers} className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold">Continue <ChevronRight className="w-4 h-4" /></button>
                            </div>
                        </section>
                    )}

                    {/* STEP 3: ENTER TEXT */}
                    {step === 3 && (
                        <section className="ui-card">
                            <h2 className="ui-card-title flex items-center gap-2">
                                <NotebookPen className="w-4 h-4" />
                                Enter your text
                            </h2>

                            <textarea
                                id="wecast_textarea"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Paste your text here (min 500, max 2500 words)…"
                                className="form-textarea mt-3"
                                rows={8}
                            />
                            <div className="mt-2 text-sm flex justify-between">
                                <span
                                    className={`${description.trim().split(/\s+/).filter(Boolean).length < MIN
                                        ? "text-rose-500"
                                        : "text-purple-500"
                                        }`}
                                >
                                    {description.trim().split(/\s+/).filter(Boolean).length} / {MAX} words
                                </span>
                                {errors.description && (
                                    <span className="text-rose-500">{errors.description}</span>
                                )}
                            </div>
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
                                    Back
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={submitting}
                                    className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold disabled:opacity-50"
                                >
                                    {submitting ? (
                                        "Generating Script..."
                                    ) : (
                                        <>
                                            Generate Script <Wand2 className="w-4 h-4" />
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
                                Review your script
                            </h2>

                            <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 border border-green-200 dark:border-green-800 mb-6">
                                <h3 className="text-xl font-bold text-green-700 dark:text-green-300 mb-4 flex items-center gap-2">
                                    <Check className="w-5 h-5" /> Script Generated Successfully!
                                </h3>

                                {/* Script Information ABOVE the script */}
                                <div className="bg-white dark:bg-neutral-800 rounded-xl p-4 mb-4">
                                    <h4 className="font-semibold mb-3 text-black dark:text-white">
                                        Script Information:
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p>
                                                <strong>Style:</strong> {scriptStyle}
                                            </p>
                                            <p>
                                                <strong>Speakers:</strong> {speakersCount}
                                            </p>
                                            <p>
                                                <strong>Total Words:</strong>{" "}
                                                {generatedScript.split(/\s+/).filter(Boolean).length}
                                            </p>
                                        </div>
                                        <div>
                                            <p>
                                                <strong>Speaker Roles:</strong>{" "}
                                                {speakers.map((s) => s.role).join(", ")}
                                            </p>
                                            <p>
                                                <strong>Status:</strong> Ready for audio generation
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Script Preview */}
                                <div className="bg-white dark:bg-neutral-800 rounded-xl p-4">
                                    <h4 className="font-semibold mb-3 text-black dark:text-white">
                                        Script Preview:
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
                                    Back to text
                                </button>

                                <div className="flex gap-3">
                                    <button
                                        onClick={navigateToEdit}
                                        className="px-4 py-2 border border-purple-500 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                                    >
                                        Edit in Editor
                                    </button>
                                    <button
                                        onClick={() => setStep(5)}
                                        className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold"
                                    >
                                        Continue to Transition Music <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </section>
                    )}
                    {/* STEP 5: TRANSITION MUSIC (placeholder) */}
                    {step === 5 && (
                        <section className="ui-card">
                            <h2 className="ui-card-title flex items-center gap-2 justify-center">
                                🎧 Select Transition Music
                            </h2>

                            <p className="text-center text-sm text-black/60 dark:text-white/60 mt-2">
                                Choose a music category to preview intro, body, and outro tracks.
                            </p>

                            {/* CATEGORY SELECT */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                                {Object.keys(MUSIC_CATEGORIES).map((cat) => (
                                    <label
                                        key={cat}
                                        onClick={() => {
                                            setCategory(cat);
                                            setAvailableTracks(MUSIC_CATEGORIES[cat]);
                                        }}
                                        className={`cursor-pointer group relative w-full p-5 rounded-xl border transition 
                ${category === cat
                                                ? "border-purple-500 bg-purple-50"
                                                : "border-neutral-300 dark:border-neutral-800 hover:bg-black/5 dark:hover:bg-white/5"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                checked={category === cat}
                                                readOnly
                                                className="accent-purple-600 mt-1"
                                            />
                                            <div>
                                                <div className="font-semibold capitalize">{cat}</div>
                                                <p className="text-xs text-black/60 dark:text-white/60">
                                                    {cat === "dramatic" && "Epic emotional cinematic style."}
                                                    {cat === "arabic" && "Middle eastern oud and oriental tones."}
                                                    {cat === "chill" && "Relaxed lofi and smooth vibes."}
                                                    {cat === "classics" && "Soft piano and orchestral melodies."}
                                                </p>
                                            </div>
                                        </div>

                                        {category === cat && (
                                            <span className="absolute top-2 right-3 text-purple-500 text-xs">
                                                ✓ Selected
                                            </span>
                                        )}
                                    </label>
                                ))}
                            </div>

                            {/* TRACK LIST */}
                            {category && availableTracks.length > 0 && (
                                <div className="mt-8 space-y-4">
                                    {["Intro", "Body", "Outro"].map((label, index) => (
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
                                                    <option value="">-- Select --</option>
                                                    {availableTracks.map((track) => (
                                                        <option key={track.file} value={track.file}>{track.name}</option>
                                                    ))}
                                                </select>

                                                <button
                                                    className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${(index === 0 && !introMusic) ||
                                                        (index === 1 && !bodyMusic) ||
                                                        (index === 2 && !outroMusic)
                                                        ? "opacity-40 cursor-not-allowed"
                                                        : "border-purple-500 text-purple-600 hover:bg-purple-50"
                                                        }`}
                                                    onClick={() => {
                                                        const selected =
                                                            index === 0 ? introMusic : index === 1 ? bodyMusic : outroMusic;
                                                        if (selected) {
                                                            setMusicPreview(`http://localhost:5000/static/music/${selected}`);
                                                        }
                                                    }}
                                                >
                                                    ▶ Preview
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
                                    Back
                                </button>

                                <div className="flex items-center gap-3">
                                    {/* Skip Button */}
                                    <button
                                        onClick={async () => {
                                            try {
                                                // Clear saved music on backend
                                                await fetch("/api/save-music", {
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
                                        Skip
                                    </button>


                                    {/* Continue Button */}
                                    <button
                                        disabled={!introMusic || !bodyMusic || !outroMusic}
                                        onClick={async () => {
                                            await fetch("/api/save-music", {
                                                method: "POST",
                                                credentials: "include",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ introMusic, bodyMusic, outroMusic }),
                                            });
                                            setStep(6);
                                        }}
                                        className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold disabled:opacity-50"
                                    >
                                        Continue to Audio →
                                    </button>
                                </div>
                            </div>

                        </section>
                    )}


                    {/* STEP 6: AUDIO */}
                    {step === 6 && (
                        <section className="ui-card">
                            <h2 className="ui-card-title flex items-center gap-2 justify-center"><Mic2 className="w-4 h-4" /> Generate Audio</h2>

                            {!generatedAudio ? (
                                // Audio generation section
                                <div className="text-center space-y-6">
                                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-6 border border-purple-200 dark:border-purple-800">
                                        <h3 className="text-xl font-bold text-purple-700 dark:text-purple-300 mb-3">Ready to Generate Audio</h3>
                                        <p className="text-black/70 dark:text-white/70 mb-4">
                                            Your script has been generated successfully! Now you can create the audio version of your podcast using the voices you selected.
                                        </p>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-left">
                                            <div>
                                                <h4 className="font-semibold mb-2">Podcast Details:</h4>
                                                <p><strong>Style:</strong> {scriptStyle}</p>
                                                <p><strong>Speakers:</strong> {speakersCount}</p>
                                                <p><strong>Words:</strong> {generatedScript.split(/\s+/).filter(Boolean).length}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 justify-center flex-wrap">
                                        <button
                                            onClick={() => setStep(5)}
                                            className="px-6 py-3 border border-neutral-300 dark:border-neutral-700 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"
                                        >
                                            Back
                                        </button>
                                        <button
                                            onClick={handleGenerateAudio}
                                            disabled={generatingAudio}
                                            className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold disabled:opacity-50"
                                        >
                                            {generatingAudio ? "Generating Audio..." : <>Generate Audio <Play className="w-4 h-4" /></>}
                                        </button>
                                        <button
                                            onClick={navigateToEdit}
                                            className="px-6 py-3 border border-purple-500 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                                        >
                                            Edit Script First
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Audio playback section
                                <div className="space-y-6">
                                    <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 border border-green-200 dark:border-green-800">
                                        <h3 className="text-xl font-bold text-green-700 dark:text-green-300 mb-4 flex items-center gap-2 justify-center">
                                            <Check className="w-5 h-5" /> Audio Generated Successfully! 🎉
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
                                                Back to Script
                                            </button>
                                            <button
                                                onClick={handleGenerateAudio}
                                                disabled={generatingAudio}
                                                className="px-6 py-3 border border-purple-500 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                                            >
                                                Regenerate Audio
                                            </button>
                                            <button
                                                onClick={navigateToEdit}
                                                className="px-6 py-3 border border-purple-500 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                                            >
                                                Edit Script
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* overlays */}
                <LoadingOverlay show={submitting} type="script" />
                <LoadingOverlay show={generatingAudio} type="audio" />
                <Toast toast={toast} onClose={() => setToast(null)} />
            </main>
        </div>
    );
}
