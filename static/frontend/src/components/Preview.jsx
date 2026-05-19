// Preview.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Save } from "lucide-react";
import EpisodePreviewView from "./EpisodePreviewView";
import ViewportToast from "./ViewportToast";
import {
  clearPendingPreviewDraft,
  clearPendingPreviewSave,
  getPendingPreviewDraft,
  getPendingPreviewSave,
  queuePendingPreviewSave,
  storeAuthRedirectIntent,
  storePendingPreviewDraft,
} from "../utils/authRedirect";

const API_BASE = import.meta.env.PROD
  ? "https://wecast.onrender.com"
  : "http://localhost:5000";

const getPortalTarget = () => {
  if (typeof document === "undefined") return null;
  return document.body && document.body.nodeType === 1 ? document.body : null;
};

/* -----------------------------
   Summary helpers
------------------------------ */

const generateSimpleSummary = (words) => {
  if (!words || words.length === 0) return "";

  const transcript = words.map((w) => w.w).join(" ");
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

const isLikelyArabic = (text = "") => /[\u0600-\u06FF]/.test(text);

const generateSummary = async (words, podcastId, language, authHeaders = {}) => {
  if (!words || words.length === 0) return "";

  const transcript = words.map((w) => w.w).join(" ");

  if (transcript.split(/\s+/).length < 50) {
    return transcript.substring(0, 500) + "...";
  }

  try {
    const response = await fetch(`${API_BASE}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({
        text: transcript,
        podcastId,
        ...(language ? { language } : {}),
      }),
      credentials: "include",
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    return data.summary || "";
  } catch (error) {
    console.error("Failed to generate AI summary:", error);
    return generateSimpleSummary(words);
  }
};

/* -----------------------------
   Component
------------------------------ */

export default function Preview({ onTitleChange } = {}) {
  const { t, i18n } = useTranslation();
  const [audioUrl, setAudioUrl] = useState("");
  const [audioKey, setAudioKey] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverThumbB64, setCoverThumbB64] = useState("");
  const [coverImageFailed, setCoverImageFailed] = useState(false);
  const [words, setWords] = useState([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [chapters, setChapters] = useState([]);
  const [isChaptersOpen, setIsChaptersOpen] = useState(true);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [podcastLanguage, setPodcastLanguage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveMessageType, setSaveMessageType] = useState("info");
  const [category, setCategory] = useState("");
  const [seriesTitle, setSeriesTitle] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState(null);
  const [summaryLoadedFromDb, setSummaryLoadedFromDb] = useState(false);
  const [showSaveAuthModal, setShowSaveAuthModal] = useState(false);
  const authToken = localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  const authHeaders = useMemo(
    () => (authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    [authToken]
  );
  const isAuthenticated = !!authToken;
  const pendingSaveHandledRef = useRef(false);
  const previewNoticeKey = "wecast:previewSaveNotice";

  const chaptersRecoveryAttemptedRef = useRef(false);

  const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
  const episodeId = params.get("id");
  const fromSource = params.get("from") || sessionStorage.getItem("preview_from") || "";
  const isFromDashboardPreview = fromSource === "episodes";
  const isFromStudioCreatePreview = fromSource === "studio_create";
  const useDashboardGlassTone = isFromDashboardPreview || isFromStudioCreatePreview;
  const displayTitle = title || t("episodes.untitledEpisode");

  useEffect(() => {
    onTitleChange?.(title);
  }, [title, onTitleChange]);

  const resolvedCoverSrc = useMemo(() => {
    if (!coverImageFailed && coverUrl) return coverUrl;
    if (coverThumbB64) return `data:image/jpeg;base64,${coverThumbB64}`;
    return "";
  }, [coverImageFailed, coverThumbB64, coverUrl]);
  const titleDir = useMemo(() => {
    if (isLikelyArabic(displayTitle) || podcastLanguage === "ar") return "rtl";
    return "ltr";
  }, [displayTitle, podcastLanguage]);
  const titleMeta = useMemo(() => {
    if (category) return category;
    if (seriesTitle && episodeNumber) {
      return `${seriesTitle} · ${t("preview.episodeNumber", { number: episodeNumber })}`;
    }
    if (seriesTitle) return seriesTitle;
    if (episodeNumber) return t("preview.episodeNumber", { number: episodeNumber });
    return "";
  }, [category, episodeNumber, seriesTitle, t]);
  const hasPreviewContent = useMemo(
    () =>
      Boolean(
        audioUrl ||
          audioKey ||
          words.length ||
          title ||
          summary ||
          chapters.length
      ),
    [audioKey, audioUrl, chapters.length, summary, title, words.length]
  );
  const showPreviewSaveAction = !isAuthenticated && !isFromDashboardPreview && hasPreviewContent;

  const buildPreviewAuthHash = (route = "signup") => {
    const nextParams = new URLSearchParams();
    nextParams.set("redirect", "preview");
    if (episodeId) nextParams.set("id", episodeId);
    if (fromSource) nextParams.set("from", fromSource);
    return `#/${route}?${nextParams.toString()}`;
  };

  const queuePendingGuestSave = () => {
    queuePendingPreviewSave({
      id: episodeId || "",
      from: fromSource || "",
      requestedAt: Date.now(),
    });

    storeAuthRedirectIntent({
      redirect: "preview",
      id: episodeId || "",
      from: fromSource || "",
    });

    if (!episodeId && hasPreviewContent) {
      storePendingPreviewDraft({
        url: audioUrl,
        audioKey,
        words,
        title: displayTitle,
        summary,
        chapters,
        language: podcastLanguage,
        category,
      });
    }
  };

  const redirectForSaveAuth = (route = "signup") => {
    queuePendingGuestSave();
    setShowSaveAuthModal(false);
    window.location.hash = buildPreviewAuthHash(route);
  };

  // load initial preview data
  useEffect(() => {
    if (episodeId) return;

    let saved = sessionStorage.getItem("wecast_preview");
    if (!saved) {
      const backupDraft = getPendingPreviewDraft();
      if (backupDraft) {
        saved = JSON.stringify(backupDraft);
        sessionStorage.setItem("wecast_preview", saved);
      }
    }
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p?.url) setAudioUrl(p.url);
        if (p?.audioKey) setAudioKey(p.audioKey);
        if (Array.isArray(p?.words)) setWords(p.words);
        if (p?.title) setTitle(p.title);
        if (p?.summary) setSummary(p.summary);
        if (Array.isArray(p?.chapters)) setChapters(p.chapters);
        if (p?.language) setPodcastLanguage(p.language);
        if (p?.category) setCategory(p.category);
        if (p?.audioKey) {
          fetch(`${API_BASE}/api/audio/last`, { credentials: "include" })
            .then((r) => r.json())
            .then((d) => {
              if (d?.url) setAudioUrl(d.url);
              if (d?.audioKey) setAudioKey(d.audioKey);
            })
            .catch(() => {
              // Keep preview usable if the last-audio fallback is unavailable.
            });
        }
      } catch {
        // Ignore malformed draft data and continue with backend fallbacks.
      }
    }

    if (!saved) {
      fetch(`${API_BASE}/api/audio/last`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          if (d?.url) setAudioUrl(d.url);
          if (d?.audioKey) setAudioKey(d.audioKey);
        })
        .catch(() => {
          // Keep preview usable if the last-audio fallback is unavailable.
        });

      fetch(`${API_BASE}/api/transcript/last`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d?.words)) setWords(d.words);
        })
        .catch(() => {
          // Keep preview usable if the last-transcript fallback is unavailable.
        });
    }
  }, [episodeId]);

  useEffect(() => {
    const savedNotice = sessionStorage.getItem(previewNoticeKey);
    if (!savedNotice) return;
    try {
      const parsed = JSON.parse(savedNotice);
      if (parsed?.message) {
        setSaveMessage(parsed.message);
        setSaveMessageType(parsed.type || "success");
      }
    } catch {
      // Ignore malformed notification payloads.
    }
    sessionStorage.removeItem(previewNoticeKey);
  }, []);

  // load episode data by id
  useEffect(() => {
    if (!episodeId) return;
    let isMounted = true;

    setSummary("");
    setSummaryLoadedFromDb(false);
    setChapters([]);
    setWords([]);
    setAudioUrl("");
    setAudioKey("");
    setCoverUrl("");
    setCoverThumbB64("");
    setCoverImageFailed(false);
    setTitle("");
    setCategory("");
    setSeriesTitle("");
    setEpisodeNumber(null);
    chaptersRecoveryAttemptedRef.current = false;

    const encId = encodeURIComponent(episodeId);

    const loadEpisode = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/podcasts/${encId}`, {
          headers: authHeaders,
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;

        const podcast = data?.podcast || {};
        if (!isMounted) return;

        if (podcast.audioKey) {
          setAudioKey(podcast.audioKey);
        }
        setCoverImageFailed(false);
        setCoverUrl(podcast.coverUrl || "");
        setCoverThumbB64(podcast.coverThumbB64 || "");

        let restoredAudioUrl = "";
        if (podcast.audioKey) {
          const audioRes = await fetch(`${API_BASE}/api/audio/${encId}`, {
            headers: authHeaders,
            credentials: "include",
          });
          const audioData = await audioRes.json().catch(() => ({}));

          if (audioRes.ok && audioData?.url) {
            restoredAudioUrl = audioData.url;
          }
        }

        if (!restoredAudioUrl && podcast.audioUrl) {
          const baseUrl = podcast.audioUrl.startsWith("http")
            ? podcast.audioUrl
            : `${API_BASE}${podcast.audioUrl}`;
          restoredAudioUrl = baseUrl;
        }

        if (restoredAudioUrl) {
          setAudioUrl(restoredAudioUrl);
        }

        if (podcast.title) setTitle(podcast.title);

        const savedSummary = podcast.summary;
        const savedChapters = podcast.chapters;
        const podLang = podcast.language || "";
        const sumLang = podcast.summaryLanguage || "";
        const savedCategory = podcast.category || "";
        const seriesName = podcast.seriesTitle || "";
        const episodeNo = podcast.episodeNumber ?? null;

        if (podLang) setPodcastLanguage(podLang);
        if (Array.isArray(savedChapters)) setChapters(savedChapters);
        if (savedCategory) setCategory(savedCategory);
        if (seriesName) setSeriesTitle(seriesName);
        if (episodeNo) setEpisodeNumber(episodeNo);

        if (savedSummary && (!podLang || sumLang === podLang)) {
          setSummary(savedSummary);
          setSummaryLoadedFromDb(true);
        } else {
          setSummary("");
          setSummaryLoadedFromDb(false);
        }
      } catch {
        // Ignore incomplete episode metadata and keep loading other preview data.
      }
    };

    const loadTranscript = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/podcasts/${encId}/transcript`, {
          headers: authHeaders,
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data?.words)) {
          if (isMounted) setWords(data.words);
        }
      } catch {
        // Transcript recovery is best-effort; the page still renders without it.
      }
    };

    loadEpisode();
    loadTranscript();

    return () => {
      isMounted = false;
    };
  }, [episodeId, authHeaders]);

  useEffect(() => {
    if (!episodeId) return;
    if (chaptersRecoveryAttemptedRef.current) return;
    if (chapters.length > 0) return;
    if (!Array.isArray(words) || words.length === 0) return;

    let cancelled = false;
    chaptersRecoveryAttemptedRef.current = true;

    const ensureChapters = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/podcasts/${encodeURIComponent(episodeId)}/chapters/ensure`,
          {
            method: "POST",
            headers: authHeaders,
            credentials: "include",
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return;
        if (Array.isArray(data?.chapters) && data.chapters.length > 0) {
          setChapters(data.chapters);
        }
      } catch {
        // Chapter recovery is best-effort; keep existing chapters if available.
      }
    };

    ensureChapters();

    return () => {
      cancelled = true;
    };
  }, [episodeId, chapters.length, words, authHeaders]);

  // generate summary for episode when transcript is ready and none saved
  useEffect(() => {
    if (!episodeId) return;
    if (summaryLoadedFromDb) return;
    if (!words || words.length === 0) return;

    const generate = async () => {
      try {
        setIsGeneratingSummary(true);
        const transcriptText = words.map((w) => w.w).join(" ");
        let langToUse = podcastLanguage || undefined;
        if (isLikelyArabic(transcriptText) && langToUse !== "ar") {
          langToUse = "ar";
        }
        const newSummary = await generateSummary(words, episodeId, langToUse, authHeaders);
        setSummary(newSummary);
      } catch (e) {
        console.error("Summary generation failed:", e);
      } finally {
        setIsGeneratingSummary(false);
      }
    };

    generate();
  }, [episodeId, words, summaryLoadedFromDb, podcastLanguage, authHeaders]);

  // generate summary for non-episode preview only
  useEffect(() => {
    if (episodeId) return;
    if (!words || words.length === 0) return;

    const loadOrGenerate = async () => {
      try {
        setIsGeneratingSummary(true);

        const transcriptText = words.map((w) => w.w).join(" ");
        let langToUse = podcastLanguage || undefined;
        if (isLikelyArabic(transcriptText) && langToUse !== "ar") {
          langToUse = "ar";
        }

        const newSummary = await generateSummary(words, episodeId, langToUse, authHeaders);
        setSummary(newSummary);

        try {
          const saved = sessionStorage.getItem("wecast_preview");
          if (saved) {
            const p = JSON.parse(saved);
            p.summary = newSummary;
            sessionStorage.setItem("wecast_preview", JSON.stringify(p));
          }
        } catch {
          // Ignore session persistence failures for generated preview summaries.
        }
      } catch (e) {
        console.error("Summary load/generate failed:", e);
        setSummary(generateSimpleSummary(words));
      } finally {
        setIsGeneratingSummary(false);
      }
    };

    loadOrGenerate();
  }, [episodeId, words, podcastLanguage, authHeaders]);

  const handleSaveAll = async () => {
    if (!isAuthenticated) {
      setShowSaveAuthModal(true);
      return;
    }

    setIsSaving(true);
    setSaveMessage("");
    setSaveMessageType("info");

    try {
      const payload = {
        title: displayTitle,
        audioUrl,
        audioKey,
        summary,
        chapters,
        words,
        language: podcastLanguage,
        transcriptText,
      };

      const createSnapshotSave = () =>
        fetch(`${API_BASE}/api/preview/save`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(payload),
        });

      let usedSnapshotFallback = false;
      let res = null;

      if (episodeId) {
        res = await fetch(`${API_BASE}/api/podcasts/${encodeURIComponent(episodeId)}/save-all`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(payload),
        });

        if (res.status === 401) {
          setShowSaveAuthModal(true);
          return;
        }

        if (!res.ok && (res.status === 403 || res.status === 404) && !isFromDashboardPreview) {
          usedSnapshotFallback = true;
          res = await createSnapshotSave();
        }
      } else {
        res = await createSnapshotSave();
      }

      if (res.status === 401) {
        setShowSaveAuthModal(true);
        return;
      }

      if (!res.ok) throw new Error(`Save failed: ${res.status}`);

      const data = await res.json().catch(() => ({}));

      setSaveMessageType("success");
      setSaveMessage(t("preview.saveSuccess"));

      if ((!episodeId || usedSnapshotFallback) && data?.podcastId) {
        sessionStorage.setItem(
          previewNoticeKey,
          JSON.stringify({ type: "success", message: t("preview.saveSuccess") })
        );
        clearPendingPreviewSave();
        clearPendingPreviewDraft();
        const nextFrom = fromSource || "create";
        window.location.hash = `#/preview?id=${encodeURIComponent(data.podcastId)}&from=${encodeURIComponent(nextFrom)}`;
        return;
      }

      clearPendingPreviewSave();
      clearPendingPreviewDraft();
    } catch (e) {
      console.error("Save failed", e);
      setSaveMessageType("error");
      setSaveMessage(t("preview.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || pendingSaveHandledRef.current) return;

    const intent = getPendingPreviewSave();
    if (!intent) return;

    if ((intent.id || "") !== (episodeId || "")) return;
    if ((intent.from || "") !== (fromSource || "")) return;
    if (!episodeId && !audioUrl) return;

    pendingSaveHandledRef.current = true;
    clearPendingPreviewSave();
    handleSaveAll();
  }, [isAuthenticated, episodeId, fromSource, audioKey, audioUrl]);

  const handleBack = () => {
    // Preferred behavior: return exactly one navigation step back.
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    if (fromSource === "episodes") {
      window.location.hash = "#/episodes";
      return;
    }
    if (fromSource === "studio_create") {
      window.location.hash = "#/create?from=studio";
      return;
    }

    const currentStep = Number.parseInt(
      sessionStorage.getItem("currentStep") || "1",
      10
    );
    const previousStep = Number.isFinite(currentStep)
      ? Math.max(1, currentStep - 1)
      : 1;

    sessionStorage.setItem("forceStep", String(previousStep));
    window.location.hash = "#/create";
  };

  const previewBadgeMeta = category ? "" : titleMeta;
  const downloadUrl = episodeId
    ? `${API_BASE}/api/audio/${encodeURIComponent(episodeId)}/download`
    : "";

  const footerActions =
    showPreviewSaveAction || episodeId ? (
      <>
        {showPreviewSaveAction ? (
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            title={t("preview.saveTooltip")}
            className="inline-flex h-11 w-full min-w-0 shrink-0 items-center justify-center gap-2 rounded-2xl bg-black px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[10.75rem] dark:bg-white dark:text-black"
          >
            <Save className="h-4 w-4 shrink-0" />
            {isSaving ? t("preview.saving") : t("preview.save")}
          </button>
        ) : null}
        {episodeId ? (
          <button
            type="button"
            onClick={async () => {
              const link = `${window.location.origin}/#/share/${encodeURIComponent(episodeId)}`;
              try {
                await navigator.clipboard.writeText(link);
                setSaveMessage("Share link copied.");
                setSaveMessageType("success");
              } catch {
                setSaveMessage(link);
                setSaveMessageType("info");
              }
            }}
            className="inline-flex h-11 w-full min-w-0 shrink-0 items-center justify-center rounded-2xl bg-purple-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 sm:w-auto sm:min-w-[10.75rem]"
          >
            Share Podcast
          </button>
        ) : null}
      </>
    ) : null;

  return (
    <div
      className={[
        "flex min-h-screen min-w-0 max-w-full flex-col overflow-x-clip bg-cream dark:bg-[#0a0a1a] text-black dark:text-white transition-colors duration-500",
        i18n.language === "ar" ? "text-right" : "text-left",
      ].join(" ")}
    >
      <ViewportToast
        message={saveMessage}
        type={saveMessageType}
        onDismiss={() => setSaveMessage("")}
      />
      <EpisodePreviewView
        t={t}
        i18n={i18n}
        displayTitle={displayTitle}
        titleMeta={previewBadgeMeta}
        titleDir={titleDir}
        resolvedCoverSrc={resolvedCoverSrc}
        onCoverError={() => setCoverImageFailed(true)}
        audioUrl={audioUrl}
        downloadUrl={downloadUrl}
        words={words}
        chapters={chapters}
        summary={summary}
        isGeneratingSummary={isGeneratingSummary}
        podcastLanguage={podcastLanguage}
        onBack={handleBack}
        headerTitle={t("preview.title")}
        headerSubtitle={t("preview.subtitle")}
        useDashboardGlassTone={useDashboardGlassTone}
        footerActions={footerActions}
      />
      <SavePreviewAuthModal
        open={showSaveAuthModal}
        title={t("preview.saveAuthTitle")}
        body={t("preview.saveAuthBody")}
        cancelLabel={t("preview.saveAuthCancel")}
        loginLabel={t("preview.saveAuthLogin")}
        signupLabel={t("preview.saveAuthSignup")}
        onClose={() => setShowSaveAuthModal(false)}
        onLogin={() => redirectForSaveAuth("login")}
        onSignup={() => redirectForSaveAuth("signup")}
      />
    </div>
  );
}

function SavePreviewAuthModal({
  open,
  title,
  body,
  cancelLabel,
  loginLabel,
  signupLabel,
  onClose,
  onLogin,
  onSignup,
}) {
  if (!open) return null;

  const modal = (
    <div className="wecast-overlay flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-neutral-950">
        <div className="space-y-3">
          <h2 className="text-2xl font-extrabold text-black dark:text-white">{title}</h2>
          <p className="text-sm leading-7 text-black/65 dark:text-white/65">{body}</p>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onLogin}
            className="inline-flex items-center justify-center rounded-2xl border border-black/10 px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
          >
            {loginLabel}
          </button>
          <button
            type="button"
            onClick={onSignup}
            className="inline-flex items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 dark:bg-white dark:text-black"
          >
            {signupLabel}
          </button>
        </div>
      </div>
    </div>
  );
  const portalTarget = getPortalTarget();
  return portalTarget ? createPortal(modal, portalTarget) : modal;
}
