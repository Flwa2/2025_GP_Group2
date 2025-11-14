// src/components/CreatePro.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
    Mic2,
    Users,
    NotebookPen,
    ChevronRight,
    Check,
    Plus,
    Info,
    Wand2,
    AlertCircle,
    Play,
} from "lucide-react";

/* -------------------- overlay: rotating logo -------------------- */
function LoadingOverlay({ show, logoSrc = "/logo.png" }) {
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
                            Generating your podcast…
                        </p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            We’re crafting your script and setting up the editor. This may
                            take a few seconds.
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

export default function CreatePro() {
    // steps: 1=Style, 2=Speakers, 3=Text
    const [step, setStep] = useState(1);

    const [scriptStyle, setScriptStyle] = useState("");
    const [speakersCount, setSpeakersCount] = useState(0);
    const [speakers, setSpeakers] = useState([]);
    const [description, setDescription] = useState("");

    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);
    const [hoverKey, setHoverKey] = useState(null); // for hover guidelines

    // 🔊 ElevenLabs voices
    const [voices, setVoices] = useState([]);
    const [loadingVoices, setLoadingVoices] = useState(true);

    const MIN = 500;
    const MAX = 2500;

    // Group voices by gender label (if ElevenLabs provides it)
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

                // ✅ handle { voices: [...] }  OR  [...] directly
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
        const key = (gender || "").toLowerCase() === "female" ? "female" : "male";

        // Prefer voices that match the gender label, otherwise fall back to all voices.
        const pool = voiceGroups[key].length ? voiceGroups[key] : voices;
        return pool[0]?.id || "";
    };


    /* ---------- when style changes: reset speakers ---------- */
    useEffect(() => {
        if (!scriptStyle) return;
        const count = defaultCount(scriptStyle);
        setSpeakersCount(count);

        if (scriptStyle === "Interview") {
            setSpeakers([
                {
                    name: "",
                    gender: "Male",
                    role: "host",
                    voiceId: defaultVoiceForGender("Male"),
                },
                {
                    name: "",
                    gender: "Female",
                    role: "guest",
                    voiceId: defaultVoiceForGender("Female"),
                },
            ]);
        } else if (scriptStyle === "Conversational") {
            setSpeakers([
                {
                    name: "",
                    gender: "Male",
                    role: "host",
                    voiceId: defaultVoiceForGender("Male"),
                },
                {
                    name: "",
                    gender: "Female",
                    role: "host",
                    voiceId: defaultVoiceForGender("Female"),
                },
            ]);
        } else {
            setSpeakers([
                {
                    name: "",
                    gender: "Male",
                    role: "host",
                    voiceId: defaultVoiceForGender("Male"),
                },
            ]);
        }
        setErrors({});
        setStep(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scriptStyle, voices.length]); // re-run when style or voice list ready

    /* ---------- when voices finish loading, fill missing voiceIds ---------- */
    useEffect(() => {
        if (loadingVoices || !voices.length || !speakers.length) return;
        setSpeakers((prev) =>
            prev.map((s) => ({
                ...s,
                voiceId: s.voiceId || defaultVoiceForGender(s.gender),
            }))
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [speakersCount, scriptStyle, voices.length]);

    /* ---------- helpers ---------- */
    const allowedCounts = useMemo(
        () => styleLimits[scriptStyle] || [],
        [scriptStyle]
    );
    const showRoleSelect =
        scriptStyle !== "Conversational" && scriptStyle !== "Interview";
    const anyEmptySpeakerName = speakers.some(
        (s) => !String(s.name || "").trim()
    );

    const continueFromStyle = () => {
        if (!scriptStyle) {
            setErrors({ script_style: "Choose a podcast style first." });
            setToast({
                type: "error",
                message: "Please choose a podcast style to continue.",
            });
            setTimeout(() => setToast(null), 2600);
            return;
        }
        setErrors({});
        setStep(2);
        setToast({
            type: "success",
            message: "Style selected. Now configure speakers.",
        });
        setTimeout(() => setToast(null), 2400);
    };

    const onContinueFromSpeakers = () => {
        const errs = {};
        if (!scriptStyle) errs.script_style = "Choose a podcast style first.";
        if (!allowedCounts.includes(Number(speakersCount)))
            errs.speakers = "Invalid number of speakers for this style.";
        if (anyEmptySpeakerName)
            errs.speaker_names =
                "Please enter a name for every speaker before continuing.";

        setErrors(errs);
        if (Object.keys(errs).length === 0) {
            setStep(3);
            setToast({
                type: "success",
                message: "Speakers set. Paste your text to generate the script.",
            });
            setTimeout(() => setToast(null), 2400);
        } else {
            setToast({ type: "error", message: Object.values(errs)[0] });
            setTimeout(() => setToast(null), 2800);
        }
    };

    const handleGenerate = async () => {
        // basic validations you already had…
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
        setErrors({}); // clear old errors

        try {
            const res = await fetch("/api/generate", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    script_style: scriptStyle,
                    speakers: Number(speakersCount),
                    speakers_info: speakers, // includes voiceId now
                    description,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.script) {
                setErrors({ server: data.error || "Generation failed." });
                setSubmitting(false);
                return;
            }

            // success → go to React editor route
            window.location.hash = "#/edit";
        } catch (e) {
            setErrors({ server: "Generation failed. Please check backend." });
            setSubmitting(false);
        }
    };

    /* ---------- stepper (done=gray) ---------- */
    const StepDot = ({ n, label }) => {
        const state = step === n ? "active" : step > n ? "done" : "pending";
        const dot =
            state === "active"
                ? "bg-purple-600 text-white shadow"
                : state === "done"
                    ? "bg-neutral-300 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
                    : "bg-black/10 dark:bg-white/10 text-black/70 dark:text-white/70";
        const labelCls =
            state === "active"
                ? "text-purple-600"
                : state === "done"
                    ? "text-neutral-500 dark:text-neutral-400"
                    : "text-black/60 dark:text-white/60";
        return (
            <div className="flex items-center gap-3">
                <div
                    className={`w-8 h-8 rounded-full grid place-items-center text-sm font-bold ${dot}`}
                >
                    {n}
                </div>
                <div className={`text-sm font-semibold ${labelCls}`}>{label}</div>
            </div>
        );
    };
    const StepLine = ({ on }) => (
        <div
            className={`h-[3px] flex-1 rounded-full ${on
                ? "bg-gradient-to-r from-purple-600 to-pink-500"
                : "bg-black/10 dark:bg-white/10"
                }`}
        />
    );

    /* ---------- layout ---------- */
    return (
        <div className="min-h-screen bg-cream dark:bg-[#0a0a0a]">
            <div className="h-2 bg-purple-gradient" />

            <main className="max-w-6xl mx-auto px-6 py-10">
                {/* Title */}
                <header className="mb-6 text-center">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-black dark:text-white">
                        {step === 1 && "Create your podcast"}
                        {step === 2 && "Configure speakers"}
                        {step === 3 && "Paste your text"}
                    </h1>
                    <p className="mt-2 text-black/70 dark:text-white/70">
                        {step === 1 &&
                            "Pick a style first. Hover a card to preview the style guidelines."}
                        {step === 2 &&
                            "Choose how many speakers and fill their details (name, role, voice)."}
                        {step === 3 &&
                            "Provide your content to generate the script, then move to audio."}
                    </p>
                </header>

                {/* Stepper (under title) */}
                <div className="max-w-3xl mx-auto rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 p-4 mb-8">
                    <div className="flex items-center gap-4">
                        <StepDot n={1} label="Style" />
                        <StepLine on={step >= 2} />
                        <StepDot n={2} label="Speakers" />
                        <StepLine on={step >= 3} />
                        <StepDot n={3} label="Text" />
                    </div>
                </div>

                {/* ===================== STEP 1: STYLE ===================== */}
                {step === 1 && (
                    <section className="ui-card">
                        <h2 className="ui-card-title flex items-center gap-2 justify-center">
                            <Mic2 className="w-4 h-4" /> Podcast Style
                        </h2>

                        {/* Cards grid with HOVER guidelines */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 justify-items-center">
                            {styleCards.map((s) => (
                                <label
                                    key={s.key}
                                    onClick={() => setScriptStyle(s.key)}
                                    onMouseEnter={() => setHoverKey(s.key)}
                                    onMouseLeave={() =>
                                        setHoverKey((k) => (k === s.key ? null : k))
                                    }
                                    className={`group relative w-full max-w-xl p-4 rounded-xl border transition cursor-pointer ${scriptStyle === s.key
                                        ? "border-purple-400/60 bg-purple-500/10"
                                        : "border-neutral-300 dark:border-neutral-800 hover:bg-black/5 dark:hover:bg-white/5"
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <input
                                            type="radio"
                                            checked={scriptStyle === s.key}
                                            readOnly
                                            className="accent-purple-600 mt-1"
                                        />
                                        <div className="w-full">
                                            <div className="flex items-center gap-2 font-bold">
                                                <span className="truncate">{s.title}</span>
                                                {scriptStyle === s.key && (
                                                    <span className="text-xs text-purple-500 flex items-center gap-1">
                                                        <Check className="w-3 h-3" /> Selected
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-sm mt-1">{s.caption}</p>
                                            <ul className="flex flex-wrap gap-2 mt-2 text-xs text-black/70 dark:text-white/70">
                                                {s.bullets.map((b, i) => (
                                                    <li
                                                        key={i}
                                                        className="px-2 py-1 rounded bg-black/5 dark:bg-white/5"
                                                    >
                                                        {b}
                                                    </li>
                                                ))}
                                            </ul>
                                            <p className="text-xs text-purple-500 mt-2">
                                                Valid: {s.valid}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Hover guidelines popover (glass look + arrow) */}
                                    {hoverKey === s.key && (
                                        <div className="absolute left-5 right-5 top-[calc(100%+30px)] z-40">
                                            <div
                                                className="
        relative rounded-2xl
        bg-gradient-to-br from-purple-400 to-violet-700
        text-white shadow-2xl
        border border-white/10
        p-4
        animate-[popoverIn_120ms_ease-out]
      "
                                            >
                                                <div className="flex items-center gap-2 font-semibold tracking-wide">
                                                    <Info className="w-4 h-4 opacity-90" />
                                                    <span>Style guidelines</span>
                                                </div>
                                                <div className="mt-2 leading-relaxed text-[0.95rem]">
                                                    {STYLE_GUIDELINES[s.key]}
                                                </div>
                                                {/* arrow */}
                                                <span
                                                    className="
          absolute -top-2 left-8 w-3 h-3 rotate-45
          bg-purple-600
          shadow-[0_6px_16px_rgba(0,0,0,0.25)]
          border-l border-t border-white/10
        "
                                                />
                                            </div>
                                        </div>
                                    )}
                                </label>
                            ))}
                        </div>

                        {errors.script_style && (
                            <p className="text-rose-500 mt-3 flex items-center gap-2 justify-center">
                                <AlertCircle className="w-4 h-4" /> {errors.script_style}
                            </p>
                        )}

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={continueFromStyle}
                                className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold"
                            >
                                Continue <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </section>
                )}

                {/* ===================== STEP 2: SPEAKERS ===================== */}
                {step === 2 && (
                    <section className="ui-card">
                        <h2 className="ui-card-title flex items-center gap-2 justify-center">
                            <Users className="w-4 h-4" /> Speakers
                        </h2>

                        {/* Count pills */}
                        {scriptStyle && (
                            <div className="flex items-center gap-2 flex-wrap mt-3 justify-center">
                                {allowedCounts.map((n) => (
                                    <button
                                        key={n}
                                        onClick={() => setSpeakersCount(n)}
                                        className={`px-4 py-2 text-sm font-semibold rounded-xl transition border ${speakersCount === n
                                            ? "bg-purple-600 text-white border-purple-600"
                                            : "bg-black/5 dark:bg-white/5 border-neutral-300 dark:border-neutral-800 text-black/70 dark:text-white/70 hover:bg-black/10"
                                            }`}
                                    >
                                        {n} {n === 1 ? "Speaker" : "Speakers"}
                                    </button>
                                ))}
                                {scriptStyle === "Interview" && speakersCount === 2 && (
                                    <button
                                        onClick={() => setSpeakersCount(3)}
                                        className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-xl border border-neutral-300 dark:border-neutral-800 hover:bg-black/5 dark:hover:bg-white/5"
                                    >
                                        <Plus className="w-4 h-4" /> Add 3rd (2H+1G)
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Speaker cards grid — centered for 1/2/3 */}
                        {speakers.length > 0 && (
                            <div
                                className={`mt-5 grid gap-5 ${speakers.length === 1
                                    ? "grid-cols-1 max-w-md"
                                    : speakers.length === 2
                                        ? "grid-cols-1 md:grid-cols-2 max-w-4xl"
                                        : "grid-cols-1 md:grid-cols-3 max-w-5xl"
                                    } mx-auto`}
                            >
                                {speakers.map((sp, i) => (
                                    <div
                                        key={i}
                                        className="rounded-xl border border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 w-full"
                                    >
                                        <h3 className="text-sm font-bold text-black/80 dark:text-white/80">
                                            Speaker {i + 1}
                                        </h3>
                                        <div className="mt-3 space-y-3">
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
                                                    placeholder={`Speaker ${i + 1} name`}
                                                    className={`form-input ${errors.speaker_names && !sp.name.trim()
                                                        ? "border-rose-400"
                                                        : ""
                                                        }`}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
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
                                                <div>
                                                    <label className="form-label">Role</label>
                                                    <select
                                                        value={sp.role}
                                                        disabled={!showRoleSelect}
                                                        onChange={(e) =>
                                                            setSpeakers((arr) => {
                                                                const n = [...arr];
                                                                n[i] = { ...n[i], role: e.target.value };
                                                                return n;
                                                            })
                                                        }
                                                        className={`form-input ${!showRoleSelect
                                                            ? "opacity-60 cursor-not-allowed"
                                                            : ""
                                                            }`}
                                                    >
                                                        <option value="host">Host</option>
                                                        <option value="guest">Guest</option>
                                                    </select>
                                                    {scriptStyle === "Conversational" && (
                                                        <p className="form-help">
                                                            Conversational uses hosts only.
                                                        </p>
                                                    )}
                                                    {scriptStyle === "Interview" && (
                                                        <p className="form-help">
                                                            Interview roles are fixed by layout.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 🔊 Voice selection */}
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
                                                ) : (
                                                    (() => {
                                                        // Decide which pool to use based on the speaker's gender
                                                        const genderKey =
                                                            (sp.gender || "").toLowerCase() === "female" ? "female" : "male";

                                                        // Prefer same-gender voices; if none, fall back to all voices
                                                        const pool =
                                                            voiceGroups[genderKey].length ? voiceGroups[genderKey] : voices;

                                                        const currentId = sp.voiceId || pool[0]?.id || "";

                                                        return (
                                                            <div className="flex items-center gap-3">
                                                                <select
                                                                    value={currentId}
                                                                    onChange={(e) =>
                                                                        setSpeakers((arr) => {
                                                                            const n = [...arr];
                                                                            n[i] = { ...n[i], voiceId: e.target.value };
                                                                            return n;
                                                                        })
                                                                    }
                                                                    className="form-input flex-1"
                                                                >
                                                                    {pool.map((v) => (
                                                                        <option key={v.id} value={v.id}>
                                                                            {v.name}
                                                                        </option>
                                                                    ))}
                                                                </select>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const selected =
                                                                            pool.find((v) => v.id === currentId) || pool[0];
                                                                        if (selected?.preview_url) {
                                                                            const audio = new Audio(selected.preview_url);
                                                                            audio.play().catch((err) =>
                                                                                console.error("Preview failed", err)
                                                                            );
                                                                        } else {
                                                                            alert("No preview available for this voice.");
                                                                        }
                                                                    }}
                                                                    className="inline-flex items-center justify-center gap-2 px-5 h-[44px]
           rounded-xl border border-purple-500 text-purple-600 font-semibold
           hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                                                                >
                                                                    <Play className="w-4 h-4" />
                                                                    Preview
                                                                </button>
                                                            </div>
                                                        );
                                                    })()
                                                )}

                                                <p className="form-help text-xs mt-1">
                                                    This voice will be used when generating audio for this speaker.
                                                </p>
                                            </div>

                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* errors & actions */}
                        {(errors.speaker_names || errors.speakers) && (
                            <p className="text-rose-500 mt-4 text-center flex items-center gap-2 justify-center">
                                <AlertCircle className="w-4 h-4" />
                                {errors.speaker_names || errors.speakers}
                            </p>
                        )}

                        <div className="mt-6 flex justify-between">
                            <button
                                onClick={() => setStep(1)}
                                className="px-4 py-2 border rounded-xl"
                            >
                                Back
                            </button>
                            <button
                                onClick={onContinueFromSpeakers}
                                className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold"
                            >
                                Continue <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </section>
                )}

                {/* ===================== STEP 3: TEXT ===================== */}
                {step === 3 && (
                    <section className="ui-card">
                        <h2 className="ui-card-title flex items-center gap-2">
                            <NotebookPen className="w-4 h-4" /> Your Text
                        </h2>

                        <textarea
                            id="wecast_textarea"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Paste your text here (max 2500 words)…"
                            className="form-textarea mt-3"
                        />
                        <div className="mt-2 text-sm flex justify-between">
                            <span
                                className={`${description.trim().split(/\s+/).filter(Boolean).length < MIN
                                    ? "text-rose-500"
                                    : "text-purple-500"
                                    }`}
                            >
                                {description.trim().split(/\s+/).filter(Boolean).length} / {MAX}{" "}
                                words
                            </span>
                            {errors.description && (
                                <span className="text-rose-500">{errors.description}</span>
                            )}
                        </div>

                        {errors.server && (
                            <p className="text-rose-600 mt-3 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {errors.server}
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
                                className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold"
                            >
                                {submitting ? (
                                    "Please wait…"
                                ) : (
                                    <>
                                        Start Generating <Wand2 className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </div>
                    </section>
                )}
            </main>

            {/* overlays */}
            <LoadingOverlay show={submitting} />
            <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
    );
}
