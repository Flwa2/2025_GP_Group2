import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Mic2, Download, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { exportScriptPdf } from "../utils/exportScriptPdf";
import { exportScriptTxt } from "../utils/exportScriptTxt";

const API_BASE = import.meta.env.PROD
  ? "https://wecast.onrender.com"
  : "http://localhost:5000";

const getPortalTarget = () => {
  if (typeof document === "undefined") return null;
  return document.body && document.body.nodeType === 1 ? document.body : null;
};

function readEditData() {
  try {
    return JSON.parse(sessionStorage.getItem("editData") || "{}");
  } catch {
    return {};
  }
}

function authHeaders() {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** Persists script + title to Firestore edit draft when we have a podcast id (create / episodes flow). */
async function syncEditScriptDraftToServer(content, showTitle) {
  const editData = readEditData();
  const podcastId = String(editData.podcastId || "").trim();
  if (!podcastId) {
    return { ok: true, localOnly: true };
  }

  const title =
    String(showTitle || "").trim() ||
    String(editData.showTitle || editData.episodeTitle || "").trim() ||
    "Podcast Show";

  const r = await fetch(
    `${API_BASE}/api/podcast/${encodeURIComponent(podcastId)}/update`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        mode: "draft",
        script: content,
        showTitle: title,
        speakers: Array.isArray(editData.speakers) ? editData.speakers : [],
        introMusic: editData.introMusic || "",
        bodyMusic: editData.bodyMusic || "",
        outroMusic: editData.outroMusic || "",
        category: editData.category || "",
        description: editData.description || "",
        scriptStyle: editData.scriptStyle || "",
      }),
    }
  );

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    return {
      ok: false,
      error: data.error || `Save failed (${r.status})`,
    };
  }
  return { ok: true, localOnly: false };
}

function resolveEditorDraft(source = {}) {
  const show =
    String(source.showTitle || "").trim() ||
    String(source.episodeTitle || "").trim() ||
    String(source.title || "").trim() ||
    "Podcast Show";

  const directScript =
    String(source.currentScript || "").trim() ||
    String(source.generatedScript || "").trim() ||
    String(source.scriptText || "").trim() ||
    String(source.editedScript || "").trim();

  const template =
    String(source.scriptTemplate || "").trim() ||
    String(source.script || "").trim();

  const content = directScript || (
    template.includes("{{SHOW_TITLE}}")
      ? template.replaceAll("{{SHOW_TITLE}}", show)
      : template
  );

  return { content, show, template: directScript ? "" : template };
}

/* -------------------- overlay: rotating logo -------------------- */
function LoadingOverlay({ show, logoSrc = "/logo.png" }) {
  if (!show) return null;
  const overlay = (
    <div
      className="wecast-overlay grid place-items-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-[min(92vw,480px)] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl p-6">
        <div className="flex items-center gap-4">
          <img
            src={logoSrc}
            alt="WeCast logo"
            className="w-12 h-12 rounded-full animate-[spin_6s_linear_infinite]"
          />
          <div>
            <p className="font-extrabold text-black dark:text-white">
              Exporting your script…
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Your PDF is being generated. Please wait a moment.
            </p>
          </div>
        </div>
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div className="h-full w-1/3 animate-[shimmer_1.2s_ease_infinite] bg-gradient-to-r from-pink-400 via-purple-400 to-pink-400" />
        </div>
      </div>

      <style>
        {`@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}
      </style>
    </div>
  );
  const portalTarget = getPortalTarget();
  return portalTarget ? createPortal(overlay, portalTarget) : overlay;
}

/* -------------------- stepper components -------------------- */
function StepDot({ n, label, active = false, done = false }) {
  const state = active ? "active" : done ? "done" : "pending";
  const dot = state === "active" ? "bg-purple-600 text-white shadow" :
    state === "done" ? "bg-neutral-300 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200" :
      "bg-black/10 dark:bg-white/10 text-black/70 dark:text-white/70";
  const labelCls = state === "active" ? "text-purple-600" :
    state === "done" ? "text-neutral-500 dark:text-neutral-400" :
      "text-black/60 dark:text-white/60";
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3" title={label} aria-label={`Step ${n}: ${label}`}>
      <div className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold sm:h-8 sm:w-8 sm:text-sm ${active ? "ring-2 ring-purple-300/70 ring-offset-1 ring-offset-white dark:ring-offset-neutral-950" : ""} ${dot}`}>
        {n}
      </div>
      <div className={`hidden text-sm font-semibold sm:block ${labelCls}`}>{label}</div>
    </div>
  );
}

const StepLine = ({ on }) => (
  <div className={`h-0.5 min-w-0 flex-1 rounded-full sm:h-[3px] ${on ? "bg-gradient-to-r from-purple-600 to-pink-500" : "bg-black/10 dark:bg-white/10"}`} />
);

export default function EditScript() {
  const [script, setScript] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveMsg, setSaveMsg] = useState("Not saved yet");
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [scriptTemplate, setScriptTemplate] = useState("");
  const [showTitle, setShowTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [titleJustUpdated, setTitleJustUpdated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [lastSavedScript, setLastSavedScript] = useState("");
  const [lastSavedTitle, setLastSavedTitle] = useState(""); // Track last saved title
  const [scriptStyle, setScriptStyle] = useState("");
  
  const isAuthenticated = () =>
    !!(localStorage.getItem("token") || sessionStorage.getItem("token"));

  const lastValidRef = useRef("");
  const textareaRef = useRef(null);
  const titleInputRef = useRef(null);

  useEffect(() => {
    const editData = readEditData();
    if (editData.scriptStyle) {
      setScriptStyle(editData.scriptStyle);
    }
  }, []);

  // Update hasUnsavedChanges to include title changes
  const hasUnsavedChanges = useMemo(() => {
    return script.trim() !== lastSavedScript.trim() || showTitle !== lastSavedTitle;
  }, [script, lastSavedScript, showTitle, lastSavedTitle]);

  const exportScript = async (format = "pdf") => {
    try {
      // Check for unsaved changes first
      if (hasUnsavedChanges) {
        setToastMsg("Please save your changes before exporting");
        setTimeout(() => setToastMsg(""), 3000);
        return;
      }

      setExporting(true);
      
      let scriptContent = script.trim();
      let title = showTitle || "Podcast Script";
      
      // Only try to fetch from API if authenticated AND we don't have content
      if (isAuthenticated() && !scriptContent) {
        try {
          const response = await fetch(`${API_BASE}/api/draft`, { 
            credentials: "include" 
          });
          if (response.ok) {
            const data = await response.json();
            if (data.script) {
              scriptContent = data.script.replaceAll("{{SHOW_TITLE}}", data.show_title || title);
              title = data.show_title || data.title || title;
            }
          }
        } catch (error) {
          console.error("Error fetching latest script:", error);
          // Don't fail here, continue with what we have
        }
      }
      
      if (!scriptContent) {
        setToastMsg("No script content to export!");
        setTimeout(() => setToastMsg(""), 3000);
        setExporting(false);
        return;
      }

      const exportHandler = format === "txt" ? exportScriptTxt : exportScriptPdf;

      await exportHandler({
        scriptContent,
        title,
        scriptStyle,
        fileNameBase: title,
      });
      
      setToastMsg(`Script exported as ${format.toUpperCase()} successfully!`);
      setTimeout(() => setToastMsg(""), 3000);
      
    } catch (error) {
      console.error("Error exporting script:", error);
      setToastMsg("Failed to export script. Please try again.");
      setTimeout(() => setToastMsg(""), 3000);
    } finally {
      setExporting(false);
    }
  };

  const handleScriptChange = (e) => {
    const next = e.target.value;
    const prev = script;

    const musicRegex = /\[music\]/gi;
    const prevMusicCount = (prev.match(musicRegex) || []).length;
    const nextMusicCount = (next.match(musicRegex) || []).length;

    if (nextMusicCount < prevMusicCount) {
      setScript(lastValidRef.current);
      return;
    }

    if (next === "" && script.trim() !== "") {
      setScript(lastValidRef.current);
      setToastMsg("You cannot clear the entire script!");
      setTimeout(() => setToastMsg(""), 3000);
      return;
    }

    if (next.trim() === "") {
      setScript(lastValidRef.current);
      setSaveMsg("You can't clear the entire script.");
      return;
    }

    setScript(next);
    lastValidRef.current = next;

    const placeholder = "{{SHOW_TITLE}}";

    if (showTitle && showTitle.trim().length >= 4) {
      const escaped = showTitle
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(escaped, "g");
      const templated = next.replace(re, placeholder);
      setScriptTemplate(templated);
    } else {
      setScriptTemplate(next);
    }
  };

  const startEditTitle = () => {
    setDraftTitle(showTitle || "Podcast Show");
    setIsEditingTitle(true);
  };

  const cancelEditTitle = () => {
    setDraftTitle(showTitle || "Podcast Show");
    setIsEditingTitle(false);
  };

  const saveTitle = () => {
    const trimmed = draftTitle.trim();
    if (!trimmed) return;

    const placeholder = "{{SHOW_TITLE}}";
    const baseTemplate = scriptTemplate || script || "";

    const updatedVisible = baseTemplate.includes(placeholder)
      ? baseTemplate.replaceAll(placeholder, trimmed)
      : baseTemplate;

    setShowTitle(trimmed);
    setScript(updatedVisible);
    lastValidRef.current = updatedVisible;
    setIsEditingTitle(false);
    
    // Don't update lastSavedTitle here - this keeps it as an unsaved change
    // The user will need to click Save Script to persist both changes
  };

  useEffect(() => {
    if (!isEditingTitle) return;
    const frame = requestAnimationFrame(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
      if (titleInputRef.current) {
        titleInputRef.current.style.height = "auto";
        titleInputRef.current.style.height = `${titleInputRef.current.scrollHeight}px`;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isEditingTitle]);

  useEffect(() => {
    if (!isEditingTitle || !titleInputRef.current) return;
    titleInputRef.current.style.height = "auto";
    titleInputRef.current.style.height = `${titleInputRef.current.scrollHeight}px`;
  }, [draftTitle, isEditingTitle]);

  useEffect(() => {
    if (!showTitle) return;
    setTitleJustUpdated(true);
    const t = setTimeout(() => setTitleJustUpdated(false), 900);
    return () => clearTimeout(t);
  }, [showTitle]);

  useEffect(() => {
    const loadFromSource = (source) => {
      const { content, show, template } = resolveEditorDraft(source);
      if (!content.trim()) return false;

      setScriptTemplate(template);
      setShowTitle(show);
      setScript(content);
      setLastSavedScript(content);
      setLastSavedTitle(show);
      lastValidRef.current = content;
      return true;
    };

    const fromCreate = readEditData();
    if (loadFromSource(fromCreate)) {
      setLoadingDraft(false);
      return;
    }

    const guestDraft = sessionStorage.getItem("guestEditDraft") || "";
    if (guestDraft.trim()) {
      const initial = guestDraft.trim();
      setScript(initial);
      setLastSavedScript(initial);
      lastValidRef.current = initial;
      setLoadingDraft(false);

      sessionStorage.removeItem("guestEditDraft");
      return;

    }
    if (!isAuthenticated()) {
      setShowTitle((prev) => prev || "Podcast Show");
      setLoadingDraft(false);
      return;
    }

    fetch(`${API_BASE}/api/draft`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!loadFromSource({ ...d, showTitle: d.show_title })) {
          setShowTitle("Podcast Show");
          setScript("");
          setLastSavedScript("");
          setLastSavedTitle("Podcast Show");
          lastValidRef.current = "";
        }
      })
      .catch(() => {
        setShowTitle("Podcast Show");
        setSaveMsg("No saved draft was found. Return to Review and try Edit in Editor again.");
      })
      .finally(() => setLoadingDraft(false));

  }, []);

  useEffect(() => {
    const editData = readEditData();
    sessionStorage.setItem('editScriptStyle', editData.scriptStyle || '');
    sessionStorage.setItem('editSpeakersCount', editData.speakersCount || '');
    sessionStorage.setItem('editSpeakers', JSON.stringify(editData.speakers || []));
    sessionStorage.setItem('editDescription', editData.description || '');
  }, []);

  const speakerLabels = useMemo(() => {
    const labels = new Set();
    (script || "").split(/\r?\n/).forEach((ln) => {
      const i = ln.indexOf(":");
      if (i > 0) labels.add(ln.slice(0, i).trim());
    });
    return Array.from(labels);
  }, [script]);

  const getLineMeta = (value, pos) => {
    const lineStart = value.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
    const nextNl = value.indexOf("\n", pos);
    const lineEnd = nextNl === -1 ? value.length : nextNl;
    const colonIdx = value.indexOf(":", lineStart);
    return { lineStart, lineEnd, colonIdx };
  };

  const onKeyDownGuard = (e) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const val = ta.value;
    const { selectionStart: start, selectionEnd: end } = ta;

    const affects =
      e.key.length === 1 ||
      e.key === "Backspace" ||
      e.key === "Delete" ||
      e.key === "Enter" ||
      e.key === "Tab";
    if (!affects) return;

    if ((e.key === "Delete" || e.key === "Backspace") && start === 0 && end === val.length) {
      e.preventDefault();
      setToastMsg("You cannot delete the entire script!");
      setTimeout(() => setToastMsg(""), 3000);
      return;
    }

    const { colonIdx } = getLineMeta(val, start);
    if (colonIdx !== -1) {
      const labelEnd = colonIdx + 1;
      const touchesLabel = start <= labelEnd || end <= labelEnd;
      if (touchesLabel) {
        e.preventDefault();
        const safe =
          val[colonIdx + 1] === " " ? colonIdx + 2 : colonIdx + 1;
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = Math.max(safe, start, end);
        });
      }
    }
  };

  const findEmptySpeakerLine = (text) => {
    if (!text) return -1;

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();

      if (/^([^:：]+)\s*[:：]\s*$/.test(line)) {
        return i;
      }
    }
    return -1;
  };

  const focusEmptySpeakerLine = (text) => {
    const ta = textareaRef.current;
    if (!ta) return;

    const lines = text.split(/\r?\n/);
    const badIndex = findEmptySpeakerLine(text);
    if (badIndex === -1) return;

    let offset = 0;
    for (let i = 0; i < badIndex; i++) {
      offset += lines[i].length + 1;
    }
    offset += lines[badIndex].length;

    ta.focus();
    ta.selectionStart = ta.selectionEnd = offset;
  };

  const persistEditorDraft = (content = script.trim()) => {
    const editData = readEditData();
    const resolvedTitle = showTitle || editData.showTitle || editData.episodeTitle || "Podcast Show";
    const updatedEditData = {
      ...editData,
      currentScript: content,
      generatedScript: content,
      scriptText: content,
      scriptTemplate: "",
      showTitle: resolvedTitle,
      episodeTitle: resolvedTitle,
      fromEdit: true,
      editedAt: new Date().toISOString(),
    };

    sessionStorage.setItem("editData", JSON.stringify(updatedEditData));
    sessionStorage.setItem("forceStep", "4");
    sessionStorage.setItem("currentStep", "4");
    return updatedEditData;
  };

  const save = async () => {
    const content = script.trim();

    if (!content) {
      setSaveMsg("Script is empty.");
      return;
    }

    const badLine = findEmptySpeakerLine(script);
    if (badLine !== -1) {
      setSaveMsg("Each speaker line must include text after the colon.");
      focusEmptySpeakerLine(script);
      return;
    }

    persistEditorDraft(content);
    setScriptTemplate("");
    setLastSavedScript(content);
    setLastSavedTitle(showTitle || "");

    if (!isAuthenticated()) {
      sessionStorage.setItem("guestEditDraft", content);
      setSaveMsg("Saved locally for this episode flow.");
      setToastMsg("Script saved in this draft.");
      setTimeout(() => setToastMsg(""), 3000);
      return;
    }

    setSaving(true);
    setSaveMsg("Saving…");
    try {
      const result = await syncEditScriptDraftToServer(content, showTitle || "");
      if (!result.ok) {
        setSaveMsg(result.error || "Failed to save.");
        return;
      }
      if (result.localOnly) {
        setSaveMsg("Saved locally for this episode flow.");
        setToastMsg("Draft updated in this browser.");
        setTimeout(() => setToastMsg(""), 3000);
        return;
      }
      setSaveMsg("Last saved: " + new Date().toLocaleTimeString());
      setToastMsg("Script saved successfully!");
      setTimeout(() => setToastMsg(""), 3000);
    } catch {
      setSaveMsg("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const navigateToAudio = async () => {
    const trimmed = script.trim();
    if (!trimmed) {
      setSaveMsg("Script is empty.");
      return;
    }

    const badLine = findEmptySpeakerLine(script);
    if (badLine !== -1) {
      setSaveMsg(
        "Each speaker line must include text after the colon."
      );
      focusEmptySpeakerLine(script);
      return;
    }

    const content = trimmed;

    if (content) {
      setSaving(true);
      try {
        const result = await syncEditScriptDraftToServer(content, showTitle || "");
        if (!result.ok) {
          console.error("Failed to save script:", result.error);
        }
        setLastSavedScript(content);
        setLastSavedTitle(showTitle || "");
      } catch (error) {
        console.error("Failed to save script:", error);
      } finally {
        setSaving(false);
      }
    }

    persistEditorDraft(content);
    window.location.hash = "#/create";
  };

  return (
    <div className="min-h-screen bg-cream dark:bg-[#0a0a0a]">
      <LoadingOverlay show={exporting} />
      
      <div className="h-2 bg-purple-gradient" />

      <main className="w-full max-w-[1400px] mx-auto px-4 py-8 sm:px-6 sm:py-10">
       <header className="mb-6 text-center" >
    <h1 className="text-3xl md:text-4xl font-extrabold text-black dark:text-white">
      Review & Edit Script
    </h1>
    <p className="mt-2 text-black/70 dark:text-white/70">
      Review your script, make quick edits, and get it ready for audio.
    </p>
  </header>

        <div className="mb-8 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white/60 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/60 sm:overflow-x-auto sm:p-4">
          <div className="flex w-full min-w-0 items-center gap-1 sm:min-w-max sm:gap-2">
            <StepDot n={1} label="Choose Style" done />
            <StepLine on={true} />

            <StepDot n={2} label="Add Speakers" done />
            <StepLine on={true} />

            <StepDot n={3} label="Write Content" done />
            <StepLine on={true} />

            <StepDot n={4} label="Review & Edit Script" active />
            <StepLine on={false} />

            <StepDot n={5} label="Select Music" />
            <StepLine on={false} />

            <StepDot n={6} label="Generate Audio" />
          </div>
        </div>

        <div className="max-w-5xl mx-auto">
          <section className="ui-card">
            <h2 className="ui-card-title">Editing Guidelines</h2>
            <ul className="list-disc pl-6 space-y-1 text-sm text-black/80 dark:text-white/80">
              <li><strong>Do not edit speaker names</strong> (left of the colon). They are locked.</li>
              <li>Edit <em>only</em> the content after the colon on each line.</li>
              <li>Do not clear the entire script.</li>
              {speakerLabels.length > 0 && (
                <li>
                  Detected labels:&nbsp;
                  <span className="inline-flex flex-wrap gap-2">
                    {speakerLabels.map((s) => (
                      <code key={s} className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/5">
                        {s}:
                      </code>
                    ))}
                  </span>
                </li>
              )}
            </ul>
            {hasUnsavedChanges && (
              <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm">
                ⚠️ You have unsaved changes. Please save your script before exporting.
              </div>
            )}
          </section>

          <div
            className={
              `mt-8 mb-6 max-w-full rounded-2xl border border-purple-400/25 px-4 py-4 ` +
              `bg-gradient-to-br from-[#211333] via-[#15101f] to-[#1b1228] ` +
              `shadow-[0_14px_34px_rgba(88,28,135,0.22)] flex flex-wrap items-start justify-between gap-3 overflow-hidden ` +
              `sm:px-5 sm:shadow-[0_18px_42px_rgba(88,28,135,0.24)] ` +
              `sm:flex-row sm:items-center sm:gap-4 transition-all ` +
              `duration-300 ${titleJustUpdated
                ? "ring-2 ring-purple-400/45 shadow-[0_16px_38px_rgba(124,58,237,0.28)] sm:shadow-[0_20px_46px_rgba(124,58,237,0.30)]"
                : "ring-0"
              }`
            }
          >
            <div className="flex min-w-0 flex-[1_1_18rem] items-start gap-3 sm:items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-purple-300/25 bg-purple-500/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <Mic2 className="w-4 h-4 text-purple-200" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-purple-200/75 sm:text-[11px]">
                  Podcast Title
                </p>
                {isEditingTitle ? (
                  <textarea
                    ref={titleInputRef}
                    value={draftTitle}
                    rows={1}
                    onChange={(e) => {
                      setDraftTitle(e.target.value);
                      e.currentTarget.style.height = "auto";
                      e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveTitle();
                      }
                      if (e.key === "Escape") cancelEditTitle();
                    }}
                    className="mt-1 block w-full min-w-0 resize-none overflow-hidden border-0 border-b border-purple-300/45 bg-transparent px-0 pb-1 text-lg font-semibold leading-tight text-white caret-purple-200 outline-none transition focus:border-purple-200 focus:ring-0"
                    aria-label="Podcast title"
                  />
                ) : (
                  <p className="mt-1 max-w-full break-words text-lg font-semibold leading-tight text-white">
                    {loadingDraft ? "Loading script..." : showTitle || "Podcast Show"}
                  </p>
                )}
              </div>
            </div>

            {!isEditingTitle ? (
              <button
                type="button"
                onClick={startEditTitle}
                className="inline-flex shrink-0 items-center justify-center rounded-full border border-purple-300/35 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-100 transition-all duration-200 hover:border-purple-300/60 hover:bg-purple-500/18"
              >
                Edit title
              </button>
            ) : (
              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={saveTitle}
                  className="min-h-9 flex-1 rounded-full bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-purple-700 sm:min-h-9 sm:flex-none sm:min-w-20"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEditTitle}
                  className="min-h-9 flex-1 rounded-full border border-purple-300/25 px-4 py-1.5 text-xs font-semibold text-purple-100 transition hover:bg-purple-500/12 sm:min-h-9 sm:flex-none sm:min-w-20"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="ui-card mt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h2 className="ui-card-title mb-0">Your Script</h2>
              
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu((prev) => !prev)}
                  disabled={exporting || !script.trim() || hasUnsavedChanges}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium
                           shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed
                           ${hasUnsavedChanges 
                             ? 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed' 
                             : 'bg-purple-600 hover:bg-purple-700 text-white'
                           }`}
                  title={hasUnsavedChanges ? "Please save your changes before exporting" : "Export script"}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exporting ? "Exporting..." : hasUnsavedChanges ? "Save to enable export" : "Export"}</span>
                  {!hasUnsavedChanges && <ChevronDown className={`w-4 h-4 transition-transform ${showExportMenu ? "rotate-180" : ""}`} />}
                </button>
                {showExportMenu && !exporting && script.trim() && !hasUnsavedChanges && (
                  <div className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-2xl border border-black/10 bg-white/96 p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-white/10 dark:bg-neutral-900/96">
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        exportScript("pdf");
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-black/80 transition hover:bg-purple-50 hover:text-purple-700 dark:text-white/80 dark:hover:bg-purple-900/20 dark:hover:text-purple-200"
                    >
                      <Download className="w-4 h-4" />
                      Export as PDF
                    </button>
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        exportScript("txt");
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-black/80 transition hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/10"
                    >
                      <Download className="w-4 h-4" />
                      Export as TXT
                    </button>
                  </div>
                )}
              </div>
            </div>

            {loadingDraft ? (
              <div className="text-sm opacity-80">Loading draft…</div>
            ) : (
              <>
                <label htmlFor="scriptArea" className="form-label">
                  Edit lines below {hasUnsavedChanges && <span className="text-yellow-600 dark:text-yellow-400">(unsaved changes)</span>}
                </label>
                <textarea
                  id="scriptArea"
                  ref={textareaRef}
                  className="form-textarea"
                  style={{ minHeight: "52vh", lineHeight: 1.55 }}
                  value={script}
                  onChange={handleScriptChange}
                  onKeyDown={onKeyDownGuard}
                  placeholder="Host: …"
                />

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <button
                    onClick={() => {
                      persistEditorDraft(script.trim());
                      window.location.hash = "#/create";
                    }}

                    className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"
                  >
                    Back to Review
                  </button>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <button
                      onClick={save}
                      disabled={saving}
                      className={`px-5 py-2 rounded-xl transition disabled:opacity-50 ${
                        hasUnsavedChanges 
                          ? 'bg-purple-600 text-white hover:bg-purple-700 border border-purple-500' 
                          : 'border border-neutral-300 dark:border-neutral-700 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {saving ? "Saving…" : "Save Script"}
                    </button>

                    <button
                      onClick={navigateToAudio}
                      className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold"
                    >
                      Review your script after editing <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div
                  className={
                    "mt-2 text-sm " +
                    (saveMsg.includes("Each speaker line must include text after the colon")
                      ? "text-red-500"
                      : "text-black/70 dark:text-white/70")
                  }
                >
                  {saveMsg}
                  {hasUnsavedChanges && !saveMsg && (
                    <span className="ml-2 text-yellow-600 dark:text-yellow-400">(You have unsaved changes)</span>
                  )}
                </div>
              </>
            )}

            {showAuthModal && (
              <div className="wecast-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="w-[min(92vw,460px)] rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6">
                  <h2 className="text-lg font-bold text-black dark:text-white mb-2">
                    Sign in to save your script
                  </h2>
                  <p className="text-sm text-black/70 dark:text-white/70 mb-5">
                    To keep your work saved, please create an account or log in.
                    Your current script is stored temporarily and will be restored after you sign in.
                  </p>

                  <div className="flex flex-wrap gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(false)}
                      className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition"
                    >
                      Continue without saving
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const content = script.trim();
                        if (content) sessionStorage.setItem("guestEditDraft", content);
                        window.location.hash = "#/login?redirect=edit";
                      }}
                      className="px-4 py-2 rounded-xl border border-purple-500 text-purple-600 dark:text-purple-300 text-sm font-semibold hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                    >
                      Log in
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const content = script.trim();
                        if (content) sessionStorage.setItem("guestEditDraft", content);
                        window.location.hash = "#/signup?redirect=edit";
                      }}
                      className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition"
                    >
                      Sign up
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
      
      {toastMsg && (
        <div className="fixed top-6 right-6 z-[10000] bg-green-500 text-white px-6 py-3 rounded-xl shadow-2xl border border-green-300 animate-in slide-in-from-right-8 duration-300">
          <div className="flex items-center gap-2 font-semibold">
            {toastMsg}
          </div>
        </div>
      )}
    </div>
  );
}
