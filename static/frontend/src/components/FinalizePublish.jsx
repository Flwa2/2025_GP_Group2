import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image as ImageIcon,
  Upload,
  Wand2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Eye,
  Save,
  Loader2,
  PencilLine,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const msg =
      (data && data.error) ||
      (typeof data === "string" && !data.trim().startsWith("<") ? data : "Request failed");
    throw new Error(msg);
  }

  return data;
}

function Notice({ notice, noticeType }) {
  if (!notice) return null;

  const styles = {
    error:
      "border border-red-200 bg-red-50 text-red-900 dark:border-transparent dark:bg-[#232334] dark:text-slate-200",
    warn:
      "border border-amber-200 bg-amber-50 text-amber-950 dark:border-transparent dark:bg-[#232334] dark:text-slate-200",
    success:
      "border border-purple-200 bg-purple-50 text-purple-900 dark:border-transparent dark:bg-purple-500/10 dark:text-purple-200",
    info:
      "border border-neutral-200 bg-neutral-50 text-neutral-800 dark:border-transparent dark:bg-[#232334] dark:text-slate-200",
  };

  return (
    <div
      className={`mb-6 flex items-start gap-3 rounded-2xl px-4 py-3 ${styles[noticeType] || styles.info}`}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-purple-600 dark:text-purple-300" />
      <p className="text-sm font-medium">{notice}</p>
    </div>
  );
}

export default function FinalizePublish() {
  const hash = window.location.hash;
  const query = hash.split("?")[1] || "";
  const params = new URLSearchParams(query);
  const podcastId = params.get("podcastId");

  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("info");

  const [title, setTitle] = useState("");
  const [savedTitle, setSavedTitle] = useState("");

  const [coverB64, setCoverB64] = useState(null);
  const [coverMime, setCoverMime] = useState("image/png");
  const [coverMeta, setCoverMeta] = useState({});

  const hasUnsavedTitle = title.trim() !== savedTitle.trim();
  const hasCover = !!coverB64;

  const coverSrc = useMemo(() => {
    if (!coverB64) return null;
    return `data:${coverMime};base64,${coverB64}`;
  }, [coverB64, coverMime]);

  async function loadFinalize() {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/podcasts/${podcastId}/finalize`);
      setTitle(data.title || "");
      setSavedTitle(data.title || "");

      setCoverB64(data.coverArtBase64 || null);
      const meta = data.coverArtMeta || {};
      setCoverMeta(meta);
      setCoverMime(meta.mimeType || "image/png");
    } catch (e) {
      setNotice(e?.message || "Failed to load page.");
      setNoticeType("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!podcastId) return;
    loadFinalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podcastId]);

  async function saveTitleRecommended() {
    const nextTitle = title.trim();

    if (!nextTitle) {
      setNotice("Title cannot be empty.");
      setNoticeType("error");
      return;
    }

    setBusy(true);
    setBusyText("Saving title...");
    try {
      await apiFetch(`/api/podcasts/${podcastId}/title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });

      setTitle(nextTitle);
      setSavedTitle(nextTitle);
      setNotice("Title saved successfully.");
      setNoticeType("success");
    } catch (e) {
      setNotice(e?.message || "Failed to save title.");
      setNoticeType("error");
    } finally {
      setBusy(false);
      setBusyText("");
    }
  }

  async function generateCover() {
    setBusy(true);
    setBusyText(hasCover ? "Regenerating cover art..." : "Generating cover art...");
    try {
      const resp = await apiFetch(`/api/podcasts/${podcastId}/cover/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });

      setCoverB64(resp.coverArtBase64);
      setCoverMime("image/png");
      setCoverMeta({ source: "AI generated" });

      if (resp.warning) {
        setNotice(resp.warning);
        setNoticeType("warn");
      } else {
        setNotice("Cover art generated and saved.");
        setNoticeType("success");
      }
    } catch (e) {
      setNotice(e?.message || "Failed to generate cover.");
      setNoticeType("error");
    } finally {
      setBusy(false);
      setBusyText("");
    }
  }

  async function clearCover() {
    setBusy(true);
    setBusyText("Removing cover art...");
    try {
      await apiFetch(`/api/podcasts/${podcastId}/cover/clear`, {
        method: "POST",
      });

      setCoverB64(null);
      setCoverMeta({});
      setCoverMime("image/png");
      setNotice("Cover art removed.");
      setNoticeType("info");
    } catch (e) {
      setNotice(e?.message || "Failed to clear cover.");
      setNoticeType("error");
    } finally {
      setBusy(false);
      setBusyText("");
    }
  }

  async function uploadCover(file) {
    if (!file) return;

    setBusy(true);
    setBusyText("Uploading cover art...");
    try {
      const fd = new FormData();
      fd.append("file", file);

      const resp = await apiFetch(`/api/podcasts/${podcastId}/cover/upload`, {
        method: "POST",
        body: fd,
      });

      setCoverB64(resp.coverArtBase64);
      setCoverMime(resp.mimeType || "image/png");
      setCoverMeta(resp.meta || { source: "Uploaded" });

      if (resp.warning) {
        setNotice(resp.warning);
        setNoticeType("warn");
      } else {
        setNotice("Cover art uploaded and saved.");
        setNoticeType("success");
      }
    } catch (e) {
      setNotice(e?.message || "Failed to upload cover.");
      setNoticeType("error");
    } finally {
      setBusy(false);
      setBusyText("");
    }
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    uploadCover(file);
    e.target.value = "";
  }

  function goToEpisode() {
    window.location.hash = `#/preview?id=${podcastId}`;
  }

  if (!podcastId) {
    return (
      <div className="w-full bg-cream px-6 pt-4 pb-4 text-neutral-900 dark:bg-[linear-gradient(to_bottom,_#0f0f14,_#171821)] dark:text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-neutral-200 bg-white p-6 text-neutral-700 shadow-sm dark:border-transparent dark:bg-[#171821] dark:text-slate-200 dark:shadow-none">
          Missing podcastId in URL.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full bg-cream px-6 pt-4 pb-4 text-neutral-900 dark:bg-[linear-gradient(to_bottom,_#0f0f14,_#171821)] dark:text-white">
        <div className="mx-auto max-w-6xl rounded-[28px] border border-neutral-200/90 bg-white p-8 shadow-md dark:border-transparent dark:bg-[#171821] dark:shadow-[0_18px_48px_rgba(0,0,0,0.26)]">
          <div className="mb-5 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-purple-600 dark:text-purple-300" />
            <span className="text-sm font-medium text-neutral-700 dark:text-slate-200">
              Loading cover art workspace...
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-purple-100 dark:bg-[#232334]">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-purple-600 to-purple-300" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-none bg-cream pb-0 text-neutral-900 transition-colors dark:bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.12),_transparent_28%),linear-gradient(to_bottom,_#0f0f14,_#171821)] dark:text-white"
    >
      {/* Full-bleed glass: no max-width, no horizontal page padding (avoids beige side gutters) */}
      <div className="w-full max-w-none min-w-0 border-y border-white/30 bg-[rgba(255,255,255,0.68)] shadow-[0_12px_48px_-16px_rgba(15,23,42,0.1)] backdrop-blur-[14px] dark:border-transparent dark:bg-transparent dark:shadow-none dark:backdrop-blur-none">
        <div className="w-full max-w-none min-w-0 px-5 pt-4 pb-4 sm:px-8 sm:pt-5 sm:pb-5 lg:px-10 lg:pt-6 lg:pb-6">
        <Notice notice={notice} noticeType={noticeType} />

          {/* Hero */}
          <div className="mb-6 border-b border-white/25 pb-6 dark:mb-8 dark:rounded-[32px] dark:border-0 dark:bg-[#171821]/82 dark:p-6 dark:pb-8 dark:shadow-[0_18px_48px_rgba(0,0,0,0.26)] dark:backdrop-blur md:dark:p-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-200/80 bg-purple-50/90 px-3 py-1 text-sm font-medium text-purple-800 backdrop-blur-sm dark:border-transparent dark:bg-purple-500/10 dark:text-purple-200">
              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-300" />
              Final design step
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-black tracking-tight text-neutral-900 md:text-6xl dark:text-white">
                  Cover Art &amp; Details
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600 md:text-lg dark:text-[#A0A0A0]">
                  Create a polished first impression for your episode by generating
                  or uploading cover art and refining the title before preview.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {hasUnsavedTitle && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/35 px-3 py-2 text-sm font-medium text-neutral-700 backdrop-blur-sm dark:border-transparent dark:bg-white/10 dark:text-slate-300">
                    <PencilLine className="h-4 w-4 text-neutral-600 dark:text-slate-400" />
                    Unsaved title changes
                  </div>
                )}

                {hasCover && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-purple-200/70 bg-purple-50/80 px-3 py-2 text-sm font-medium text-purple-800 backdrop-blur-sm dark:border-transparent dark:bg-purple-500/10 dark:text-purple-200">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                    Cover ready
                  </div>
                )}
              </div>
            </div>
          </div>

          {busy && (
            <div className="mb-6 rounded-2xl border border-white/30 bg-[rgba(255,255,255,0.45)] px-4 py-4 shadow-sm backdrop-blur-md dark:border-transparent dark:bg-[#171821]/82 dark:shadow-none dark:backdrop-blur">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-slate-200">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-300" />
                {busyText || "Working..."}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-purple-100/90 dark:bg-white/10">
                <div className="h-full w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-purple-500 via-purple-300 to-purple-500" />
              </div>
              <style>{`
              @keyframes shimmer {
                0% { transform: translateX(-120%); }
                100% { transform: translateX(320%); }
              }
            `}</style>
            </div>
          )}

          <div className="grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <section className="rounded-[28px] border border-purple-300/35 bg-[rgba(255,255,255,0.42)] p-5 shadow-sm backdrop-blur-sm md:p-6 dark:rounded-[30px] dark:border-purple-400/20 dark:bg-[#171821] dark:shadow-[0_18px_46px_rgba(88,28,135,0.18)] dark:backdrop-blur-none">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Cover Art
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-[#A0A0A0]">
                  Recommended size: at least 512 × 512
                </p>
              </div>

              {coverMeta?.source && (
                <span className="rounded-full border border-white/35 bg-white/40 px-3 py-1 text-xs font-medium text-neutral-700 backdrop-blur-sm dark:border-transparent dark:bg-[#232334] dark:text-slate-300">
                  {coverMeta.source}
                </span>
              )}
            </div>

            <div className="group relative overflow-hidden rounded-[24px] border border-white/25 bg-gradient-to-br from-white/50 via-purple-50/25 to-white/30 dark:border-transparent dark:from-[#202030] dark:to-[#242438]">
              <div className="aspect-square w-full xl:aspect-auto">
                {coverSrc ? (
                  <img
                    src={coverSrc}
                    alt="Cover Art"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02] xl:h-auto xl:object-contain"
                  />
                ) : (
                  <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-8 py-10 text-center sm:min-h-0">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/35 bg-white/45 backdrop-blur-sm dark:border-transparent dark:bg-[#2b2b40]">
                      <ImageIcon className="h-9 w-9 text-purple-400 dark:text-slate-400" />
                    </div>
                    <h3 className="text-2xl font-semibold text-neutral-900 dark:text-white">
                      No cover art yet
                    </h3>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-neutral-600 dark:text-[#A0A0A0]">
                      Generate an AI cover or upload your own image to give the
                      episode a polished visual identity.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                onClick={generateCover}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-purple-500/20 transition hover:bg-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Wand2 className="h-4 w-4" />
                {coverSrc ? "Regenerate" : "Generate"}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white/40 px-4 py-3 text-sm font-semibold text-neutral-800 backdrop-blur-sm transition hover:bg-white/55 disabled:cursor-not-allowed disabled:opacity-60 dark:border-transparent dark:bg-[#232334] dark:text-slate-200 dark:hover:bg-[#2b2b40]"
              >
                <Upload className="h-4 w-4" />
                Upload
              </button>

              <button
                onClick={clearCover}
                disabled={busy || !coverSrc}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white/40 px-4 py-3 text-sm font-semibold text-neutral-700 backdrop-blur-sm transition hover:bg-white/55 disabled:cursor-not-allowed disabled:opacity-50 dark:border-transparent dark:bg-[#232334] dark:text-slate-300 dark:hover:bg-[#2b2b40]"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={onFileChange}
                hidden
              />
            </div>
          </section>

            <section className="rounded-[28px] border border-purple-300/35 bg-[rgba(255,255,255,0.36)] p-5 shadow-sm backdrop-blur-sm md:p-6 dark:rounded-[30px] dark:border-purple-400/20 dark:bg-[#171821] dark:shadow-[0_18px_46px_rgba(88,28,135,0.14)] dark:backdrop-blur-none">
            <div className="grid gap-6">
              <div className="rounded-[22px] bg-[rgba(255,255,255,0.38)] p-5 ring-1 ring-white/25 backdrop-blur-sm dark:bg-[#202030] dark:ring-0">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                      Episode Title
                    </h2>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-[#A0A0A0]">
                      Keep it clear, memorable, and aligned with the episode theme.
                    </p>
                  </div>

                  {hasUnsavedTitle ? (
                    <span className="rounded-full border border-white/35 bg-white/45 px-3 py-1 text-xs font-semibold text-neutral-700 backdrop-blur-sm dark:border-transparent dark:bg-[#2b2b40] dark:text-slate-300">
                      Unsaved
                    </span>
                  ) : (
                    <span className="rounded-full border border-purple-200/80 bg-purple-50/85 px-3 py-1 text-xs font-semibold text-purple-800 backdrop-blur-sm dark:border-transparent dark:bg-purple-500/10 dark:text-purple-200">
                      Saved
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter episode title"
                    className="w-full rounded-2xl border border-white/40 bg-[rgba(255,255,255,0.55)] px-4 py-4 text-lg font-medium text-neutral-900 outline-none backdrop-blur-sm transition placeholder:text-neutral-500 focus:border-purple-300/80 focus:ring-4 focus:ring-purple-500/20 dark:border-transparent dark:bg-[#171821] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-transparent dark:focus:bg-[#1b1b28]"
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={saveTitleRecommended}
                      disabled={busy || !title.trim() || !hasUnsavedTitle}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-purple-500/20 transition hover:bg-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Save className="h-4 w-4" />
                      Save Title
                    </button>

                    <p className="text-sm text-neutral-600 dark:text-[#A0A0A0]">
                      Good titles are usually short and easy to scan.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] bg-[rgba(255,255,255,0.38)] p-5 text-neutral-900 ring-1 ring-white/25 backdrop-blur-sm dark:bg-[#202030] dark:text-white dark:ring-0">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Ready to preview?</h3>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-600 dark:text-[#A0A0A0]">
                    Open the episode preview to see the title, cover art, and full
                    result together before continuing.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={goToEpisode}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-purple-500/20 transition hover:bg-purple-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Eye className="h-4 w-4" />
                    Preview Episode
                  </button>
                </div>
              </div>
            </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
