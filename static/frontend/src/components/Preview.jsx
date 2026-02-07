import React, { useEffect, useMemo, useRef, useState } from "react";
import WeCastAudioPlayer from "./WeCastAudioPlayer";

const API_BASE = import.meta.env.PROD
  ? "https://wecast.onrender.com"
  : "http://localhost:5000";

// OpenAI API configuration
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || "gpt-3.5-turbo";

// Helper function to generate summary using OpenAI API
const generateSummary = async (words, podcastId) => {
  if (!words || words.length === 0) return "";

  // Extract the full transcript text
  const transcript = words.map(w => w.w).join(" ");

  // If transcript is too short, use simple summary
  if (transcript.split(/\s+/).length < 50) {
    return transcript.substring(0, 500) + "...";
  }

  try {
    const response = await fetch(`${API_BASE}/api/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: transcript, podcastId }),
    credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.summary || "";

  } catch (error) {
    console.error("Failed to generate AI summary:", error);

    // Fallback to simple summary if API fails
    return generateSimpleSummary(words);
  }
};

// Fallback simple summary function
const generateSimpleSummary = (words) => {
  if (!words || words.length === 0) return "";

  const transcript = words.map(w => w.w).join(" ");
  const sentences = transcript.split(/[.!?]+/);
  let summarySentences = [];
  let wordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).length;
    if (wordCount + sentenceWords <= 250) {
      summarySentences.push(sentence.trim() + ".");
      wordCount += sentenceWords;
    } else {
      break;
    }
  }

  if (summarySentences.length === 0 && sentences.length > 0) {
    summarySentences = [sentences[0].substring(0, 250) + "..."];
  }

  let summary = summarySentences.join(" ");
  const summaryWords = summary.split(/\s+/);
  if (summaryWords.length > 250) {
    summary = summaryWords.slice(0, 250).join(" ") + "...";
  }

  return summary;
};

export default function Preview() {
  const [audioUrl, setAudioUrl] = useState("");
  const [words, setWords] = useState([]);
  const [title, setTitle] = useState("Podcast Episode");
  const [t, setT] = useState(0);
  const [summary, setSummary] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const transcriptRef = useRef(null);
  const activeWordRef = useRef(null);

  // user scroll control
  const [userInteracting, setUserInteracting] = useState(false);
  const interactionTimerRef = useRef(null);

  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const episodeId = params.get("id");
  const [externalSeek, setExternalSeek] = useState(null);


  useEffect(() => {
    const saved = sessionStorage.getItem("wecast_preview");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p?.url) setAudioUrl(p.url);
        if (Array.isArray(p?.words)) {
        setWords(p.words);
        }
        if (p?.title) setTitle(p.title);
        if (p?.summary) setSummary(p.summary);
      } catch { }
    }

    if (!saved) {
      fetch(`${API_BASE}/api/audio/last`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => d?.url && setAudioUrl(d.url))
        .catch(() => { });

      fetch(`${API_BASE}/api/transcript/last`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d?.words)) {
           setWords(d.words);
          }
        })
        .catch(() => { });
    }
  }, []);

  useEffect(() => {
  if (!episodeId) return;
  if (!words || words.length === 0) return;

  const loadOrGenerate = async () => {
    try {
      setIsGeneratingSummary(true);

      // 1) fetch saved summary from Firestore (backend)
      const res = await fetch(`${API_BASE}/api/podcasts/${episodeId}`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        const savedSummary = data?.podcast?.summary;
        if (savedSummary) {
          setSummary(savedSummary);
          setIsGeneratingSummary(false);
          return; // ✅ don't regenerate
        }
      }

      // 2) not saved -> generate ONCE (backend will save it)
      const newSummary = await generateSummary(words, episodeId);
      setSummary(newSummary);

      // keep it in sessionStorage too
      try {
        const saved = sessionStorage.getItem("wecast_preview");
        if (saved) {
          const p = JSON.parse(saved);
          p.summary = newSummary;
          sessionStorage.setItem("wecast_preview", JSON.stringify(p));
        }
      } catch {}

    } catch (e) {
      console.error("Summary load/generate failed:", e);
      setSummary(generateSimpleSummary(words));
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  loadOrGenerate();
}, [episodeId, words]);


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

  const handleWordClick = (sec) => {
    setUserInteracting(false);
    setExternalSeek(sec);
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
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-bold">Summary</div>
                {isGeneratingSummary && (
                  <div className="text-xs text-blue-500 animate-pulse">
                    Generating AI summary...
                  </div>
                )}
              </div>
              <div className="text-sm text-black/60 dark:text-white/60 leading-relaxed">
                {isGeneratingSummary ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-gray-500">Creating AI-powered summary...</span>
                  </div>
                ) : summary ? (
                  <>
                    <p>{summary}</p>
                    <p className="text-xs mt-2 text-gray-500 dark:text-gray-400">
                      {summary.split(/\s+/).length} words
                    </p>
                  </>
                ) : (
                  <p className="italic text-gray-500">
                    Summary will be generated once the transcript is available...
                  </p>
                )}
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
