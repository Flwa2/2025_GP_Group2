import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || ""; // "" if same-origin proxy

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include", // IMPORTANT for Flask session
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = (data && data.error) || (typeof data === "string" ? data : "Request failed");
    throw new Error(msg);
  }
  return data;
}

export default function FinalizePublish() {
    const hash = window.location.hash; 
    const query = hash.split("?")[1] || "";
    const params = new URLSearchParams(query);
    const podcastId = params.get("podcastId");

if (!podcastId) {
    return (
      <div style={{ padding: 24 }}>
        Missing podcastId in URL.
      </div>
    );
}

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("info");

  const [title, setTitle] = useState("");
  const [savedTitle, setSavedTitle] = useState("");

  const [coverB64, setCoverB64] = useState(null);
  const [coverMime, setCoverMime] = useState("image/png"); // generated covers assumed png
  const [coverMeta, setCoverMeta] = useState({});

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

      // If user uploaded, meta.mimeType should exist.
      setCoverMime(meta.mimeType || "image/png");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!podcastId) return;
    loadFinalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podcastId]);

  async function saveTitle() {
    if (!title.trim()) throw new Error("Title cannot be empty");
    setBusy(true);
    try {
      // your backend uses show_title in /api/edit/save
      const resp = await apiFetch("/api/edit/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edited_script: " ", show_title: title.trim() }), // see note below
      });
      // ⚠️ NOTE: your /api/edit/save requires edited_script to be non-empty.
      // Better approach: create a dedicated title endpoint.
      // For now, I’ll show the correct implementation below (Option B).
      setSavedTitle(resp.title || title.trim());
    } finally {
      setBusy(false);
    }
  }

  // ✅ Option B (recommended): create a tiny backend endpoint for title only.
  // If you already created /api/podcasts/<id>/title, use this instead:
  async function saveTitleRecommended() {
    if (!title.trim()) throw new Error("Title cannot be empty");
    setBusy(true);
    try {
      const resp = await apiFetch(`/api/podcasts/${podcastId}/title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      setSavedTitle(resp.title || title.trim());
    } finally { setBusy(false); setBusyText(""); }
  }

  async function generateCover() {
    setBusy(true);
    try {
      const resp = await apiFetch(`/api/podcasts/${podcastId}/cover/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      setCoverB64(resp.coverArtBase64);
      setCoverMime("image/png");
      setCoverMeta({ source: "openai" });
      if (resp.warning) {
        setNotice(resp.warning);
        setNoticeType("warn");
      } else {
        setNotice("Cover generated and saved.");
        setNoticeType("success");
      }
    } catch (e) {
      setNotice(e?.message || "Failed to generate cover.");
      setNoticeType("error");
    } finally { setBusy(false); setBusyText(""); }
  }

  async function clearCover() {
    setBusy(true);
    try {
      await apiFetch(`/api/podcasts/${podcastId}/cover/clear`, { method: "POST" });
      setCoverB64(null);
      setCoverMeta({});
      setCoverMime("image/png");
      setNotice("Cover cleared.");
      setNoticeType("info");
    } catch (e) {
      setNotice(e?.message || "Failed to clear cover.");
      setNoticeType("error");
    } finally {
      setBusy(false);
    }
  }

  async function uploadCover(file) {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const resp = await apiFetch(`/api/podcasts/${podcastId}/cover/upload`, {
        method: "POST",
        body: fd,
      });

      setCoverB64(resp.coverArtBase64);
      setCoverMime(resp.mimeType || "image/png"); // from backend
      setCoverMeta(resp.meta || {});
      if (resp.warning) {
        setNotice(resp.warning);
        setNoticeType("warn");
      } else {
        setNotice("Cover uploaded and saved.");
        setNoticeType("success");
      }
    } catch (e) {
      setNotice(e?.message || "Failed to upload cover.");
      setNoticeType("error");
    } finally { setBusy(false); setBusyText(""); }
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    uploadCover(file);
    e.target.value = "";
  }

  function goToEpisode() {
  window.location.hash = `#/preview?id=${podcastId}`;
}

  if (loading) {
    return <div style={{ padding: 24 }}>Loading finalize…</div>;
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1 className="text-4xl md:text-5xl font-extrabold text-black mb-2">
        Finalize &amp; Publish
      </h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Generate or upload cover art, and edit the episode title.
      </p>
      {notice && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid",
            borderColor:
              noticeType === "error" ? "#fecaca" :
              noticeType === "warn" ? "#fde68a" :
              noticeType === "success" ? "#bbf7d0" : "#e5e7eb",
            background:
              noticeType === "error" ? "#fef2f2" :
              noticeType === "warn" ? "#fffbeb" :
              noticeType === "success" ? "#f0fdf4" : "#f9fafb",
            color:
              noticeType === "error" ? "#991b1b" :
              noticeType === "warn" ? "#92400e" :
              noticeType === "success" ? "#166534" : "#111827",
            fontSize: 14,
          }}
        >
          {notice}
        </div>
      )}

        {busy && (
        <div className="mb-6">
            <div className="text-sm text-black/70 dark:text-white/70 mb-2">
            {busyText || "Working..."}
            </div>
            <div className="h-2 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div className="h-full w-1/3 bg-purple-600 animate-[shimmer_1.2s_ease_infinite]" />
            </div>
            <style>{`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
        </div>
        )}
      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 24 }}>
        {/* Cover section */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, padding: 16 }}>
          <div
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              borderRadius: 16,
              overflow: "hidden",
              background: "#f5f5f5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            {coverSrc ? (
              <img src={coverSrc} alt="Cover Art" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ textAlign: "center", padding: 16, opacity: 0.75 }}>
                No cover yet
                <div style={{ fontSize: 12, marginTop: 6 }}>Generate or upload (min 512×512)</div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={generateCover} disabled={busy} style={btn}>
              {coverSrc ? "Regenerate" : "Generate"}
            </button>

            <label style={{ ...btn, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>
              Upload
              <input type="file" accept="image/png,image/jpeg" onChange={onFileChange} disabled={busy} hidden />
            </label>

            <button onClick={clearCover} disabled={busy || !coverSrc} style={btnSecondary}>
              Clear
            </button>
          </div>

          {!!coverMeta?.source && (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Source: {coverMeta.source}
            </div>
          )}
        </div>

        {/* Title + actions */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 16, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Episode Title</h3>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Episode title"
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 12,
              border: "1px solid #ddd",
              fontSize: 16,
              marginBottom: 10,
            }}
          />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Use saveTitleRecommended if you add the tiny backend endpoint */}
            <button
              onClick={saveTitleRecommended}
              disabled={busy || title.trim() === savedTitle.trim() || !title.trim()}
              style={btn}
              title="Save the title"
            >
              Save Title
            </button>

            {title.trim() !== savedTitle.trim() && (
              <span style={{ fontSize: 12, opacity: 0.7 }}>Unsaved changes</span>
            )}
          </div>

          <hr style={{ margin: "16px 0" }} />

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={goToEpisode} disabled={busy} style={btn}>
              View Episode
            </button>

            
          </div>

          
        </div>
      </div>
    </div>
  );
}

const btn = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #ddd",
  background: "white",
};

const btnSecondary = {
  ...btn,
  background: "#f7f7f7",
};
