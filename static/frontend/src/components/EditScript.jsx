// src/components/EditScript.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

const API = "http://localhost:5000";

function Step({ num, label, done, active }) {
  const dotBase =
    "w-8 h-8 grid place-items-center rounded-full text-xs font-bold";
  const dot = active
    ? "bg-purple-600 text-white"
    : done
    ? "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
    : "bg-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500";
  const text = active ? "text-purple-600" : "text-black/60 dark:text-white/60";
  return (
    <div className="flex items-center gap-2">
      <div className={`${dotBase} ${dot}`}>{num}</div>
      <span className={`text-sm font-semibold ${text}`}>{label}</span>
    </div>
  );
}
const Line = () => <div className="h-[2px] w-16 bg-black/10 dark:bg-white/20" />;

export default function EditScript() {
  const [script, setScript] = useState("");
  const [saving, setSaving] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState("Not saved yet");
  const [audioUrl, setAudioUrl] = useState("");
  const [loadingDraft, setLoadingDraft] = useState(true);

  const lastValidRef = useRef("");
  const textareaRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/api/draft`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const initial = (d.script || "").trim();
        setScript(initial);
        lastValidRef.current = initial || "";
      })
      .finally(() => setLoadingDraft(false));
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
      const r = await fetch(`${API}/api/edit/save`, {
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

  const genAudio = async () => {
    const content = script.trim();
    if (!content) return alert("Script is empty.");
    setAudioLoading(true);
    setAudioUrl("");
    try {
      const r = await fetch(`${API}/api/audio`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptText: content }),
      });
      const data = await r.json();
      if (data.url) {
        setAudioUrl(data.url + "?t=" + Date.now());
      } else {
        alert(data.error || "Unknown error");
      }
    } catch {
      alert("Error generating audio.");
    } finally {
      setAudioLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream dark:bg-[#0a0a0a] text-black dark:text-white">
      <div className="h-1 bg-purple-gradient" />

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* centered header */}
        <header className="text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold">
            Edit Your Podcast Script
          </h1>
          <p className="mt-1 text-black/70 dark:text-white/70">
            Keep speaker labels; edit only the wording after each colon.
          </p>
          <div className="mt-5 inline-flex items-center gap-6 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 px-5 py-3">
            <Step num={1} label="Style" done />
            <Line />
            <Step num={2} label="Text" done />
            <Line />
            <Step num={3} label="Edit" active />
          </div>
        </header>

        {/* guidelines */}
        <section className="mt-8 ui-card">
          <div className="ui-card-title">Editing Guidelines</div>
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
          <div className="ui-card-title">Your Script</div>

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

              {/* actions row: back left, equal-sized buttons right */}
              <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                <a
                  href="#/create?step=2&restore=1"
                  className="px-4 py-2 border rounded-xl text-sm sm:text-base border-neutral-300 dark:border-neutral-800 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Back to Text
                </a>

                <div className="flex items-center gap-3">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="w-44 inline-flex justify-center items-center px-5 py-3 rounded-xl text-sm sm:text-base font-semibold
                               bg-black text-white dark:bg-white dark:text-black hover:opacity-90 disabled:opacity-60 transition"
                  >
                    {saving ? "Saving…" : "Save Script"}
                  </button>

                  <button
                    onClick={genAudio}
                    disabled={audioLoading}
                    className="w-44 inline-flex justify-center items-center px-5 py-3 rounded-xl text-sm sm:text-base font-semibold
                               bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 transition"
                  >
                    {audioLoading ? "Generating…" : "Generate Audio"}
                  </button>
                </div>
              </div>

              <div className="mt-2 text-sm opacity-80">{saveMsg}</div>

              {/* audio preview */}
              {audioUrl && (
                <div className="mt-5">
                  <h3 className="text-sm font-semibold mb-2">Preview</h3>
                  <audio controls className="w-full">
                    <source src={audioUrl} type="audio/mpeg" />
                  </audio>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
