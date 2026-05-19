import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenText,
  Check,
  ChevronDown,
  ExternalLink,
  GraduationCap,
  LayoutDashboard,
  List,
  MessageCircle,
  Mic,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const API_BASE = import.meta.env.PROD
  ? "https://wecast.onrender.com"
  : "http://localhost:5000";

const EPISODES_CACHE_PREFIX = "wecast:episodesList:";
const EPISODES_CACHE_TTL_MS = 5 * 60 * 1000;

function episodesCacheKey(token) {
  return `${EPISODES_CACHE_PREFIX}${token || ""}`;
}

function readEpisodesCache(token) {
  if (!token) return null;
  try {
    const raw = sessionStorage.getItem(episodesCacheKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.t !== "number") return null;
    if (Date.now() - parsed.t > EPISODES_CACHE_TTL_MS) return null;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      recycleBin: Array.isArray(parsed.recycleBin) ? parsed.recycleBin : [],
    };
  } catch {
    return null;
  }
}

function writeEpisodesCache(token, items, recycleBin) {
  if (!token) return;
  try {
    sessionStorage.setItem(
      episodesCacheKey(token),
      JSON.stringify({ t: Date.now(), items, recycleBin })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

function clearEpisodesCache(token) {
  if (!token) return;
  try {
    sessionStorage.removeItem(episodesCacheKey(token));
  } catch {
    /* ignore */
  }
}

function getStoredToken() {
  try {
    return localStorage.getItem("token") || sessionStorage.getItem("token") || "";
  } catch {
    return "";
  }
}

function normalizeEpisodesPayload(data) {
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    recycleBin: Array.isArray(data?.recycleBin) ? data.recycleBin : [],
  };
}

const episodesRequests = new Map();

function requestEpisodes(token) {
  if (!token) return null;
  const existing = episodesRequests.get(token);
  if (existing) return existing;

  const request = fetch(`${API_BASE}/api/episodes`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        const error = new Error("Unauthorized");
        error.status = 401;
        throw error;
      }
      if (!res.ok) throw new Error(data?.error || "Failed to load episodes");
      const next = normalizeEpisodesPayload(data);
      writeEpisodesCache(token, next.items, next.recycleBin);
      return next;
    })
    .finally(() => {
      episodesRequests.delete(token);
    });

  episodesRequests.set(token, request);
  return request;
}

function preloadEpisodes() {
  const token = getStoredToken();
  if (!token) return null;
  const request = requestEpisodes(token);
  request?.catch(() => {
    /* handled when the Episodes route mounts */
  });
  return request;
}

preloadEpisodes();

const STYLE_FILTER_ORDER = ["interview", "educational", "storytelling", "conversational"];

const STYLE_ICON_BY_KEY = {
  interview: Mic,
  educational: GraduationCap,
  storytelling: BookOpenText,
  conversational: MessageCircle,
  unknown: List,
};

function getEpisodeStyleRaw(ep) {
  return String(ep?.scriptStyle || ep?.style || ep?.script_style || "").trim();
}

function normalizeStyleKey(rawStyle) {
  const source = String(rawStyle || "").trim().toLowerCase();
  if (!source) return "unknown";
  if (source.includes("interview") || source.includes("مقاب")) return "interview";
  if (source.includes("educat") || source.includes("تعليم")) return "educational";
  if (source.includes("story") || source.includes("سرد")) return "storytelling";
  if (source.includes("convers") || source.includes("حوار")) return "conversational";
  return source.replace(/\s+/g, "_");
}

function EpisodeCover({ title, coverUrl, coverThumbB64 }) {
  const [imageFailed, setImageFailed] = useState(false);

  const initials = String(title || "EP")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  const fallbackDataUrl = coverThumbB64
    ? `data:image/jpeg;base64,${coverThumbB64}`
    : "";
  const resolvedCover = !imageFailed && coverUrl ? coverUrl : fallbackDataUrl;

  if (resolvedCover) {
    return (
      <img
        src={resolvedCover}
        alt={`${title || "Episode"} cover`}
        className="h-full w-full max-w-full object-cover"
        loading="lazy"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-neutral-100 to-neutral-200 text-sm font-bold text-neutral-700 dark:from-neutral-800 dark:to-neutral-700 dark:text-neutral-100">
      {initials || "EP"}
    </div>
  );
}

export default function Episodes() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const token = getStoredToken();
  const initialEpisodesCache = useMemo(() => readEpisodesCache(token), [token]);
  const [q, setQ] = useState("");
  const [episodes, setEpisodes] = useState(() => initialEpisodesCache?.items || []);
  const [loading, setLoading] = useState(() => Boolean(token && !initialEpisodesCache));
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionInfo, setActionInfo] = useState("");
  const [playerError, setPlayerError] = useState("");
  const [activeAudioId, setActiveAudioId] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState("");
  const [pendingDeleteEpisode, setPendingDeleteEpisode] = useState(null);
  const [recycleBin, setRecycleBin] = useState(() => initialEpisodesCache?.recycleBin || []);
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
  const audioRef = useRef(null);

  const closeMobileLibrary = () => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setMobileLibraryOpen(false);
    }
  };

  const emptyBrief = t("episodes.briefFallback");
  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const handleUnauthorized = () => {
    const prev = getStoredToken();
    clearEpisodesCache(prev);
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    window.dispatchEvent(new StorageEvent("storage", { key: "token", newValue: "" }));
    window.location.hash = "#/login?redirect=episodes";
  };

  useEffect(() => {
    let isMounted = true;
    const cached = initialEpisodesCache;
    if (cached) {
      setEpisodes(cached.items);
      setRecycleBin(cached.recycleBin);
      setLoading(false);
      setRefreshing(true);
    } else if (token) {
      setLoading(true);
    } else {
      setLoading(false);
    }

    if (!token) {
      setEpisodes([]);
      setRecycleBin([]);
      setLoadError("");
      setRefreshing(false);
      return () => {
        isMounted = false;
      };
    }

    if (!cached) setLoadError("");
    const request = requestEpisodes(token);
    request
      ?.then((next) => {
        if (!isMounted) return;
        setEpisodes(next.items);
        setRecycleBin(next.recycleBin);
        setLoadError("");
      })
      .catch((error) => {
        if (!isMounted) return;
        if (error?.status === 401) {
          handleUnauthorized();
          clearEpisodesCache(token);
          return;
        }
        if (!cached) setLoadError(t("episodes.loadError"));
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      isMounted = false;
    };
  }, [t, token, initialEpisodesCache]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const resolveAudioUrl = (raw) => {
    const src = String(raw || "").trim();
    if (!src) return "";
    if (src.startsWith("http://") || src.startsWith("https://")) return src;
    return `${API_BASE}${src}`;
  };

  const styleCounts = useMemo(() => {
    const counts = new Map();
    const labels = new Map();
    for (const ep of episodes) {
      const rawStyle = getEpisodeStyleRaw(ep);
      const key = normalizeStyleKey(rawStyle);
      counts.set(key, (counts.get(key) || 0) + 1);
      if (rawStyle && !labels.has(key)) labels.set(key, rawStyle);
    }
    return { counts, labels };
  }, [episodes]);

  const styleFilters = useMemo(() => {
    const known = STYLE_FILTER_ORDER.map((key) => {
      const labelByKey = {
        interview: t("create.styles.interview.title"),
        educational: t("create.styles.educational.title"),
        storytelling: t("create.styles.storytelling.title"),
        conversational: t("create.styles.conversational.title"),
      };
      const rawLabel = styleCounts.labels.get(key);
      return {
        key,
        label: labelByKey[key] || rawLabel || key,
        count: styleCounts.counts.get(key) || 0,
      };
    });

    const custom = [...styleCounts.counts.entries()]
      .filter(([key]) => !STYLE_FILTER_ORDER.includes(key))
      .map(([key, count]) => ({
        key,
        label:
          key === "unknown"
            ? t("episodes.styles.unknown", "Other")
            : (styleCounts.labels.get(key) || key.replace(/_/g, " ")),
        count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    return [...known, ...custom];
  }, [styleCounts, t]);

  const filtered = useMemo(() => {
    if (activeFilter === "deleted") {
      const query = q.trim().toLowerCase();
      if (!query) return recycleBin;
      return recycleBin.filter((e) =>
        String(e.title || "").toLowerCase().includes(query) ||
        String(e.brief || "").toLowerCase().includes(query)
      );
    }

    const query = q.trim().toLowerCase();
    let base = episodes;
    if (activeFilter.startsWith("style:")) {
      const filterStyle = activeFilter.slice(6);
      base = base.filter((e) => normalizeStyleKey(getEpisodeStyleRaw(e)) === filterStyle);
    }

    if (!query) return base;
    return base.filter((e) =>
      String(e.title || "").toLowerCase().includes(query) ||
      String(e.brief || "").toLowerCase().includes(query)
    );
  }, [q, episodes, activeFilter, recycleBin]);

  const visibleEpisodes = filtered;
  useEffect(() => {
    if (!selectedEpisodeId) return;
    const exists = [...episodes, ...recycleBin].some((e) => e.id === selectedEpisodeId);
    if (!exists) setSelectedEpisodeId("");
  }, [episodes, recycleBin, selectedEpisodeId]);

  useEffect(() => {
    if (selectedEpisodeId) return;
    if (filtered.length > 0) {
      setSelectedEpisodeId(filtered[0].id);
    }
  }, [filtered, selectedEpisodeId]);

  const getEpisodeBrief = (ep) => {
    const brief = String(ep?.brief || "").trim();
    if (!brief) return emptyBrief;
    if (brief.length <= 160) return brief;
    return `${brief.slice(0, 160).trimEnd()}...`;
  };

  const openEpisode = (id) => {
    sessionStorage.setItem("preview_from", "episodes");
    window.location.hash = `#/preview?id=${encodeURIComponent(id)}&from=episodes`;
  };

  const startCreate = () => {
    closeMobileLibrary();
    window.location.hash = "#/create?from=studio";
  };

  const startEditEpisode = (ep) => {
      const editData = {
    podcastId: ep.id,
    script: ep.script || "",
    scriptTemplate: ep.scriptTemplate || "",
    showTitle: ep.title || "Podcast Show",
    episodeTitle: ep.title || "Podcast Show",
    scriptStyle: ep.scriptStyle || "",
    speakersCount: ep.speakersCount || 0,
    speakers: ep.speakers || [],
    description: ep.description || "",
    introMusic: ep.introMusic || "",
    bodyMusic: ep.bodyMusic || "",
    outroMusic: ep.outroMusic || "",
    category: ep.category || "",
  };
  sessionStorage.setItem("editData", JSON.stringify(editData));
  window.location.hash = "#/edit-podcast?id=" + encodeURIComponent(ep.id);
  };

  const formatClock = (value) => {
    const sec = Math.max(0, Math.floor(Number(value) || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const remainingSec = Math.max(0, Math.floor((playbackDuration || 0) - (playbackTime || 0)));

  const handleSeekEpisode = (ep, value) => {
    if (!audioRef.current || activeAudioId !== ep?.id) return;
    const nextTime = Number(value);
    if (!Number.isFinite(nextTime)) return;
    audioRef.current.currentTime = nextTime;
    setPlaybackTime(nextTime);
  };

  const renderProgress = (ep) => {
    if (activeAudioId !== ep?.id) return null;
    return (
      <div className="mt-2 min-w-0 max-w-full overflow-hidden max-md:mt-1">
        <input
          type="range"
          min={0}
          max={Math.max(1, playbackDuration || 0)}
          value={Math.min(playbackTime, Math.max(1, playbackDuration || 0))}
          step="0.1"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onChange={(e) => handleSeekEpisode(ep, e.target.value)}
          className="w-full max-w-full min-w-0 accent-purple-600 cursor-pointer"
          aria-label="Episode progress"
        />
        <div className="mt-1 flex min-w-0 max-w-full items-center justify-between gap-2 text-xs text-black/55 dark:text-white/55 max-md:mt-0.5 max-md:gap-1 max-md:text-[10px]">
          <span className="min-w-0 shrink-0 tabular-nums">{formatClock(playbackTime)}</span>
          <span className="min-w-0 truncate text-end">{t("episodes.timeLeft", { time: formatClock(remainingSec) })}</span>
        </div>
      </div>
    );
  };

  const togglePlayEpisode = async (ep) => {
    setPlayerError("");

    if (audioRef.current && activeAudioId === ep.id) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch {
          setPlayerError(t("episodes.playError"));
        }
      }
      return;
    }

    if (audioRef.current) audioRef.current.pause();

    let src = "";
    if (ep?.audioKey) {
      try {
        const res = await fetch(`${API_BASE}/api/audio/${ep.id}`, {
          headers: authHeaders,
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!res.ok || !data?.url) {
          throw new Error(data?.error || "Failed to load audio");
        }
        src = resolveAudioUrl(data.url);
        setEpisodes((prev) => {
          const next = prev.map((item) =>
            item.id === ep.id ? { ...item, audioUrl: data.url } : item
          );
          writeEpisodesCache(token, next, recycleBin);
          return next;
        });
      } catch {
        setPlayerError(t("episodes.playError"));
        return;
      }
    }

    if (!src) {
      src = resolveAudioUrl(ep?.audioUrl);
    }

    if (!src) return;

    const nextAudio = new Audio(src);
    nextAudio.ontimeupdate = () => setPlaybackTime(nextAudio.currentTime || 0);
    nextAudio.onloadedmetadata = () => {
      setPlaybackDuration(Number.isFinite(nextAudio.duration) ? nextAudio.duration : 0);
    };
    nextAudio.onended = () => {
      setIsPlaying(false);
      setActiveAudioId("");
      setPlaybackTime(0);
      setPlaybackDuration(0);
    };
    nextAudio.onpause = () => setIsPlaying(false);
    nextAudio.onplay = () => setIsPlaying(true);

    audioRef.current = nextAudio;
    setActiveAudioId(ep.id);
    setPlaybackTime(0);
    setPlaybackDuration(0);
    try {
      await nextAudio.play();
      setIsPlaying(true);
    } catch {
      setPlayerError(t("episodes.playError"));
      setActiveAudioId("");
      setIsPlaying(false);
      setPlaybackTime(0);
      setPlaybackDuration(0);
    }
  };

  const requestDeleteEpisode = (ep) => {
    const id = ep?.id;
    if (!id) return;
    setPendingDeleteEpisode({
      id,
      title: ep?.title || t("episodes.thisEpisode"),
    });
  };

  const moveEpisodeToRecycleBin = async (ep) => {
    const id = ep?.id;
    if (!id) return;
    const episodePayload = episodes.find((item) => item.id === id) || ep;

    setActionInfo("");
    setActionError("");
    try {
      const res = await fetch(`${API_BASE}/api/episodes/${encodeURIComponent(id)}/trash`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error(data?.error || "Failed to move episode to recycle bin");

      if (activeAudioId === id && audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setActiveAudioId("");
        setIsPlaying(false);
        setPlaybackTime(0);
        setPlaybackDuration(0);
      }

      const nextEpisodes = episodes.filter((item) => item.id !== id);
      const nextBin = [
        { ...episodePayload, deletedAt: data?.deletedAt || new Date().toISOString() },
        ...recycleBin.filter((x) => x.id !== id),
      ];
      setEpisodes(nextEpisodes);
      setRecycleBin(nextBin);
      writeEpisodesCache(token, nextEpisodes, nextBin);
      setActionInfo(t("episodes.recycle.moved", { title: episodePayload?.title || t("episodes.thisEpisode") }));
    } catch {
      setActionError(t("episodes.deleteError"));
    }
  };

  const restoreFromRecycleBin = async (id) => {
    const target = recycleBin.find((ep) => ep.id === id);
    if (!target) return;
    setActionInfo("");
    setActionError("");
    try {
      const res = await fetch(`${API_BASE}/api/episodes/${encodeURIComponent(id)}/restore`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error(data?.error || "Failed to restore episode");

      const restoredEpisode = { ...target };
      delete restoredEpisode.deletedAt;
      delete restoredEpisode.deleteAfter;
      const nextBin = recycleBin.filter((ep) => ep.id !== id);
      const nextEpisodes = [restoredEpisode, ...episodes];
      setRecycleBin(nextBin);
      setEpisodes(nextEpisodes);
      writeEpisodesCache(token, nextEpisodes, nextBin);
      setActionInfo(t("episodes.recycle.restored", { title: target?.title || t("episodes.thisEpisode") }));
    } catch {
      setActionError(t("episodes.deleteError"));
    }
  };

  const permanentlyDeleteFromRecycleBin = async (ep) => {
    const id = ep?.id;
    if (!id) return;
    setActionInfo("");
    setActionError("");
    try {
      const res = await fetch(`${API_BASE}/api/episodes/${encodeURIComponent(id)}/delete`, {
        method: "POST",
        headers: authHeaders,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) throw new Error(data?.error || "Failed to delete episode");
      const nextBin = recycleBin.filter((x) => x.id !== id);
      setRecycleBin(nextBin);
      writeEpisodesCache(token, episodes, nextBin);
      setActionInfo(t("Episode deleted successfully", { title: ep?.title || t("episodes.thisEpisode") }));
    } catch {
      setActionError(t("episodes.deleteError"));
    }
  };

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-x-clip overflow-y-hidden bg-cream text-black dark:bg-[#0a0a1a] dark:text-white">
      <main className="min-h-0 min-w-0 w-full flex-1 pt-0 pb-0">
        <div className="mx-auto h-full min-h-0 w-full min-w-0 max-w-full overflow-x-clip border-b border-black/10 bg-white/70 backdrop-blur-sm dark:border-white/10 dark:bg-neutral-900/45">
          <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col md:flex-row md:items-stretch">
            <div className="min-w-0 max-w-full shrink-0 bg-white/35 px-4 py-1.5 shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.04)] dark:bg-neutral-900/20 dark:shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.05)] md:hidden">
              <button
                type="button"
                id="episodes-library-toggle"
                aria-expanded={mobileLibraryOpen}
                aria-controls="episodes-library-aside"
                onClick={() => setMobileLibraryOpen((open) => !open)}
                className="group flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-start text-[13px] font-normal leading-snug text-black/78 transition [-webkit-tap-highlight-color:transparent] hover:bg-black/[0.03] active:bg-black/[0.045] focus-visible:outline-none focus-visible:bg-black/[0.04] dark:text-white/78 dark:hover:bg-white/[0.05] dark:active:bg-white/[0.07] dark:focus-visible:bg-white/[0.06]"
              >
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <SlidersHorizontal
                    className="h-3.5 w-3.5 shrink-0 text-black/35 transition-colors group-hover:text-purple-600/50 dark:text-white/38 dark:group-hover:text-purple-300/50"
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">
                    {t("episodes.mobile.libraryPanel", "Filters & library")}
                  </span>
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 text-black/28 transition-transform duration-200 dark:text-white/32 ${mobileLibraryOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </div>

            <aside
              id="episodes-library-aside"
              className={[
                "min-w-0 max-w-full border-b border-black/10 bg-white/45 backdrop-blur-sm dark:border-white/10 dark:bg-neutral-950/30",
                "p-4 pb-5 md:block md:w-80 md:shrink-0 md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-e md:max-h-none md:p-5 lg:p-6",
                mobileLibraryOpen
                  ? "max-md:block max-md:max-h-[min(70vh,520px)] max-md:overflow-y-auto"
                  : "max-md:hidden",
              ].join(" ")}
            >
              <div className="mb-4 min-w-0 max-w-full rounded-2xl border border-white/60 bg-white/55 p-3.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/60 md:mb-5 md:p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/60">{t("episodes.sidebar.library")}</p>
                <div className="mt-3.5 grid min-w-0 gap-2 md:gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFilter("all");
                      setQ("");
                      closeMobileLibrary();
                    }}
                    className={`inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-start text-sm font-semibold transition ${
                      activeFilter === "all"
                        ? "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-500/25 dark:text-purple-100 dark:border-purple-400/40"
                        : "bg-white/70 text-black/85 dark:bg-neutral-900/80 dark:text-white border-black/10 dark:border-white/10 hover:bg-white/90 dark:hover:bg-white/10"
                    }`}
                  >
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{t("episodes.sidebar.viewAll")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFilter("deleted");
                      closeMobileLibrary();
                    }}
                    className={`inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-start text-sm font-semibold transition ${
                      activeFilter === "deleted"
                        ? "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-500/25 dark:text-purple-100 dark:border-purple-400/40"
                        : "bg-white/70 text-black/85 dark:bg-neutral-900/80 dark:text-white border-black/10 dark:border-white/10 hover:bg-white/90 dark:hover:bg-white/10"
                    }`}
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{t("episodes.sidebar.recycleBin")}</span>
                    <span className="ms-1 inline-flex min-w-5 shrink-0 items-center justify-center rounded-full border border-current/20 px-1.5 text-[11px] leading-5">
                      {recycleBin.length}
                    </span>
                  </button>

                  <div className="mt-2 border-t border-black/10 dark:border-white/10 pt-2">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-black/50 dark:text-white/55">
                      {t("create.step4.style")}
                    </p>
                    <div className="grid min-w-0 gap-2">
                      {styleFilters.map((styleItem) => {
                        const filterKey = `style:${styleItem.key}`;
                        const StyleIcon = STYLE_ICON_BY_KEY[styleItem.key] || List;
                        return (
                          <button
                            key={styleItem.key}
                            type="button"
                            onClick={() => {
                              setActiveFilter(filterKey);
                              closeMobileLibrary();
                            }}
                            className={`inline-flex min-w-0 max-w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                              activeFilter === filterKey
                                ? "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-500/25 dark:text-purple-100 dark:border-purple-400/40"
                                : "bg-white/70 text-black/85 dark:bg-neutral-900/80 dark:text-white border-black/10 dark:border-white/10 hover:bg-white/90 dark:hover:bg-white/10"
                            }`}
                          >
                            <span className="inline-flex min-w-0 flex-1 items-center gap-2">
                              <StyleIcon className="h-4 w-4 shrink-0" />
                              <span className="min-w-0 truncate">{styleItem.label}</span>
                            </span>
                            <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full border border-current/20 px-1.5 text-[11px] leading-5">
                              {styleItem.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-w-0 max-w-full rounded-2xl border border-white/60 bg-white/55 p-3.5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-neutral-900/60 md:p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-black/55 dark:text-white/60">{t("episodes.sidebar.actions")}</p>
                <div className="mt-3.5 grid min-w-0 gap-2 md:gap-2.5">
                  <button
                    type="button"
                    onClick={startCreate}
                    className="inline-flex min-w-0 max-w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white hover:opacity-95 dark:bg-white dark:text-black"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{t("episodes.sidebar.createNew")}</span>
                  </button>
            
                </div>
              </div>

            </aside>

            <section
              dir={isRTL ? "rtl" : "ltr"}
              className="flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-y-auto overflow-x-clip bg-white/35 px-4 py-4 dark:bg-neutral-900/20 md:min-h-0 md:overflow-hidden md:px-6 md:py-6 lg:px-7 lg:py-7"
            >
              <div className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2 text-start max-md:items-center max-md:gap-y-0 md:items-center md:gap-x-4 md:gap-y-2">
                <div className="flex min-w-0 max-w-full items-center gap-2 max-md:col-start-1 max-md:row-start-1 max-md:min-w-0 max-md:pe-1 md:col-start-1 md:row-start-1 md:gap-3 md:self-center">
                  <h1 className="heading-md min-w-0 break-words text-black dark:text-white">
                    {t("episodes.pageTitle")}
                  </h1>
                  <div className="relative h-6 w-6 shrink-0" aria-hidden="true">
                    <span className="absolute inset-0 rounded-full border border-purple-400/70 dark:border-purple-300/60 animate-spin-slow" />
                    <span className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 animate-pulse" />
                    <span className="absolute -end-1 -top-1 h-2 w-2 rounded-full bg-yellow-400 animate-bounce" />
                  </div>
                </div>
                <p className="body-sm mt-1.5 max-w-full break-words text-black/65 dark:text-white/65 max-md:col-span-2 max-md:col-start-1 max-md:row-start-2 md:col-span-2 md:row-start-2 md:mt-0">
                  {t("episodes.pageSubtitle")}
                </p>
                <div className="inline-flex h-10 w-auto max-w-full shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/90 px-3.5 text-xs font-semibold text-black dark:border-white/10 dark:bg-neutral-900 dark:text-white max-md:col-start-2 max-md:row-start-1 max-md:h-6 max-md:self-center max-md:justify-self-end max-md:border-black/15 max-md:bg-white/85 max-md:px-2 max-md:py-0.5 max-md:text-[10px] max-md:leading-none md:col-start-2 md:row-start-1 md:h-8 md:px-2.5 md:text-[11px] md:leading-tight md:justify-self-end">
                  <span className="truncate">{t("episodes.resultsCount", { count: filtered.length })}</span>
                </div>
              </div>

              <div className="mt-3 w-full min-w-0 max-w-full md:mt-5 md:max-w-4xl">
                <div className="group flex min-w-0 max-w-full items-center gap-2.5 overflow-hidden rounded-xl border border-black/10 bg-white/85 px-3.5 py-2.5 shadow-sm backdrop-blur-md focus-within:border-purple-300 dark:border-white/10 dark:bg-neutral-900/85 dark:focus-within:border-purple-400/60 md:gap-3 md:px-4 md:py-3">
                  <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-100 via-purple-100 to-indigo-100 text-purple-700 ring-1 ring-purple-200/80 shadow-sm dark:from-purple-500/30 dark:via-fuchsia-500/20 dark:to-indigo-500/25 dark:text-purple-100 dark:ring-purple-300/30">
                    <Search className="h-[18px] w-[18px] transition-transform duration-200 ease-out group-hover:scale-110" />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder={t("episodes.searchPlaceholder")}
                      className="w-full min-w-0 bg-transparent text-sm text-black dark:text-white outline-none placeholder:text-black/40 dark:placeholder:text-white/40"
                    />
                  </div>
                  {q && (
                    <button
                      type="button"
                      onClick={() => setQ("")}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10"
                      title={t("episodes.clearSearch", "Clear search")}
                      aria-label={t("episodes.clearSearch", "Clear search")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {actionInfo && (
                <p className="mt-3 max-w-full break-words text-sm text-emerald-700 dark:text-emerald-300 md:mt-4">{actionInfo}</p>
              )}
              {actionError && (
                <p className="mt-2 max-w-full break-words text-sm text-red-600 dark:text-red-300 md:mt-3">{actionError}</p>
              )}
              {playerError && (
                <p className="mt-2 max-w-full break-words text-sm text-rose-600 dark:text-rose-300 md:mt-3">{playerError}</p>
              )}
              {refreshing && !loading && (
                <p className="mt-2 flex items-center gap-2 text-sm text-black/60 dark:text-white/60 md:mt-3">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" aria-hidden />
                  {t("episodes.refreshing", "Updating library…")}
                </p>
              )}

              <div className="mt-5 flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-clip rounded-2xl border border-black/10 bg-white/45 p-3 dark:border-white/10 dark:bg-neutral-900/35 md:mt-6 md:p-4 lg:mt-7 lg:p-5">
                <div className="episodes-scrollbar h-full min-h-0 w-full min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-clip overscroll-contain px-0 pe-2 md:pe-3">
                  <div className="grid w-full min-w-0 max-w-full gap-3 md:gap-4">
                {loading ? (
                  <div className="max-w-full break-words rounded-xl border border-black/10 bg-white/90 p-4 text-sm text-black/70 dark:border-white/10 dark:bg-neutral-900/70 dark:text-white/70 md:p-6">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" aria-hidden />
                      <span>{t("episodes.loading", "Loading podcast…")}</span>
                    </div>
                  </div>
                ) : loadError ? (
                  <div className="max-w-full break-words rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 md:p-6">{loadError}</div>
                ) : filtered.length === 0 ? (
                  <div className="max-w-full break-words rounded-xl border border-black/10 bg-white/90 p-4 text-sm text-black/70 dark:border-white/10 dark:bg-neutral-900/70 dark:text-white/70 md:p-6">
                    {q.trim()
                      ? t("episodes.searchEmpty")
                      : activeFilter === "deleted"
                        ? t("episodes.recycle.empty")
                      : t("episodes.empty")}
                  </div>
                ) : (
                  visibleEpisodes.map((ep) => (
                    <div
                      key={ep.id}
                      onClick={() => setSelectedEpisodeId(ep.id)}
                      className={`relative w-full min-h-[128px] min-w-0 max-w-full cursor-pointer overflow-x-clip overflow-hidden rounded-2xl border bg-white/95 p-3 transition hover:border-purple-500 hover:bg-purple-100/55 hover:shadow-md dark:bg-neutral-900/80 dark:hover:border-purple-400 dark:hover:bg-purple-900/25 max-md:min-h-0 md:p-4 ${
                        selectedEpisodeId === ep.id
                          ? "border-purple-500 ring-2 ring-purple-300/70 dark:ring-purple-500/45 bg-purple-50/45 dark:bg-purple-900/20"
                          : "border-black/10 dark:border-white/10"
                      } text-start`}
                    >
                      <div className="flex w-full min-w-0 max-w-full flex-col flex-nowrap items-stretch gap-0 overflow-x-clip max-md:gap-4 md:min-w-0 md:flex-row md:items-stretch md:gap-5">
                        <div className="flex w-full min-w-0 max-w-full flex-none flex-col gap-3 overflow-hidden max-md:flex-none max-md:flex-row max-md:flex-nowrap max-md:items-start max-md:gap-2.5 md:min-w-0 md:flex-1 md:flex-row md:items-stretch md:gap-5">
                          <div className="relative w-32 shrink-0 overflow-hidden rounded-lg border-0 bg-neutral-100/80 max-md:h-16 max-md:w-16 max-md:shrink-0 max-md:self-start max-md:border max-md:border-black/10 dark:max-md:border-white/15 md:h-full md:min-h-0 md:w-40 md:shrink-0 md:self-stretch md:rounded-lg md:border-0">
                            <EpisodeCover title={ep.title} coverUrl={ep.coverUrl} coverThumbB64={ep.coverThumbB64} />
                          </div>
                          <div className="flex min-w-0 w-full max-w-none flex-1 flex-col justify-center overflow-hidden py-0.5 max-md:min-w-0 max-md:flex-1 max-md:py-0 md:min-h-0 md:min-w-0 md:flex-1 md:max-w-none md:self-stretch md:justify-center md:py-1">
                            <div className="mb-1 flex min-h-[18px] min-w-0 items-center">
                              <span
                                className={`inline-flex max-w-[8rem] items-center gap-1 rounded-md border border-purple-200/80 bg-purple-50/90 px-2 py-1 text-[10px] font-semibold leading-none text-purple-700 shadow-sm dark:border-purple-400/35 dark:bg-purple-900/80 dark:text-purple-100 ${
                                  selectedEpisodeId === ep.id ? "" : "invisible"
                                }`}
                                aria-hidden={selectedEpisodeId === ep.id ? undefined : true}
                              >
                                <Check className="size-3 shrink-0" aria-hidden />
                                <span className="min-w-0 truncate">{t("episodes.card.selected")}</span>
                              </span>
                            </div>
                            <p className="shrink-0 text-[10px] font-semibold uppercase leading-none tracking-[0.2em] text-black/40 dark:text-white/45 md:text-[11px] md:tracking-[0.18em]">
                              {t("episodes.itemLabel")}
                            </p>
                            {ep.hasEditDraft && (
                              <div className="mt-1.5 inline-flex max-w-full items-center gap-2 self-start rounded-full border border-amber-300/70 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-400/30 dark:bg-amber-900/15 dark:text-amber-200 max-md:mt-1 max-md:gap-1 max-md:px-2 max-md:py-0.5 max-md:text-[10px]">
                                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 max-md:h-1.5 max-md:w-1.5" />
                                <span className="min-w-0 truncate">Editing In Progress</span>
                              </div>
                            )}
                            <div className="mt-1.5 min-w-0 w-full max-w-full text-pretty break-words text-sm font-semibold leading-snug text-black line-clamp-2 dark:text-white max-md:mt-1 md:mt-2 md:text-base md:leading-snug">
                              {ep.title || t("episodes.untitledEpisode")}
                            </div>
                            <p className="body-sm mt-1.5 min-w-0 w-full max-w-full text-pretty break-words text-black/65 line-clamp-2 dark:text-white/65 max-md:mt-1 max-md:text-[13px] max-md:leading-snug md:mt-2 md:text-[13px] md:leading-normal">
                              {getEpisodeBrief(ep)}
                            </p>
                            {renderProgress(ep)}
                          </div>
                        </div>

                        <div
                          className={`flex flex-nowrap content-center items-center justify-center gap-2.5 self-stretch border-t border-black/5 pt-3 max-md:w-full max-md:min-w-0 max-md:overflow-x-auto max-md:overscroll-x-contain max-md:pb-0.5 md:w-auto md:min-w-0 md:max-w-none md:shrink-0 md:grow-0 md:basis-auto md:content-start md:items-start md:justify-end md:gap-2 md:self-stretch md:overflow-x-auto md:overscroll-x-contain md:border-t-0 md:pt-0 md:[scrollbar-width:thin] lg:gap-2.5 ${isRTL ? "md:justify-start" : ""}`}
                        >
                          {activeFilter === "deleted" ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  restoreFromRecycleBin(ep.id);
                                }}
                                className="inline-flex h-9 min-h-9 max-md:h-7 max-md:min-h-7 min-w-0 w-auto max-w-full shrink-0 grow-0 items-center justify-center gap-1.5 max-md:gap-0.5 rounded-lg max-md:rounded border border-black/10 px-3 max-md:px-1.5 text-sm max-md:text-[10px] max-md:leading-tight font-semibold hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                                title={t("episodes.recycle.undoLatest")}
                              >
                                <Undo2 className="size-4 max-md:size-3 shrink-0" />
                                <span className="min-w-0 truncate">{t("episodes.recycle.restore")}</span>
                              </button>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await permanentlyDeleteFromRecycleBin(ep);
                                }}
                                className="inline-flex h-9 min-h-9 max-md:h-7 max-md:min-h-7 min-w-0 w-auto max-w-full shrink-0 grow-0 items-center justify-center gap-1.5 max-md:gap-0.5 rounded-lg max-md:rounded border border-red-200 px-3 max-md:px-1.5 text-sm max-md:text-[10px] max-md:leading-tight font-semibold text-red-600 hover:bg-red-50 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-900/20"
                                title={t("episodes.recycle.emptyNow")}
                              >
                                <Trash2 className="size-4 max-md:size-3 shrink-0" />
                                <span className="min-w-0 truncate">{t("episodes.recycle.emptyNow")}</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEpisode(ep.id);
                                }}
                                className="inline-flex h-9 min-h-9 max-md:h-7 max-md:min-h-7 min-w-0 w-auto max-w-full shrink-0 grow-0 items-center justify-center gap-1.5 max-md:gap-0.5 rounded-lg max-md:rounded border border-black bg-black px-3 max-md:px-1.5 text-sm max-md:text-[10px] max-md:leading-tight font-semibold text-white hover:bg-black/90 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
                                title={t("episodes.card.view")}
                              >
                                <ExternalLink className="size-4 max-md:size-3 shrink-0" />
                                <span className="min-w-0 max-w-none max-md:truncate">{t("episodes.card.view")}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditEpisode(ep);
                                }}
                                className="inline-flex h-9 min-h-9 max-md:h-7 max-md:min-h-7 min-w-0 w-auto max-w-full shrink-0 grow-0 items-center justify-center gap-1.5 max-md:gap-0.5 rounded-lg max-md:rounded border border-black/10 px-3 max-md:px-1.5 text-sm max-md:text-[10px] max-md:leading-tight font-semibold hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                                title={ep.hasEditDraft ? "Continue Editing" : t("episodes.card.edit")}
                              >
                                <Pencil className="size-4 max-md:size-3 shrink-0" />
                                <span className="min-w-0 max-w-none max-md:truncate">
                                  {ep.hasEditDraft ? "Continue Editing" : t("episodes.card.edit")}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePlayEpisode(ep);
                                }}
                                disabled={!(ep.audioKey || resolveAudioUrl(ep.audioUrl))}
                                className="inline-flex h-9 min-h-9 max-md:h-7 max-md:min-h-7 min-w-0 w-auto max-w-full shrink-0 grow-0 items-center justify-center gap-1.5 max-md:gap-0.5 rounded-lg max-md:rounded border border-black/10 px-3 max-md:px-1.5 text-sm max-md:text-[10px] max-md:leading-tight font-semibold hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
                                title={activeAudioId === ep.id && isPlaying ? t("episodes.card.pause") : t("episodes.card.play")}
                              >
                                {activeAudioId === ep.id && isPlaying ? (
                                  <Pause className="size-4 max-md:size-3 shrink-0" />
                                ) : (
                                  <Play className="size-4 max-md:size-3 shrink-0" />
                                )}
                                <span className="min-w-0 max-w-none max-md:truncate">
                                  {activeAudioId === ep.id && isPlaying ? t("episodes.card.pause") : t("episodes.card.play")}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestDeleteEpisode(ep);
                                }}
                                className="inline-flex h-9 min-h-9 max-md:h-7 max-md:min-h-7 min-w-0 w-auto max-w-full shrink-0 grow-0 items-center justify-center gap-1.5 max-md:gap-0.5 rounded-lg max-md:rounded border border-red-200 px-3 max-md:px-1.5 text-sm max-md:text-[10px] max-md:leading-tight font-semibold text-red-600 hover:bg-red-50 dark:border-red-400/30 dark:text-red-300 dark:hover:bg-red-900/20"
                                title={t("episodes.deleteEpisode")}
                              >
                                <Trash2 className="size-4 max-md:size-3 shrink-0" />
                                <span className="min-w-0 max-w-none max-md:truncate">{t("episodes.deleteEpisode")}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      {pendingDeleteEpisode && (
        <div className="wecast-overlay grid place-items-center bg-black/70 p-4 backdrop-blur-sm sm:p-5">
          <div className="w-[min(92vw,480px)] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl p-5 md:p-6">
            <div className="flex items-center gap-3 md:gap-4">
              <img
                src="/logo.png"
                alt="WeCast logo"
                className="h-12 w-12 rounded-full object-contain animate-[spin_6s_linear_infinite]"
              />
              <div>
                <h2 className="font-extrabold text-black dark:text-white">
                  {t("episodes.modal.deleteTitle")}
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  {t("episodes.modal.deleteBody")}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-black/70 dark:text-white/70 md:mt-5">
              {t("episodes.modal.deletePrompt", { title: pendingDeleteEpisode.title })}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5 md:mt-6 md:gap-3">
              <button
                type="button"
                onClick={() => setPendingDeleteEpisode(null)}
                className="px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                {t("episodes.modal.cancel")}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = pendingDeleteEpisode;
                  setPendingDeleteEpisode(null);
                  await moveEpisodeToRecycleBin(target);
                }}
                className="px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-400/30 bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition"
              >
                {t("episodes.recycle.moveAction")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
