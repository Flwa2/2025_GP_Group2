// src/components/EditScript.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, RotateCw, Download } from "lucide-react";

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
              Generating audio…
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Your audio is being generated. Please wait a few seconds.
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



function WeCastAudioPlayer({ src, title = "Generated Audio" }) {
  const audioRef = useRef(null);
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

  const handleDownload = () => {
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = (title || "wecast-episode") + ".mp3";
    document.body.appendChild(a);
    a.click();
    a.remove();
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



// ----------------------------------------------------------------------------------------

export default function EditScript() {
  const [script, setScript] = useState("");
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState("Not saved yet");
  const [audioUrl, setAudioUrl] = useState("");
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
        setTitle(d.title || "Generated Audio");

      })
      .finally(() => setLoadingDraft(false));
  }, []);

  useEffect(() => {
    // 🔁 restore last generated audio on refresh
    async function fetchLastAudio() {
      try {
        const res = await fetch("/api/audio/last", {
          credentials: "include",
        });
        const data = await res.json();
        if (data.url) {
          // optional cache buster so browser doesn’t reuse a very old file
          setAudioUrl(data.url + "?t=" + Date.now());
        }
      } catch (err) {
        console.error("Failed to restore last audio", err);
      }
    }

    fetchLastAudio();
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

  const genAudio = async () => {
    const content = script.trim();
    if (!content) return alert("Script is empty.");
    setAudioLoading(true);
    setAudioUrl("");
    try {
      const r = await fetch("/api/audio", {
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
                  <h3 className="text-sm font-semibold mb-2">Your Podcast Audio</h3>
                  <WeCastAudioPlayer src={audioUrl}
                    title={title || "Generated Audio"}  // 👈 here
                  />
                </div>
              )}

              <LoadingOverlay show={audioLoading} />

            </>
          )}
        </div>
      </main>
    </div>

  );
}
