import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import WeCastAudioPlayer from "./WeCastAudioPlayer";

const API_BASE = import.meta.env.PROD
  ? "https://wecast.onrender.com"
  : "http://localhost:5000";

function formatMMSS(sec) {
  if (!Number.isFinite(sec)) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const isLikelyArabic = (text = "") => /[\u0600-\u06FF]/.test(text);

export default function Share() {
  const { t, i18n } = useTranslation();

  const [audioUrl, setAudioUrl] = useState("");
  const [words, setWords] = useState([]);
  const [title, setTitle] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [summary, setSummary] = useState("");
  const [chapters, setChapters] = useState([]);
  const [isChaptersOpen, setIsChaptersOpen] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [transcriptCardHeight, setTranscriptCardHeight] = useState(null);
  const [transcriptBodyHeight, setTranscriptBodyHeight] = useState(null);
  const [podcastLanguage, setPodcastLanguage] = useState("");
  const [coverB64, setCoverB64] = useState(null);
  const [coverMime, setCoverMime] = useState("image/jpeg");
  const [error, setError] = useState("");
  const [externalSeek, setExternalSeek] = useState(null);

  const coverSrc = useMemo(() => {
    if (!coverB64) return null;
    return `data:${coverMime};base64,${coverB64}`;
  }, [coverB64, coverMime]);

  const transcriptRef = useRef(null);
  const activeWordRef = useRef(null);
  const audioCardRef = useRef(null);
  const rightColRef = useRef(null);
  const transcriptCardRef = useRef(null);
  const transcriptHeaderRef = useRef(null);
  const transcriptFooterRef = useRef(null);

  const [userInteracting, setUserInteracting] = useState(false);
  const interactionTimerRef = useRef(null);

  const podcastId = window.location.hash.split("/share/")[1] || "";

const dashboardShellClass = "w-full";
const dashboardContentClass =
  "max-w-[1400px] mx-auto px-4 py-8 space-y-6 sm:px-6 sm:py-10";
  const dashboardCardClass =
    "rounded-3xl border border-purple-200/90 dark:border-purple-400/30 bg-white/55 dark:bg-neutral-900/60 backdrop-blur-md shadow-sm";
  const previewCardClass = dashboardCardClass;

  useEffect(() => {
    if (!podcastId) {
      setError("Missing podcast ID");
      return;
    }

    const loadSharedPodcast = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/share/${podcastId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load shared podcast");
        }

        setTitle(data.title || "");
        setAudioUrl(data.audioUrl || "");
        setSummary(data.summary || "");
        setChapters(Array.isArray(data.chapters) ? data.chapters : []);
        setWords(Array.isArray(data.words) ? data.words : []);
        setCoverB64(data.cover || null);
        setCoverMime("image/jpeg");
        setPodcastLanguage(data.language || "");
      } catch (err) {
        console.error("Share page error:", err);
        setError(err.message || "Something went wrong");
      }
    };

    loadSharedPodcast();
  }, [podcastId]);

  const activeIndex = useMemo(() => {
    if (!words.length) return -1;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (currentTime >= w.start && currentTime < w.end) return i;
    }
    return -1;
  }, [currentTime, words]);

  const transcriptText = useMemo(
    () => words.map((w) => String(w?.w || "")).join(" "),
    [words]
  );

  const transcriptDir = useMemo(() => {
    if (isLikelyArabic(transcriptText)) return "rtl";
    if (podcastLanguage === "ar") return "rtl";
    return "ltr";
  }, [transcriptText, podcastLanguage]);

  const hasSpeakerInfo = useMemo(
    () => words.some((w) => typeof w.speaker === "string" && w.speaker.trim()),
    [words]
  );

  const transcriptTokens = useMemo(() => {
    if (!words.length) return [];
    const tokens = [];
    let lastSpeaker = null;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const speaker =
        typeof w.speaker === "string" ? w.speaker.trim() : "";

      if (speaker && speaker !== lastSpeaker) {
        tokens.push({
          type: "speaker",
          speaker,
          start: w.start,
          key: `sp-${i}-${w.start}`,
        });
        lastSpeaker = speaker;
      }

      tokens.push({
        type: "word",
        word: w,
        index: i,
        key: `w-${i}-${w.start}`,
      });
    }

    return tokens;
  }, [words]);

  useEffect(() => {
    if (activeIndex < 0) return;
    if (userInteracting) return;
    if (!activeWordRef.current) return;
    if (!transcriptRef.current) return;

    const container = transcriptRef.current;
    const target = activeWordRef.current;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const above = targetRect.top < containerRect.top + 20;
    const below = targetRect.bottom > containerRect.bottom - 20;

    if (above || below) {
      const offset =
        target.offsetTop - container.offsetTop - container.clientHeight / 2;
      container.scrollTo({
        top: Math.max(0, offset),
        behavior: "smooth",
      });
    }
  }, [activeIndex, userInteracting]);

  useEffect(() => {
    const rightEl = rightColRef.current;
    const audioEl = audioCardRef.current;
    const headerEl = transcriptHeaderRef.current;
    const footerEl = transcriptFooterRef.current;

    if (!rightEl || !audioEl || !headerEl) return;

    const gap = 16;
    const minCard = 260;

    const update = () => {
      const rightH = rightEl.offsetHeight || 0;
      const audioH = audioEl.offsetHeight || 0;
      const headerH = headerEl.offsetHeight || 0;
      const footerH = footerEl ? footerEl.offsetHeight || 0 : 0;

      let target = rightH - audioH - gap;
      if (!Number.isFinite(target) || target <= 0) return;
      if (target < minCard) target = minCard;

      const bodyTarget = Math.max(80, target - headerH - footerH - 40);

      setTranscriptCardHeight(target);
      setTranscriptBodyHeight(bodyTarget);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(rightEl);
    ro.observe(audioEl);
    ro.observe(headerEl);
    if (footerEl) ro.observe(footerEl);
    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [isChaptersOpen, isSummaryOpen, summary, chapters]);

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

  const handleBack = () => {
    window.location.hash = "#/";
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center text-red-500 bg-cream dark:bg-[#0a0a1a]">
        {error}
      </div>
    );
  }

  return (
    <div
      className={[
        "min-h-screen bg-cream dark:bg-[#0a0a1a] text-black dark:text-white transition-colors duration-500",
        i18n.language === "ar" ? "text-right" : "text-left",
      ].join(" ")}
    >
      <div className={dashboardShellClass}>
        <div className={dashboardContentClass}>
          <div>
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex items-start gap-3 sm:items-center sm:gap-4">
                <button
                  onClick={handleBack}
                  className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition"
                  aria-label={t("preview.back")}
                  title={t("preview.back")}
                >
                  <ChevronLeft
                    className={`w-5 h-5 ${
                      i18n.language === "ar" ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {coverSrc ? (
                  <img
                    src={coverSrc}
                    alt="Cover"
                    className="w-16 h-16 rounded-2xl object-cover border border-black/10"
                  />
                ) : null}

                <div className="min-w-0">
                  <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">
                    {title || "Untitled Podcast"}
                  </h1>
                  <p className="text-sm text-black/60 dark:text-white/60">
                    Shared podcast
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-4">
              <div ref={audioCardRef} className="relative -mt-3 w-full">
                <WeCastAudioPlayer
                  src={audioUrl}
                  title={title || "Untitled Podcast"}
                  onTimeUpdate={(sec) => setCurrentTime(sec)}
                  externalSeek={externalSeek}
                />
              </div>

              <div
                ref={transcriptCardRef}
                className={`${previewCardClass} p-5 w-full min-h-[260px]`}
                style={
                  transcriptCardHeight
                    ? { minHeight: transcriptCardHeight }
                    : undefined
                }
              >
                <div
                  ref={transcriptHeaderRef}
                  className="flex items-center justify-between mb-3"
                >
                  <div className="text-sm font-bold">
                    {t("preview.liveTranscript")}
                  </div>
                  <div className="text-xs text-black/50 dark:text-white/50">
                    {userInteracting
                      ? t("preview.manualScroll")
                      : t("preview.autoFollow")}
                  </div>
                </div>

                <div
                  ref={transcriptRef}
                  dir={transcriptDir}
                  onWheel={markUserInteraction}
                  onTouchStart={markUserInteraction}
                  onTouchMove={markUserInteraction}
                  onMouseDown={markUserInteraction}
                  className={[
                    "overflow-y-auto leading-8 text-[15px]",
                    transcriptDir === "rtl"
                      ? "pl-3 text-right"
                      : "pr-3 text-left",
                  ].join(" ")}
                  style={
                    transcriptBodyHeight
                      ? { height: transcriptBodyHeight }
                      : undefined
                  }
                >
                  <div dir={transcriptDir} className="leading-8 text-[15px]">
                    {transcriptTokens.map((tok) => {
                      if (tok.type === "speaker") {
                        return (
                          <React.Fragment key={tok.key}>
                            <br />
                            <button
                              onClick={() => handleWordClick(tok.start)}
                              className={[
                                "font-extrabold text-black/80 dark:text-white/80 hover:underline",
                                transcriptDir === "rtl" ? "ml-2" : "mr-2",
                              ].join(" ")}
                              title={t("preview.jumpToTime", {
                                time: formatMMSS(tok.start),
                              })}
                            >
                              {tok.speaker}:
                            </button>
                          </React.Fragment>
                        );
                      }

                      const w = tok.word;
                      const active = tok.index === activeIndex;

                      return (
                        <span
                          key={tok.key}
                          ref={active ? activeWordRef : null}
                          onClick={() => handleWordClick(w.start)}
                          title={t("preview.jumpToSeconds", {
                            seconds: w.start.toFixed(2),
                          })}
                          className={[
                            "cursor-pointer rounded px-1.5 py-0.5 transition-all duration-150",
                            active
                              ? "bg-yellow-300 text-black"
                              : "hover:bg-black/5 dark:hover:bg-white/10",
                          ].join(" ")}
                        >
                          {w.w}{" "}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {!hasSpeakerInfo && words.length > 0 ? (
                  <p
                    ref={transcriptFooterRef}
                    className="text-xs mt-3 text-black/50 dark:text-white/40"
                  >
                    {t("preview.noSpeakers")}
                  </p>
                ) : null}
              </div>
            </div>

            <div ref={rightColRef} className="lg:col-span-5 w-full">
              <div className="w-full lg:sticky lg:top-24 lg:-mt-3 space-y-4">
                <div className={`${previewCardClass} overflow-hidden`}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsChaptersOpen((v) => {
                        const next = !v;
                        if (next) setIsSummaryOpen(false);
                        return next;
                      });
                    }}
                    className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold"
                  >
                    <span>{t("preview.chapters")}</span>
                    <span className="text-black/50 dark:text-white/50">v</span>
                  </button>
                  {isChaptersOpen ? (
                    <div className="px-5 pb-5 border-t border-black/5 dark:border-white/10">
                      {!chapters || chapters.length === 0 ? (
                        <p className="text-sm text-black/60 dark:text-white/60 italic">
                          {t("preview.noChapters")}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {chapters.map((c, idx) => (
                            <button
                              key={idx}
                              onClick={() => setExternalSeek(c.startSec)}
                              className={[
                                "w-full px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition",
                                i18n.language === "ar"
                                  ? "text-right"
                                  : "text-left",
                              ].join(" ")}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{c.title}</span>
                                <span className="text-xs text-black/50 dark:text-white/50">
                                  {formatMMSS(c.startSec)}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className={`${previewCardClass} overflow-hidden`}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSummaryOpen((v) => {
                        const next = !v;
                        if (next) setIsChaptersOpen(false);
                        return next;
                      });
                    }}
                    className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold"
                  >
                    <span>{t("preview.summary")}</span>
                    <span className="text-black/50 dark:text-white/50">v</span>
                  </button>
                  {isSummaryOpen ? (
                    <div className="px-5 pb-5 text-sm text-black/60 dark:text-white/60 leading-relaxed border-t border-black/5 dark:border-white/10">
                      {summary ? (
                        <>
                          <p>{summary}</p>
                          <p className="text-xs mt-2 text-gray-500 dark:text-gray-400">
                            {summary.split(/\s+/).length} {t("preview.words")}
                          </p>
                        </>
                      ) : (
                        <p className="italic text-gray-500">
                          {t("preview.summaryPending")}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}