import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Mic2 } from "lucide-react";
import WeCastAudioPlayer from "./WeCastAudioPlayer";

function formatMMSS(sec) {
  if (!Number.isFinite(sec)) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const isLikelyArabic = (text = "") => /[\u0600-\u06FF]/.test(text);

/**
 * Shared Episode Preview layout (authenticated preview + public share).
 */
export default function EpisodePreviewView({
  t,
  i18n,
  displayTitle,
  titleMeta = "",
  titleDir = "ltr",
  resolvedCoverSrc = "",
  onCoverError,
  audioUrl = "",
  downloadUrl = "",
  words = [],
  chapters = [],
  summary = "",
  isGeneratingSummary = false,
  podcastLanguage = "",
  onBack,
  headerTitle,
  headerSubtitle,
  footerActions = null,
  useDashboardGlassTone = true,
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [externalSeek, setExternalSeek] = useState(null);
  const [isChaptersOpen, setIsChaptersOpen] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [userInteracting, setUserInteracting] = useState(false);

  const transcriptRef = useRef(null);
  const activeWordRef = useRef(null);
  const interactionTimerRef = useRef(null);

  const dashboardShellClass =
    "w-full min-w-0 max-w-full border-b border-black/10 bg-white/70 dark:bg-neutral-900/45 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-sm";
  const dashboardContentClass =
    "flex w-full min-w-0 max-w-none flex-1 flex-col px-0 pt-0 pb-8 sm:pb-10";
  const previewTitleCardClass =
    "max-w-full min-w-0 overflow-hidden rounded-[28px] border border-purple-300/40 bg-white/78 shadow-[0_12px_36px_rgba(15,23,42,0.10)] backdrop-blur-md dark:border-[#6f5a86]/30 dark:bg-neutral-900/42";
  const previewCardClass =
    "rounded-3xl border border-purple-300/40 dark:border-purple-400/30 bg-white/55 dark:bg-neutral-900/60 backdrop-blur-md shadow-sm";
  const previewPageGlassShellClass = [
    "flex w-full min-w-0 max-w-none flex-1 flex-col border-y border-white/30 bg-[rgba(255,255,255,0.7)] shadow-[0_14px_50px_-18px_rgba(15,23,42,0.1)] backdrop-blur-[14px]",
    useDashboardGlassTone
      ? "dark:border-white/10 dark:bg-neutral-900/45 dark:shadow-[0_8px_36px_rgba(0,0,0,0.42)] dark:backdrop-blur-xl"
      : "dark:border-transparent dark:bg-transparent dark:shadow-none dark:backdrop-blur-none",
  ].join(" ");
  const previewPageInnerClass =
    "mx-auto flex w-full min-w-0 max-w-[1400px] flex-1 flex-col space-y-6 px-5 pt-4 pb-6 sm:px-8 sm:pt-5 sm:pb-8 lg:px-10 lg:pt-6 lg:pb-10";

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
      const speaker = typeof w.speaker === "string" ? w.speaker.trim() : "";

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
    <div
      className={[
        "flex min-h-0 w-full min-w-0 flex-1 flex-col",
        useDashboardGlassTone ? dashboardShellClass : "",
      ].join(" ")}
    >
      <div
        className={
          useDashboardGlassTone
            ? dashboardContentClass
            : "flex w-full min-w-0 flex-1 flex-col px-0 py-0"
        }
      >
        <div className={previewPageGlassShellClass}>
          <div className={previewPageInnerClass}>
            <div className="w-full min-w-0 max-w-7xl space-y-1">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                {onBack ? (
                  <button
                    type="button"
                    onClick={onBack}
                    className="rounded-lg p-2 transition hover:bg-black/5 dark:hover:bg-white/10"
                    aria-label={t("preview.back")}
                    title={t("preview.back")}
                  >
                    <ChevronLeft
                      className={`h-5 w-5 ${i18n.language === "ar" ? "rotate-180" : ""}`}
                    />
                  </button>
                ) : null}
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-bold [overflow-wrap:anywhere] text-black dark:text-white">
                    {headerTitle}
                  </h1>
                  {headerSubtitle ? (
                    <p className="text-sm text-black/60 [overflow-wrap:anywhere] dark:text-white/60">
                      {headerSubtitle}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className={previewTitleCardClass}>
              {resolvedCoverSrc ? (
                <div className="flex min-w-0 flex-row items-stretch bg-white dark:bg-neutral-950 sm:items-start md:items-stretch">
                  <div className="relative flex w-24 shrink-0 items-stretch justify-start self-stretch overflow-hidden border-r border-black/10 bg-neutral-100/30 p-0 dark:border-white/10 dark:bg-neutral-900/40 max-sm:rounded-s-[28px] max-[360px]:w-20 sm:h-auto sm:rounded-none sm:w-[7.5rem] sm:bg-white sm:p-2 md:h-auto md:w-24 md:rounded-none md:bg-white md:p-0 dark:sm:bg-neutral-950 dark:md:bg-neutral-950">
                    <img
                      src={resolvedCoverSrc}
                      alt={`${displayTitle} cover`}
                      className={[
                        "block h-full w-full min-h-0 min-w-0",
                        "object-cover object-center",
                        "sm:object-contain sm:object-left",
                        "md:object-cover md:object-center",
                      ].join(" ")}
                      onError={onCoverError}
                    />
                  </div>

                  <div className="flex min-w-0 flex-1 items-start bg-[linear-gradient(115deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.95)_48%,rgba(250,246,253,0.92)_76%,rgba(241,234,247,0.74)_100%)] p-4 max-sm:px-3 max-sm:py-3 sm:items-center sm:p-5 md:min-h-24 md:py-3 dark:bg-[linear-gradient(115deg,rgba(23,23,26,0.92)_0%,rgba(23,23,26,0.9)_46%,rgba(40,32,52,0.82)_76%,rgba(72,57,95,0.58)_100%)]">
                    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-wider text-black/55 dark:text-white/55">
                          {t("preview.titleLabel")}
                        </p>
                        <h2
                          dir={titleDir}
                          className="mt-1.5 max-w-4xl break-words text-xl font-semibold leading-tight text-black dark:text-white"
                        >
                          {displayTitle}
                        </h2>
                      </div>
                      {titleMeta ? (
                        <div className="flex w-full min-w-0 items-center sm:w-auto sm:justify-end">
                          <span className="inline-flex max-w-full min-w-0 items-center rounded-full border border-black/5 bg-white/75 px-3 py-2 text-sm text-black/60 [overflow-wrap:anywhere] dark:border-white/10 dark:bg-white/10 dark:text-white/60 sm:px-4">
                            {titleMeta}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[linear-gradient(115deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.95)_48%,rgba(250,246,253,0.92)_76%,rgba(241,234,247,0.74)_100%)] p-4 sm:p-6 dark:bg-[linear-gradient(115deg,rgba(23,23,26,0.92)_0%,rgba(23,23,26,0.9)_46%,rgba(40,32,52,0.82)_76%,rgba(72,57,95,0.58)_100%)]">
                  <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/70 dark:border-white/10 dark:bg-purple-900/30">
                      <Mic2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-wider text-black/55 dark:text-white/55">
                        {t("preview.titleLabel")}
                      </p>
                      <h2
                        dir={titleDir}
                        className="mt-1.5 max-w-4xl break-words text-xl font-semibold leading-tight text-black dark:text-white"
                      >
                        {displayTitle}
                      </h2>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="preview-layout-grid grid w-full min-w-0 max-w-full grid-cols-1 items-start gap-6 lg:grid-cols-12">
              <div className="flex min-w-0 max-w-full flex-col gap-4 lg:col-span-7">
                <div className={`${previewCardClass} relative w-full min-w-0 max-w-full overflow-hidden p-3 sm:p-4`}>
                  <WeCastAudioPlayer
                    src={audioUrl}
                    title={displayTitle}
                    downloadUrl={downloadUrl}
                    onTimeUpdate={(sec) => setCurrentTime(sec)}
                    externalSeek={externalSeek}
                  />
                </div>

                <div className={`${previewCardClass} min-h-[260px] w-full min-w-0 max-w-full p-5`}>
                  <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
                    <div className="min-w-0 text-sm font-bold [overflow-wrap:anywhere]">
                      {t("preview.liveTranscript")}
                    </div>
                    <div className="shrink-0 text-xs text-black/50 dark:text-white/50">
                      {userInteracting ? t("preview.manualScroll") : t("preview.autoFollow")}
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
                      "preview-transcript-scroll min-w-0 max-w-full overflow-y-auto overflow-x-hidden text-[15px] leading-8 [overflow-wrap:anywhere]",
                      transcriptDir === "rtl" ? "pl-2 text-right sm:pl-3" : "pr-2 text-left sm:pr-3",
                    ].join(" ")}
                  >
                    <div
                      dir={transcriptDir}
                      className="min-w-0 max-w-full text-[15px] leading-8 [overflow-wrap:anywhere]"
                    >
                      {transcriptTokens.map((tok) => {
                        if (tok.type === "speaker") {
                          return (
                            <React.Fragment key={tok.key}>
                              <br />
                              <button
                                type="button"
                                onClick={() => handleWordClick(tok.start)}
                                className={[
                                  "font-extrabold text-black/80 hover:underline dark:text-white/80",
                                  transcriptDir === "rtl" ? "ml-2" : "mr-2",
                                ].join(" ")}
                                title={t("preview.jumpToTime", { time: formatMMSS(tok.start) })}
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
                            title={t("preview.jumpToSeconds", { seconds: w.start.toFixed(2) })}
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
                    <p className="mt-3 text-xs text-black/50 dark:text-white/40">
                      {t("preview.noSpeakers")}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex min-w-0 max-w-full flex-col gap-4 lg:col-span-5">
                <div className={`${previewCardClass} max-w-full min-w-0 overflow-hidden`}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsChaptersOpen((v) => {
                        const next = !v;
                        if (next) setIsSummaryOpen(false);
                        return next;
                      });
                    }}
                    className="flex w-full min-w-0 items-center justify-between gap-2 px-4 py-3.5 text-sm font-bold sm:px-5 sm:py-4"
                  >
                    <span className="min-w-0 [overflow-wrap:anywhere]">{t("preview.chapters")}</span>
                    <span className="text-black/50 dark:text-white/50">v</span>
                  </button>
                  {isChaptersOpen ? (
                    <div className="border-t border-black/5 px-4 pb-4 dark:border-white/10 sm:px-5 sm:pb-5">
                      {!chapters || chapters.length === 0 ? (
                        <p className="text-sm italic text-black/60 dark:text-white/60">
                          {t("preview.noChapters")}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {chapters.map((c, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setExternalSeek(c.startSec)}
                              className={[
                                "w-full min-w-0 max-w-full rounded-xl px-2 py-2 transition hover:bg-black/5 dark:hover:bg-white/10 sm:px-3",
                                i18n.language === "ar" ? "text-right" : "text-left",
                              ].join(" ")}
                            >
                              <div className="flex min-w-0 items-center justify-between gap-2">
                                <span className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">
                                  {c.title}
                                </span>
                                <span className="shrink-0 tabular-nums text-xs text-black/50 dark:text-white/50">
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

                <div className={`${previewCardClass} max-w-full min-w-0 overflow-hidden`}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSummaryOpen((v) => {
                        const next = !v;
                        if (next) setIsChaptersOpen(false);
                        return next;
                      });
                    }}
                    className={[
                      "flex w-full min-w-0 items-center justify-between gap-2 px-4 text-sm font-bold sm:px-5",
                      isSummaryOpen ? "py-2.5 sm:py-3" : "py-3.5 sm:py-4",
                    ].join(" ")}
                  >
                    <span className="min-w-0 [overflow-wrap:anywhere]">{t("preview.summary")}</span>
                    <span className="text-black/50 dark:text-white/50">v</span>
                  </button>
                  {isSummaryOpen ? (
                    <div className="border-t border-black/5 px-4 pb-4 pt-0 text-sm leading-relaxed text-black/60 [overflow-wrap:anywhere] dark:border-white/10 dark:text-white/60 sm:px-5 sm:pb-5">
                      {isGeneratingSummary ? (
                        <div className="flex items-center space-x-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                          <span className="text-gray-500">{t("preview.creatingSummary")}</span>
                        </div>
                      ) : summary ? (
                        <>
                          <p>{summary}</p>
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {summary.split(/\s+/).length} {t("preview.words")}
                          </p>
                        </>
                      ) : (
                        <p className="italic text-gray-500">{t("preview.summaryPending")}</p>
                      )}
                      {isGeneratingSummary ? (
                        <div className="mt-2 animate-pulse text-xs text-blue-500">
                          {t("preview.generatingSummary")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {footerActions ? (
              <div className="flex w-full min-w-0 flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
                {footerActions}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}


