// src/components/EditScript.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";

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
              Saving your script…
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Your changes are being saved. Please wait a moment.
            </p>
          </div>
        </div>
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div className="h-full w-1/3 animate-[shimmer_1.2s_ease_infinite] bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400" />
        </div>
      </div>

      <style>
        {`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}
      </style>
    </div>
  );
}

/* -------------------- stepper components -------------------- */
function StepDot({ n, label, active = false, done = false }) {
    const state = active ? "active" : done ? "done" : "pending";
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
}

const StepLine = ({ on }) => (
    <div className={`h-[3px] flex-1 rounded-full ${on ? "bg-gradient-to-r from-purple-600 to-pink-500" : "bg-black/10 dark:bg-white/10"}`} />
);

// ----------------------------------------------------------------------------------------

export default function EditScript() {
  const [script, setScript] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("Not saved yet");
  const [loadingDraft, setLoadingDraft] = useState(true);

  const lastValidRef = useRef("");
  const textareaRef = useRef(null);

  useEffect(() => {
    fetch("/api/draft", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const initial = (d.script || "").trim();
        setScript(initial);
        lastValidRef.current = initial || "";
      })
      .finally(() => setLoadingDraft(false));
  }, []);

// Add this useEffect in EditScript.jsx to save the edit data
useEffect(() => {
  // Save edit data when component mounts for navigation back
  const editData = JSON.parse(sessionStorage.getItem('editData') || '{}');
  sessionStorage.setItem('editScriptStyle', editData.scriptStyle || '');
  sessionStorage.setItem('editSpeakersCount', editData.speakersCount || '');
  sessionStorage.setItem('editSpeakers', JSON.stringify(editData.speakers || []));
  sessionStorage.setItem('editDescription', editData.description || '');
}, []);

  const speakerLabels = useMemo(() => {
    const labels = new Set();
    (script || "").split(/\r?\n/).forEach((ln) => {
      const i = ln.indexOf(":");
      if (i > 0) labels.add(ln.slice(0, i).trim());
    });
    return Array.from(labels);
  }, [script]);

  const getLineMeta = (value, pos) => {
    const lineStart = value.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
    const nextNl = value.indexOf("\n", pos);
    const lineEnd = nextNl === -1 ? value.length : nextNl;
    const colonIdx = value.indexOf(":", lineStart);
    return { lineStart, lineEnd, colonIdx };
  };

  const onKeyDownGuard = (e) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const val = ta.value;
    const { selectionStart: start, selectionEnd: end } = ta;

    const affects =
      e.key.length === 1 ||
      e.key === "Backspace" ||
      e.key === "Delete" ||
      e.key === "Enter" ||
      e.key === "Tab";
    if (!affects) return;

    const { lineStart, colonIdx } = getLineMeta(val, start);
    if (colonIdx !== -1) {
      const labelEnd = colonIdx + 1; // includes colon
      const touchesLabel = start <= labelEnd || end <= labelEnd;
      if (touchesLabel) {
        e.preventDefault();
        const safe =
          val[colonIdx + 1] === " " ? colonIdx + 2 : colonIdx + 1;
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = Math.max(safe, start, end);
        });
      }
    }
  };

  const onChangeSafe = (e) => {
    const next = e.target.value;
    if (next.trim() === "") {
      setScript(lastValidRef.current);
      setSaveMsg("You can't clear the entire script.");
      return;
    }
    setScript(next);
    lastValidRef.current = next;
  };

  const save = async () => {
    const content = script.trim();
    if (!content) {
      setSaveMsg("Script is empty.");
      return;
    }
    setSaving(true);
    setSaveMsg("Saving…");
    try {
      const r = await fetch("/api/edit/save", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edited_script: content }),
      });
      if (!r.ok) throw new Error();
      setSaveMsg("Last saved: " + new Date().toLocaleTimeString());
    } catch {
      setSaveMsg("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const navigateToAudio = async () => {
  // Save the script first
  const content = script.trim();
  if (content) {
    setSaving(true);
    try {
      await fetch("/api/edit/save", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edited_script: content }),
      });
    } catch (error) {
      console.error("Failed to save script:", error);
    } finally {
      setSaving(false);
    }
  }
  
  // Store data and force step 3 (Review step)
  const editData = JSON.parse(sessionStorage.getItem('editData') || '{}');
  const updatedEditData = {
    ...editData,
    generatedScript: content, // Save the edited script
    fromEdit: true
  };
  
  sessionStorage.setItem('editData', JSON.stringify(updatedEditData));
  sessionStorage.setItem('forceStep', '3'); // Force step 3 (Review), not 4
  
  // Navigate to CreatePro
  window.location.hash = "#/create";
};

  return (
    <div className="min-h-screen bg-cream dark:bg-[#0a0a0a]">
      <div className="h-2 bg-purple-gradient" />

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Title */}
        <header className="mb-6 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold text-black dark:text-white">
            Edit Your Podcast Script
          </h1>
          <p className="mt-2 text-black/70 dark:text-white/70">
            Keep speaker labels; edit only the wording after each colon.
          </p>
        </header>

        {/* Stepper - matches CreatePro.jsx */}
        <div className="max-w-3xl mx-auto rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 p-4 mb-8">
          <div className="flex items-center gap-4">
            <StepDot n={1} label="Style" done />
            <StepLine on={true} />
            <StepDot n={2} label="Speakers" done />
            <StepLine on={true} />
            <StepDot n={3} label="Edit" active />
            <StepLine on={false} />
            <StepDot n={4} label="Audio" />
          </div>
        </div>

        {/* guidelines */}
        <section className="ui-card">
          <h2 className="ui-card-title">Editing Guidelines</h2>
          <ul className="list-disc pl-6 space-y-1 text-sm text-black/80 dark:text-white/80">
            <li><strong>Do not edit speaker names</strong> (left of the colon). They are locked.</li>
            <li>Edit <em>only</em> the content after the colon on each line.</li>
            <li>Do not clear the entire script.</li>
            {speakerLabels.length > 0 && (
              <li>
                Detected labels:&nbsp;
                <span className="inline-flex flex-wrap gap-2">
                  {speakerLabels.map((s) => (
                    <code key={s} className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5">
                      {s}:
                    </code>
                  ))}
                </span>
              </li>
            )}
          </ul>
        </section>

        {/* editor */}
        <div className="ui-card mt-6">
          <h2 className="ui-card-title">Your Script</h2>

          {loadingDraft ? (
            <div className="text-sm opacity-80">Loading draft…</div>
          ) : (
            <>
              <label htmlFor="scriptArea" className="form-label">
                Edit lines below
              </label>
              <textarea
                id="scriptArea"
                ref={textareaRef}
                className="form-textarea"
                style={{ minHeight: "52vh", lineHeight: 1.55 }}
                value={script}
                onChange={onChangeSafe}
                onKeyDown={onKeyDownGuard}
                placeholder="Host: …"
              />

              {/* actions row */}
              <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
<button
  onClick={() => {
    // Store the current script and mark that we're coming from edit
    const editData = JSON.parse(sessionStorage.getItem('editData') || '{}');
    const updatedEditData = {
      ...editData,
      generatedScript: script, // Save the current edited script
      fromEdit: true // Flag to indicate we're coming from edit
    };
    sessionStorage.setItem('editData', JSON.stringify(updatedEditData));
    sessionStorage.setItem('forceStep', '3'); // Force step 3
    window.location.hash = "#/create";
  }}
  className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"
>
  Back to Review
</button>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="px-5 py-2 border border-neutral-300 dark:border-neutral-700 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save Script"}
                  </button>

                  <button
                    onClick={navigateToAudio}
                    className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold"
                  >
                    Review your script after editing <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-2 text-sm text-black/70 dark:text-white/70">{saveMsg}</div>

        
            </>
          )}
        </div>
      </main>
    </div>
  );
}
