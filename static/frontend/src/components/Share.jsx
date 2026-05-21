import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import EpisodePreviewView from "./EpisodePreviewView";

import { API_BASE } from "../utils/api";

const isLikelyArabic = (text = "") => /[\u0600-\u06FF]/.test(text);

export default function Share() {
  const { t, i18n } = useTranslation();

  const [audioUrl, setAudioUrl] = useState("");
  const [words, setWords] = useState([]);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [chapters, setChapters] = useState([]);
  const [podcastLanguage, setPodcastLanguage] = useState("");
  const [coverThumbB64, setCoverThumbB64] = useState("");
  const [coverImageFailed, setCoverImageFailed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const podcastId = (window.location.hash.split("/share/")[1] || "").split("?")[0].trim();

  useEffect(() => {
    if (!podcastId) {
      setError("Missing podcast ID");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadSharedPodcast = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/share/${encodeURIComponent(podcastId)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load shared podcast");
        }

        if (cancelled) return;

        setTitle(data.title || "");
        setAudioUrl(data.audioUrl || "");
        setSummary(data.summary || "");
        setChapters(Array.isArray(data.chapters) ? data.chapters : []);
        setWords(Array.isArray(data.words) ? data.words : []);
        setCoverThumbB64(data.cover || "");
        setCoverImageFailed(false);
        setPodcastLanguage(data.language || "");
        setError("");
      } catch (err) {
        console.error("Share page error:", err);
        if (!cancelled) {
          setError(err.message || "Something went wrong");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadSharedPodcast();

    return () => {
      cancelled = true;
    };
  }, [podcastId]);

  const displayTitle = title || t("episodes.untitledEpisode");
  const titleDir = useMemo(() => {
    if (isLikelyArabic(displayTitle) || podcastLanguage === "ar") return "rtl";
    return "ltr";
  }, [displayTitle, podcastLanguage]);

  const resolvedCoverSrc = useMemo(() => {
    if (!coverImageFailed && coverThumbB64) {
      return `data:image/jpeg;base64,${coverThumbB64}`;
    }
    return "";
  }, [coverImageFailed, coverThumbB64]);

  const handleBack = () => {
    window.location.hash = "#/";
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-6 text-center text-red-500 dark:bg-[#0a0a1a]">
        {error}
      </div>
    );
  }

  return (
    <div
      className={[
        "flex min-h-screen min-w-0 max-w-full flex-col overflow-x-clip bg-cream text-black transition-colors duration-500 dark:bg-[#0a0a1a] dark:text-white",
        i18n.language === "ar" ? "text-right" : "text-left",
      ].join(" ")}
    >
      {loading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" aria-hidden />
          <p className="text-sm text-black/60 dark:text-white/60">
            {t("preview.loadingShared", "Loading shared episode…")}
          </p>
        </div>
      ) : (
        <EpisodePreviewView
          t={t}
          i18n={i18n}
          displayTitle={displayTitle}
          titleDir={titleDir}
          resolvedCoverSrc={resolvedCoverSrc}
          onCoverError={() => setCoverImageFailed(true)}
          audioUrl={audioUrl}
          downloadUrl={
            podcastId ? `${API_BASE}/api/share/${encodeURIComponent(podcastId)}/download` : ""
          }
          words={words}
          chapters={chapters}
          summary={summary}
          isGeneratingSummary={false}
          podcastLanguage={podcastLanguage}
          onBack={handleBack}
          headerTitle={t("preview.title")}
          headerSubtitle={t("preview.subtitle")}
          useDashboardGlassTone
        />
      )}
    </div>
  );
}
