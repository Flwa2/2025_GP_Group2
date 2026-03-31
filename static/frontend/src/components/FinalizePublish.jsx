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
      (typeof data === "string" ? data : "Request failed");
    throw new Error(msg);
  }

  return data;
}

function Notice({ notice, noticeType }) {
  if (!notice) return null;

  const styles = {
    error:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300",
    warn:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    info:
      "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200",
  };

  return (
    <div
      className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-sm ${styles[noticeType] || styles.info}`}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
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
    if (!title.trim()) {
      setNotice("Title cannot be empty.");
      setNoticeType("error");
      return;
    }

    setBusy(true);
    setBusyText("Saving title...");
    try {
      const resp = await apiFetch(`/api/podcasts/${podcastId}/title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });

      setSavedTitle(resp.title || title.trim());
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
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          Missing podcastId in URL.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-[28px] border border-black/5 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="mb-5 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Loading cover art workspace...
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.14),_transparent_30%),linear-gradient(to_bottom,_#f8f4e8,_#f7f2e3)] px-4 py-8 transition-colors sm:px-6 lg:px-8 dark:bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.16),_transparent_25%),linear-gradient(to_bottom,_#0f0f14,_#171821)]">
      <div className="mx-auto max-w-7xl">
        <Notice notice={notice} noticeType={noticeType} />

        <div className="mb-8 rounded-[32px] border border-black/5 bg-white/60 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] md:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-sm font-medium text-purple-700 dark:border-purple-500/20 dark:bg-purple-500/10 dark:text-purple-300">
            <Sparkles className="h-4 w-4" />
            Final design step
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white md:text-6xl">
                Cover Art &amp; Details
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 md:text-lg">
                Create a polished first impression for your episode by generating
                or uploading cover art and refining the title before preview.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {hasUnsavedTitle && (
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                  <PencilLine className="h-4 w-4" />
                  Unsaved title changes
                </div>
              )}

              {hasCover && (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Cover ready
                </div>
              )}
            </div>
          </div>
        </div>

        {busy && (
          <div className="mb-6 rounded-2xl border border-black/5 bg-white/70 px-4 py-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <Loader2 className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" />
              {busyText || "Working..."}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div className="h-full w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-500" />
            </div>
            <style>{`
              @keyframes shimmer {
                0% { transform: translateX(-120%); }
                100% { transform: translateX(320%); }
              }
            `}</style>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-[30px] border border-black/5 bg-white/70 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Cover Art
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Recommended size: at least 512 × 512
                </p>
              </div>

              {coverMeta?.source && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  {coverMeta.source}
                </span>
              )}
            </div>

            <div className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-100 to-slate-50 shadow-inner dark:border-white/10 dark:from-white/10 dark:to-white/5">
              <div className="aspect-square w-full">
                {coverSrc ? (
                  <img
                    src={coverSrc}
                    alt="Cover Art"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                    <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm dark:bg-white/10 dark:shadow-none">
                      <ImageIcon className="h-9 w-9 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-2xl font-semibold text-slate-700 dark:text-slate-100">
                      No cover art yet
                    </h3>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">
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
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-purple-500 dark:hover:bg-purple-400"
              >
                <Wand2 className="h-4 w-4" />
                {coverSrc ? "Regenerate" : "Generate"}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              >
                <Upload className="h-4 w-4" />
                Upload
              </button>

              <button
                onClick={clearCover}
                disabled={busy || !coverSrc}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
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

          <section className="rounded-[30px] border border-black/5 bg-white/70 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)] md:p-6">
            <div className="grid gap-6">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      Episode Title
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Keep it clear, memorable, and aligned with the episode theme.
                    </p>
                  </div>

                  {hasUnsavedTitle ? (
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      Unsaved
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      Saved
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter episode title"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-purple-400 dark:focus:bg-white/10 dark:focus:ring-purple-500/20"
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={saveTitleRecommended}
                      disabled={busy || !title.trim() || !hasUnsavedTitle}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-purple-500 dark:hover:bg-purple-400"
                    >
                      <Save className="h-4 w-4" />
                      Save Title
                    </button>

                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Good titles are usually short and easy to scan.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white shadow-sm dark:border-white/10 dark:from-[#181825] dark:to-[#11111b]">
                <div className="mb-4">
                  <h3 className="text-xl font-bold">Ready to preview?</h3>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-slate-300">
                    Open the episode preview to see the title, cover art, and full
                    result together before continuing.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={goToEpisode}
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-purple-500 dark:text-white dark:hover:bg-purple-400"
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
  );
}