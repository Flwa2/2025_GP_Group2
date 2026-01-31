import React, { useEffect, useMemo, useRef, useState } from "react";
import WeCastAudioPlayer from "./WeCastAudioPlayer";

const API_BASE = import.meta.env.PROD
  ? "https://wecast.onrender.com"
  : "http://localhost:5000";

export default function Preview() {
  const [audioUrl, setAudioUrl] = useState("");
  const [words, setWords] = useState([]);
  const [title, setTitle] = useState("Podcast Episode");
  const [t, setT] = useState(0);

  const transcriptRef = useRef(null);
  const activeWordRef = useRef(null);

  // user scroll control
  const [userInteracting, setUserInteracting] = useState(false);
  const interactionTimerRef = useRef(null);

  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const episodeId = params.get("id");

  const [externalSeek, setExternalSeek] = useState(null); // NEW

  useEffect(() => {
    const saved = sessionStorage.getItem("wecast_preview");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p?.url) setAudioUrl(p.url);
        if (Array.isArray(p?.words)) setWords(p.words);
        if (p?.title) setTitle(p.title);
      } catch {}
    }

    if (!saved) {
      fetch(`${API_BASE}/api/audio/last`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => d?.url && setAudioUrl(d.url))
        .catch(() => {});
      fetch(`${API_BASE}/api/transcript/last`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => Array.isArray(d?.words) && setWords(d.words))
        .catch(() => {});
    }
  }, []);

  const activeIndex = useMemo(() => {
    if (!words.length) return -1;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (t >= w.start && t < w.end) return i;
    }
    return -1;
  }, [t, words]);

  // Auto-scroll ONLY when user not interacting
  useEffect(() => {
    if (activeIndex < 0) return;
    if (userInteracting) return;
    if (!activeWordRef.current) return;

    activeWordRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, [activeIndex, userInteracting]);

  const markUserInteraction = () => {
    setUserInteracting(true);
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);

    interactionTimerRef.current = setTimeout(() => {
      setUserInteracting(false);
    }, 5000);
  };

  const handleWordClick = (sec) => { // NEW
    setUserInteracting(false);       // resume auto-follow
    setExternalSeek(sec);            // tell player to jump
  };

  return (
    <div className="min-h-screen bg-cream dark:bg-[#0a0a1a] text-black dark:text-white px-6 py-10 transition-colors duration-500">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">Podcast Episode</h1>
            <p className="text-sm text-black/60 dark:text-white/60">
              Audio · Live Transcript · Summary
            </p>
          </div>

          <button
            onClick={() => {
              sessionStorage.setItem("forceStep", "6");
              window.location.hash = "#/create";
            }}
            className="px-4 py-2 rounded-xl border border-black/10 dark:border-white/10
             hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            Back
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="relative -mt-3 scale-[0.97] origin-top-left">
              <WeCastAudioPlayer
                src={audioUrl}
                title={title}
                onTimeUpdate={(sec) => setT(sec)}
                externalSeek={externalSeek} 
              />
            </div>

            <div className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 p-4 shadow-md min-h-[180px]">
              <div className="text-sm font-bold mb-2">Summary</div>
              <div className="text-sm text-black/60 dark:text-white/60 leading-relaxed">
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold">Live transcript</div>
                <div className="text-xs text-black/50 dark:text-white/50">
                  {userInteracting ? "Manual scroll" : "Auto follow"}
                </div>
              </div>

              <div
                ref={transcriptRef}
                onWheel={markUserInteraction}
                onTouchStart={markUserInteraction}
                onTouchMove={markUserInteraction}
                onMouseDown={markUserInteraction}
                className="h-[680px] lg:h-[720px] overflow-y-auto pr-3 leading-8 text-[15px]"
              >
                <div className="flex flex-wrap gap-x-1 gap-y-2">
                  {words.map((w, i) => {
                    const active = i === activeIndex;
                    return (
                      <span
                        key={`${i}-${w.start}`}
                        ref={active ? activeWordRef : null}
                        onClick={() => handleWordClick(w.start)} 
                        title={`Jump to ${w.start.toFixed(2)}s`}  
                        className={[
                          "cursor-pointer rounded px-1.5 py-0.5 transition-all duration-150",
                          active
                            ? "bg-yellow-300 text-black"
                            : "hover:bg-black/5 dark:hover:bg-white/10",
                        ].join(" ")}
                      >
                        {w.w}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
