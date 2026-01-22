import React, { useState } from "react";
import { Play, Pause, RotateCcw, RotateCw, Download } from "lucide-react";

export default function WeCastAudioPlayer({ src, title = "Generated Audio", onTimeUpdate }) {
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
    if (isPlaying) el.pause();
    else {
      el.playbackRate = speed;
      el.play().catch(() => {});
    }
  };

  const skipSeconds = (delta) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const nextTime = Math.min(Math.max(el.currentTime + delta, 0), duration);
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
    setProgress((nextTime / duration) * 100);
    onTimeUpdate?.(nextTime);
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
    onTimeUpdate?.(nextTime);
  };

  const handleDownload = async () => {
    if (!src) return;
    try {
      const res = await fetch(src, { credentials: "include" });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (title || "Podcast Episode") + ".mp3";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div className="w-full rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 px-5 py-4 shadow-md flex flex-col gap-3">
      <audio
        ref={audioRef}
        src={src}
        className="hidden"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.target.duration || 0)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(duration);
          setProgress(100);
          onTimeUpdate?.(duration);
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

      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl hover:brightness-110 active:scale-95 transition"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>

        <div className="flex-1 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-black/80 dark:text-white">
              {title}
            </span>
            <span className="text-xs text-black/60 dark:text-white/60">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-black/5 dark:bg-white/5 px-2 py-1">
              <span className="text-[0.7rem] uppercase tracking-wide text-black/50 dark:text-white/50 mr-1">
                Speed
              </span>
              {SPEED_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => applySpeed(opt)}
                  className={`px-2 py-0.5 rounded-full text-[0.7rem] font-semibold border transition ${
                    speed === opt
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-transparent text-black/70 dark:text-white/70 border-transparent hover:bg-black/10 dark:hover:bg-white/10"
                  }`}
                >
                  {opt}×
                </button>
              ))}
            </div>

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

      <div
        className="mt-1 h-2 w-full rounded-full bg-black/5 dark:bg-white/10 overflow-hidden cursor-pointer"
        onClick={handleBarClick}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>

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
