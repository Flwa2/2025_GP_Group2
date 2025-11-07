import React, { useMemo, useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";

export default function Create() {
  // ───────── State
  const [step, setStep] = useState(1);
  const [scriptStyle, setScriptStyle] = useState("");
  const [speakersCount, setSpeakersCount] = useState("");
  const [speakers, setSpeakers] = useState([]); // [{name, gender, role}]
  const [description, setDescription] = useState("");

  const [errors, setErrors] = useState({});
  const [styleMessage, setStyleMessage] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ───────── Constants
  const MIN = 500;
  const MAX = 2500;
  const styleLimits = {
    Interview: [2, 3],
    Storytelling: [1, 2, 3],
    Educational: [1, 2, 3],
    Conversational: [2, 3],
  };

  const STYLE_GUIDELINES = {
    Interview: {
      desc: (
        <>
          <strong>Tone:</strong> Professional, journalistic, engaging.
          <br />
          <strong>Flow:</strong> Q&amp;A — host(s) ask thoughtful questions; guest answers with insights and short stories.
          <br />
          <strong>Goal:</strong> Inform and connect through authentic dialogue.
        </>
      ),
    },
    Storytelling: {
      desc: (
        <>
          <strong>Tone:</strong> Cinematic and narrative.
          <br />
          <strong>Flow:</strong> Story told through voices; host introduces and guides, storyteller(s) bring scenes to life.
          <br />
          <strong>Goal:</strong> Immerse the listener and paint visuals through voice.
        </>
      ),
    },
    Educational: {
      desc: (
        <>
          <strong>Tone:</strong> Clear, structured, friendly.
          <br />
          <strong>Flow:</strong> Host explains; guest(s) ask clarifying questions or add expertise.
          <br />
          <strong>Goal:</strong> Help listeners learn with bite-sized, organized sections.
        </>
      ),
    },
    Conversational: {
      desc: (
        <>
          <strong>Tone:</strong> Relaxed, natural, often funny.
          <br />
          <strong>Flow:</strong> Co-hosts react, riff, and share stories together.
          <br />
          <strong>Goal:</strong> Make the audience feel part of a real conversation.
        </>
      ),
    },
  };

  // ───────── Helpers
  const countWords = (str) => (str || "").trim().split(/\s+/).filter(Boolean).length;
  const hasValidName = (str) => {
    const s = (str || "").trim();
    return /^[\p{L}]+(?:\s+[\p{L}]+)*$/u.test(s);
  };
  const normalize = (str) => (str || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();

  const roleGuidance = (style) => {
    const roles = speakers.map((s) => s.role);
    const hosts = roles.filter((r) => r === "host").length;
    const guests = roles.filter((r) => r === "guest").length;
    const defaults = {
      Interview:
        "Host leads with questions; guest provides stories and insights.",
      Storytelling:
        "Guests are the storytellers; host guides, reacts, and frames transitions.",
      Educational:
        "Host teaches; guest(s) ask clarifying questions or add expert notes.",
      Conversational: "All participants are hosts; it’s a balanced back-and-forth.",
    };
    if (!roles.length) return defaults[style] || "";

    if (style === "Interview") {
      if (speakersCount === 2 && hosts === 1 && guests === 1)
        return "The host interviews; the guest answers with insights and short stories.";
      if (speakersCount === 3 && hosts === 2 && guests === 1)
        return "Two hosts co-interview the guest, alternating questions and reactions.";
      return "Interview supports either 2 speakers (1 host + 1 guest) or 3 speakers (2 hosts + 1 guest).";
    }
    if (style === "Storytelling") {
      if (speakersCount === 1 && hosts === 1 && guests === 0)
        return "The host is the storyteller, carrying the narrative from start to finish.";
      if (speakersCount === 2 && hosts === 1 && guests === 1)
        return "The guest is the main storyteller; the host guides, reacts, and bridges scenes.";
      if (speakersCount === 3 && hosts === 1 && guests === 2)
        return "Both guests tell the story in parts; the host guides, reacts, and ties it together.";
      return defaults[style];
    }
    if (style === "Educational") {
      if (speakersCount === 1 && hosts === 1 && guests === 0)
        return "The host teaches the topic with a clear, structured flow.";
      if (hosts === 1 && guests >= 1)
        return "The host explains; guest(s) ask questions and add examples to reinforce learning.";
      return defaults[style];
    }
    if (style === "Conversational") {
      if (guests === 0) return "Co-hosts share opinions, react, and keep the pace natural and fun.";
      return "Conversational works best with co-hosts only; avoid guests here.";
    }
    return defaults[style] || "";
  };

  const styleHint = useMemo(() => {
    if (!scriptStyle) return null;
    const validText = {
      Interview: "Valid setups: 1 host → 1 guest, or 2 hosts → 1 guest.",
      Storytelling: "Valid setups: 1 host solo, 1 host → 1 guest, or 1 host → 2 guests.",
      Educational: "Valid setups: 1 host solo, 1 host → 1 guest, or 1 host → 2 guests.",
      Conversational: "Valid setups: Multiple hosts, no guests.",
    }[scriptStyle];
    return (
      <div className="text-emerald-400/90 leading-6">
        <div>{STYLE_GUIDELINES[scriptStyle]?.desc}</div>
        <div className="mt-2">
          <strong>Roles:</strong> {roleGuidance(scriptStyle)}
        </div>
        <div className="mt-1 opacity-90">{validText}</div>
      </div>
    );
  }, [scriptStyle, speakersCount, speakers]);

  // ───────── Build speaker cards when style & count selected
  useEffect(() => {
    setErrors((e) => ({ ...e, speaker_names: undefined }));
    if (!scriptStyle || !speakersCount) {
      setSpeakers([]);
      return;
    }
    const validCounts = styleLimits[scriptStyle] || [];
    if (!validCounts.includes(Number(speakersCount))) return;
    setSpeakers((prev) => {
      const base = Array.from({ length: Number(speakersCount) }).map((_, i) =>
        prev[i] || { name: "", gender: "Male", role: "host" }
      );
      return base;
    });
  }, [scriptStyle, speakersCount]);

  // ───────── Validation
  const validateStep1 = () => {
    const errs = {};
    if (!scriptStyle) {
      errs.script_style = "Please select a podcast style.";
    }
    const count = Number(speakersCount);
    const validCounts = styleLimits[scriptStyle] || [];
    if (!validCounts.includes(count)) {
      if (scriptStyle === "Interview")
        errs.speakers = "Interview requires either 2 speakers (1 host + 1 guest) or 3 speakers (2 hosts + 1 guest).";
      else if (scriptStyle === "Conversational")
        errs.speakers = "Conversational uses 2 or 3 co-hosts (no guests).";
      else errs.speakers = "Choose 1, 2, or 3 speakers for this style.";
    }
    // Names letters + spaces and unique
    const names = speakers.map((s) => s.name);
    for (let i = 0; i < names.length; i++) {
      if (!hasValidName(names[i])) {
        errs.speaker_names =
          "Each speaker name must use letters and spaces only (no numbers or symbols).";
        break;
      }
    }
    if (!errs.speaker_names) {
      const keys = names.map(normalize);
      const seen = new Map();
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (seen.has(k)) {
          errs.speaker_names = "Speaker names must be unique within the podcast.";
          break;
        }
        seen.set(k, i);
      }
    }

    // Roles layout rules per style
    if (!errs.speakers && speakers.length) {
      const roles = speakers.map((s) => s.role);
      const hosts = roles.filter((r) => r === "host").length;
      const guests = roles.filter((r) => r === "guest").length;
      if (scriptStyle === "Interview") {
        const ok = (count === 2 && hosts === 1 && guests === 1) || (count === 3 && hosts === 2 && guests === 1);
        if (!ok)
          errs.speakers =
            "Interview requires: 2 speakers = 1 host + 1 guest, or 3 speakers = 2 hosts + 1 guest.";
      }
      if (scriptStyle === "Storytelling" || scriptStyle === "Educational") {
        const ok =
          (count === 1 && hosts === 1 && guests === 0) ||
          (count === 2 && hosts === 1 && guests === 1) ||
          (count === 3 && hosts === 1 && guests === 2);
        if (!ok)
          errs.speakers = `${scriptStyle} requires: 1 speaker = 1 host; 2 speakers = 1 host + 1 guest; 3 speakers = 1 host + 2 guests.`;
      }
      if (scriptStyle === "Conversational") {
        const ok = (count === 2 && hosts === 2 && guests === 0) || (count === 3 && hosts === 3 && guests === 0);
        if (!ok) errs.speakers = "Conversational requires only co-hosts: 2 hosts or 3 hosts (no guests).";
      }
    }

    setErrors(errs);
    setStyleMessage("");
    return Object.keys(errs).length === 0;
  };

  const validateBeforeGenerate = () => {
    const n = countWords(description);
    const errs = {};
    if (n < MIN) errs.description = `Your text must be at least ${MIN} words. Current length: ${n}.`;
    if (n > MAX) errs.description = `The text exceeds the ${MAX}-word limit. Current length: ${n}.`;
    setErrors((e) => ({ ...e, ...errs }));
    return Object.keys(errs).length === 0;
  };

  // ───────── Submit
  const submitUrl = "/create"; // Flask route you already use (e.g., url_for('create_page'))
  const handleConfirmGenerate = async () => {
    setShowConfirm(false);
    setSubmitting(true);
    try {
      const payload = {
        script_style: scriptStyle,
        speakers: Number(speakersCount),
        speakers_info: speakers,
        description,
      };
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Flask can return { errors: {...} } on 400
        const data = await res.json().catch(() => ({}));
        setErrors(data.errors || { server: "Failed to generate. Please try again." });
        setSubmitting(false);
        if (data.errors?.description) setStep(2);
        return;
      }
      const data = await res.json();
      // Expect backend returns { redirect: "/script-edit/123" } or similar
      if (data.redirect) {
        window.location.href = data.redirect;
      } else {
        setSubmitting(false);
        setErrors({ server: "No redirect received from server." });
      }
    } catch (e) {
      setSubmitting(false);
      setErrors({ server: "Network error. Check backend is running." });
    }
  };

  // ───────── UI atoms
  const SectionLabel = ({ htmlFor, children }) => (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-black dark:text-slate-100 mb-1">
      {children}
    </label>
  );

  const Select = (props) => (
    <select
      {...props}
      className={
        "w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 text-black dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      }
    />
  );

  const Input = (props) => (
    <input
      {...props}
      className={
        "w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 text-black dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      }
    />
  );

  const TextArea = (props) => (
    <textarea
      {...props}
      className={
        "w-full min-h-[220px] rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 text-black dark:text-slate-100 px-4 py-3 leading-7 focus:outline-none focus:ring-2 focus:ring-emerald-400"
      }
    />
  );

  const ErrorMsg = ({ children }) => (
    <p className="mt-1 text-sm font-medium text-rose-500">{children}</p>
  );

  const HintBox = ({ children }) => (
    <div className="mt-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
      {children}
    </div>
  );

  // ───────── Render
  return (
    <div className="min-h-screen bg-cream dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="bg-cream dark:bg-[#0a0a0a] w-full">
       
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-24">
        <h1 className="text-3xl md:text-4xl font-extrabold mt-8 text-black dark:text-white">
          Create Your Podcast Script
        </h1>

        {/* Wizard */}
        <div className="mt-6 flex items-center gap-3 select-none">
          <WizardDot active={step === 1} done={step > 1}>1</WizardDot>
          <WizardLine on={step >= 2} />
          <WizardDot active={step === 2} done={false}>2</WizardDot>
          <WizardLine on={false} />
          <WizardDot active={false} done={false}>3</WizardDot>
        </div>
        <div className="mt-2 flex items-center gap-10 text-xs uppercase tracking-wider text-black/70 dark:text-white/60">
          <span>Settings</span>
          <span className="ml-[34px]">Text</span>
          <span className="ml-[34px]">Edit</span>
        </div>

        {/* Card */}
        <div className="mt-6 rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl p-6">
          {step === 1 ? (
            <section>
              {/* Style */}
              <SectionLabel htmlFor="script_style">Podcast Style</SectionLabel>
              <Select
                id="script_style"
                value={scriptStyle}
                onChange={(e) => {
                  setScriptStyle(e.target.value);
                  setSpeakersCount("");
                  setSpeakers([]);
                }}
              >
                <option value="">Select style</option>
                <option value="Interview">Interview</option>
                <option value="Storytelling">Storytelling</option>
                <option value="Educational">Educational</option>
                <option value="Conversational">Conversational</option>
              </Select>
              {errors.script_style && <ErrorMsg>{errors.script_style}</ErrorMsg>}

              {styleHint && <HintBox>{styleHint}</HintBox>}

              {/* Speakers count */}
              <div className="mt-5">
                <SectionLabel htmlFor="speakers">Number of Speakers</SectionLabel>
                <Select
                  id="speakers"
                  value={speakersCount}
                  onChange={(e) => setSpeakersCount(Number(e.target.value))}
                >
                  <option value="">Select</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                </Select>
                {errors.speakers && <ErrorMsg>{errors.speakers}</ErrorMsg>}
              </div>

              {/* Speakers grid */}
              {speakers.length > 0 && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {speakers.map((sp, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-800 p-4"
                    >
                      <h3 className="text-sm font-bold tracking-wide text-black/80 dark:text-white/80">
                        Speaker {i + 1}
                      </h3>
                      <div className="mt-3 space-y-3">
                        <div>
                          <SectionLabel>Name</SectionLabel>
                          <Input
                            value={sp.name}
                            placeholder={`Speaker ${i + 1} name`}
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
                          />
                        </div>
                        <div>
                          <SectionLabel>Gender</SectionLabel>
                          <Select
                            value={sp.gender}
                            onChange={(e) =>
                              setSpeakers((arr) => {
                                const next = [...arr];
                                next[i] = { ...next[i], gender: e.target.value };
                                return next;
                              })
                            }
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </Select>
                        </div>
                        <div>
                          <SectionLabel>Role</SectionLabel>
                          <Select
                            value={sp.role}
                            onChange={(e) =>
                              setSpeakers((arr) => {
                                const next = [...arr];
                                next[i] = { ...next[i], role: e.target.value };
                                return next;
                              })
                            }
                          >
                            <option value="host">Host</option>
                            <option value="guest">Guest</option>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {errors.speaker_names && <ErrorMsg>{errors.speaker_names}</ErrorMsg>}

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-500 text-slate-900 font-bold px-5 py-3 shadow hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  onClick={() => {
                    if (validateStep1()) setStep(2);
                  }}
                >
                  Next
                </button>
              </div>
            </section>
          ) : (
            <section>
              <SectionLabel htmlFor="description">Your Text</SectionLabel>
              <TextArea
                id="description"
                value={description}
                onChange={(e) => {
                  setErrors((er) => ({ ...er, description: undefined }));
                  setDescription(e.target.value);
                }}
                placeholder="Paste your text here (max 2500 words)…"
              />
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className={
                  (countWords(description) < MIN || countWords(description) > MAX)
                    ? "text-rose-500"
                    : "text-emerald-500"
                }>
                  {countWords(description)} / {MAX} words
                </span>
                {errors.description && <ErrorMsg>{errors.description}</ErrorMsg>}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-black/10 dark:border-white/10 px-4 py-2 font-semibold text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (validateBeforeGenerate()) setShowConfirm(true);
                  }}
                  className="inline-flex items-center justify-center rounded-xl bg-black text-white font-bold px-5 py-3 shadow hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  Start Generating
                </button>
              </div>
            </section>
          )}
        </div>

        {errors.server && (
          <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-rose-300">
            {errors.server}
          </div>
        )}
      </main>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          />
          <div className="relative w-[92%] max-w-md rounded-2xl border border-emerald-400/30 bg-slate-800 text-slate-100 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <img src="/static/logo.png" alt="" className="h-8 w-8" />
              <h2 className="text-emerald-400 font-semibold">WeCast</h2>
            </div>
            <p className="mb-1">Are you sure you want to generate the script?</p>
            <p className="text-slate-400 text-xs">Tip: Longer text may take a few seconds.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-xl bg-slate-700 hover:bg-slate-600 px-4 py-2 font-semibold"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 px-4 py-2 font-bold"
                onClick={handleConfirmGenerate}
              >
                Yes, Generate
              </button>
            </div>
            <button
              className="absolute top-3 right-3 text-slate-400 hover:text-white"
              onClick={() => setShowConfirm(false)}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {submitting && (
        <div className="fixed inset-0 z-50 grid place-items-center">
          <div className="absolute inset-0 bg-black/65" />
          <div className="relative flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-slate-900/90 px-8 py-6 text-white">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm opacity-90">Generating your podcast…</p>
            <img src="/static/logo.png" alt="WeCast" className="h-8 w-8" />
          </div>
        </div>
      )}
    </div>
  );
}

function WizardDot({ active, done, children }) {
  const base = "h-8 w-8 rounded-full grid place-items-center text-xs font-bold border";
  const cls = active
    ? "bg-emerald-500 text-slate-900 border-emerald-400"
    : done
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
    : "bg-black/5 dark:bg-white/5 text-black/70 dark:text-white/60 border-black/10 dark:border-white/10";
  return <div className={`${base} ${cls}`}>{children}</div>;
}

function WizardLine({ on }) {
  return (
    <div
      className={`h-0.5 w-14 rounded-full ${on ? "bg-emerald-400" : "bg-black/10 dark:bg-white/10"}`}
    />
  );
}
