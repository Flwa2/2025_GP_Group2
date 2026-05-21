import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, RotateCw, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
export default function WeCastAudioPlayer({
  src,
  title = "Generated Audio",
  downloadUrl = "",
  onTimeUpdate,
  externalSeek, // NEW
  /** Polished surface for create-flow success card (light + dark tuned). */
  variant = "default",
}) {
  const audioRef = useRef(null);
  const lastSeekRef = useRef(null); // NEW
  const {t} = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loadError, setLoadError] = useState(false);

  const SPEED_OPTIONS = [1, 1.25, 1.5, 2];

  const getDownloadFileName = () => {
    const base =
      String(title || "Podcast Episode")
        .trim()
        .replace(/[^A-Za-z0-9._-]+/g, "-")
        .replace(/^[-.]+|[-.]+$/g, "") || "wecast-audio";
    return base.toLowerCase().endsWith(".mp3") ? base : `${base}.mp3`;
  };

  const triggerBrowserDownload = (url) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = getDownloadFileName();
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const formatTime = (sec) => {
    if (sec === 0) return "0:00";
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
    if (isPlaying) el.pause();
    else {
      if (loadError) {
        el.load();
        setLoadError(false);
      }
      el.playbackRate = speed;
      el.play().catch(() => {});
    }
  };

  const syncUi = (nextTime, nextDuration) => { // NEW helper
    const d = nextDuration || duration || 1;
    setCurrentTime(nextTime);
    setProgress((nextTime / d) * 100);
    onTimeUpdate?.(nextTime);
  };

  const seekTo = async (sec, { resumeIfPlaying = true } = {}) => { // NEW helper
    const el = audioRef.current;
    if (!el) return;

    const d = el.duration || duration || 0;
    const clamped = Math.min(Math.max(sec ?? 0, 0), d || sec || 0);

    const wasPlaying = !el.paused && !el.ended;

    el.currentTime = clamped;
    syncUi(clamped, el.duration || d || 1);

    if (resumeIfPlaying && wasPlaying) {
      el.playbackRate = speed;
      await el.play().catch(() => {});
    }
  };

  // NEW: react to externalSeek changes (clicking transcript word)
  useEffect(() => {
    if (externalSeek == null) return;

    // prevent repeated seeking to same value
    if (lastSeekRef.current === externalSeek) return;
    lastSeekRef.current = externalSeek;

    // Seek, and keep playing if it was already playing
    seekTo(externalSeek, { resumeIfPlaying: true });
  }, [externalSeek]); // eslint-disable-line react-hooks/exhaustive-deps

  const skipSeconds = (delta) => {
    const el = audioRef.current;
    if (!el) return;

    const d = el.duration || duration;
    if (!d) return;

    const nextTime = Math.min(Math.max(el.currentTime + delta, 0), d);
    el.currentTime = nextTime;
    syncUi(nextTime, d);
  };

  const handleBarClick = (e) => {
    const el = audioRef.current;
    const d = el?.duration || duration;
    if (!el || !d) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const nextTime = Math.min(Math.max(ratio * d, 0), d);

    el.currentTime = nextTime;
    syncUi(nextTime, d);
  };

  const handleDownload = async () => {
    const target = downloadUrl || src;
    if (!target) return;

    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
      const headers = downloadUrl && token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(target, {
        credentials: downloadUrl ? "include" : "omit",
        headers,
      });
      if (!res.ok) throw new Error("Download request failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      triggerBrowserDownload(url);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      triggerBrowserDownload(target);
    }
  };

  // NEW: reset when src changes
  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setCurrentTime(0);
    setLoadError(false);
    lastSeekRef.current = null;
  }, [src]);

  const shellClass =
    variant === "createSuccess"
      ? "flex w-full min-w-0 max-w-full flex-col gap-2.5 rounded-3xl border border-purple-100 bg-white px-3 py-3 shadow-sm shadow-purple-500/[0.07] ring-1 ring-purple-500/[0.04] dark:border-purple-500/25 dark:bg-neutral-900/70 dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] dark:ring-purple-400/10 sm:gap-3 sm:px-5 sm:py-4"
      : "flex w-full min-w-0 max-w-full flex-col gap-2.5 rounded-3xl border border-purple-200/90 bg-white/55 px-3 py-3 backdrop-blur-md dark:border-purple-400/30 dark:bg-neutral-900/60 sm:gap-3 sm:px-5 sm:py-4";

  const trackBg =
    variant === "createSuccess"
      ? "bg-purple-100/90 dark:bg-white/10"
      : "bg-black/5 dark:bg-white/10";

  const speedRailClass =
    variant === "createSuccess"
      ? "bg-purple-50 dark:bg-white/5"
      : "bg-black/5 dark:bg-white/5";

  return (
    <div className={shellClass}>
      <audio
        ref={audioRef}
        src={src}
        className="hidden"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => setLoadError(true)}
        onLoadedMetadata={(e) => {
          const d = e.target.duration || 0;
          setDuration(d);
          // keep speed applied after metadata is ready
          e.target.playbackRate = speed;
        }}
        onEnded={() => {
          setIsPlaying(false);
          const d = audioRef.current?.duration || duration;
          syncUi(d || 0, d || 1);
        }}
        onTimeUpdate={(e) => {
          const el = e.target;
          const t = el.currentTime;
          const d = el.duration || 1;
          setCurrentTime(t);
          setProgress((t / d) * 100);
          onTimeUpdate?.(t);
        }}
      />

      <div className="flex min-w-0 w-full items-start gap-2 sm:items-center sm:gap-4">
        <button
          onClick={togglePlay}
          disabled={!src}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg transition hover:brightness-110 hover:shadow-xl active:scale-95 sm:h-12 sm:w-12"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0 flex flex-col">
            <span className="line-clamp-2 text-sm font-semibold text-black/80 dark:text-white sm:line-clamp-none">
              {title}
            </span>
            <span className="mt-0.5 shrink-0 text-xs tabular-nums text-black/60 dark:text-white/60">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 sm:flex-nowrap sm:gap-3">
            <div
              className={`flex max-w-full flex-wrap items-center gap-0.5 rounded-full px-1.5 py-1 sm:gap-1 sm:px-2 ${speedRailClass}`}
            >
              <span className="px-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-black/50 dark:text-white/50 sm:mr-1 sm:text-[0.7rem]">
                {t("speed")}
              </span>
              {SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => applySpeed(opt)}
                  className={`rounded-full border px-1.5 py-0.5 text-[0.65rem] font-semibold transition sm:px-2 sm:text-[0.7rem] ${
                    speed === opt
                      ? "border-purple-600 bg-purple-600 text-white"
                      : "border-transparent bg-transparent text-black/70 hover:bg-black/10 dark:text-white/70 dark:hover:bg-white/10"
                  }`}
                >
                  {opt}×
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!src && !downloadUrl}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-black/70 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-white/70 dark:hover:bg-white/10"
              title="Download audio"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        className={`mt-0.5 h-2 w-full min-w-0 max-w-full cursor-pointer overflow-hidden rounded-full sm:mt-1 ${trackBg}`}
        onClick={handleBarClick}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-1.5 flex w-full min-w-0 flex-wrap items-center justify-center gap-2 sm:mt-1 sm:gap-4">
        <button
          type="button"
          onClick={() => skipSeconds(-10)}
          className="inline-flex min-w-0 items-center gap-1 rounded-full border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-black/70 transition hover:bg-black/5 dark:border-neutral-700 dark:text-white/70 dark:hover:bg-white/10 sm:px-3"
        >
          <RotateCcw className="h-4 w-4 shrink-0" />
          <span>-10s</span>
        </button>
        <button
          type="button"
          onClick={() => skipSeconds(10)}
          className="inline-flex min-w-0 items-center gap-1 rounded-full border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-black/70 transition hover:bg-black/5 dark:border-neutral-700 dark:text-white/70 dark:hover:bg-white/10 sm:px-3"
        >
          <RotateCw className="h-4 w-4 shrink-0" />
          <span>+10s</span>
        </button>
      </div>
    </div>
  );
}
