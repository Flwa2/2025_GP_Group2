import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, Mic2, Download, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { exportScriptPdf } from "../utils/exportScriptPdf";
import { exportScriptTxt } from "../utils/exportScriptTxt";
import { useTranslation } from "react-i18next";

import { API_BASE, apiFetch } from "../utils/api";

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

function formatDraftSavedTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
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
    t("editScript.defaultTitle");

  try {
    await apiFetch(`/api/podcast/${encodeURIComponent(podcastId)}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    });
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Save failed",
    };
  }
  return { ok: true, localOnly: false };
}

function resolveEditorDraft(source = {}) {
  const show =
    String(source.showTitle || "").trim() ||
    String(source.episodeTitle || "").trim() ||
    String(source.title || "").trim() ||
    t("editScript.defaultTitle");

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
              {t("editScript.exportingTitle")}
            </p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {t("editScript.exportingDesc")}    
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
  const { t } = useTranslation();
  const [script, setScript] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveMsg, setSaveMsg] = useState(t("editScript.noChanges"));
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

  const markDraftSaved = () => {
  setSaveMsg(t("editScript.savedAt", {
    time: formatDraftSavedTime(),
  }));  };

  const exportScript = async (format = "pdf") => {
    try {
      // Check for unsaved changes first
      if (hasUnsavedChanges) {
        setToastMsg(t("editScript.saveBeforeExport"));
        setTimeout(() => setToastMsg(""), 3000);
        return;
      }

      setExporting(true);
      
      let scriptContent = script.trim();
      let title = showTitle || t("editScript.defaultExportTitle");
      
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
        setToastMsg(t("editScript.noContent"));
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
      
      setToastMsg(t("editScript.exportSuccess", {
        format: format.toUpperCase(),
      }));
      setTimeout(() => setToastMsg(""), 3000);
      
    } catch (error) {
      console.error("Error exporting script:", error);
      setToastMsg(t("editScript.exportFailed"));
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
      setToastMsg(t("editScript.cannotClear"));
      setTimeout(() => setToastMsg(""), 3000);
      return;
    }

    if (next.trim() === "") {
      setScript(lastValidRef.current);
      setSaveMsg(t("editScript.cannotClear"));
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
    setDraftTitle(showTitle || t("editScript.defaultTitle"));
    setIsEditingTitle(true);
  };

  const cancelEditTitle = () => {
    setDraftTitle(showTitle || t("editScript.defaultTitle"));
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
      setShowTitle((prev) => prev || t("editScript.defaultTitle"));
      setLoadingDraft(false);
      return;
    }

    fetch(`${API_BASE}/api/draft`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!loadFromSource({ ...d, showTitle: d.show_title })) {
          setShowTitle(t("editScript.defaultTitle"));
          setScript("");
          setLastSavedScript("");
          setLastSavedTitle(t("editScript.defaultTitle"));
          lastValidRef.current = "";
        }
      })
      .catch(() => {
        setShowTitle(t("editScript.defaultTitle"));
        setSaveMsg(t("editScript.noDraft"));
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
      setToastMsg(t("editScript.cannotDelete"));
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
    const resolvedTitle = showTitle || editData.showTitle || editData.episodeTitle || t("editScript.defaultTitle");
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
      setSaveMsg(t("editScript.empty"));
      return;
    }

    const badLine = findEmptySpeakerLine(script);
    if (badLine !== -1) {
      setSaveMsg(t("editScript.lineError"));
      focusEmptySpeakerLine(script);
      return;
    }

    persistEditorDraft(content);
    setScriptTemplate("");
    setLastSavedScript(content);
    setLastSavedTitle(showTitle || "");

    if (!isAuthenticated()) {
      sessionStorage.setItem("guestEditDraft", content);
      markDraftSaved();
      setToastMsg(t("editScript.savedDraft"));
      setTimeout(() => setToastMsg(""), 3000);
      return;
    }

    setSaving(true);
    setSaveMsg(t("editScript.saving"));
    try {
      const result = await syncEditScriptDraftToServer(content, showTitle || "");
      if (!result.ok) {
        setSaveMsg(result.error || t("editScript.failedSave"));
        return;
      }
      if (result.localOnly) {
        markDraftSaved();
        setToastMsg(t("editScript.updatedBrowser"));
        setTimeout(() => setToastMsg(""), 3000);
        return;
      }
      markDraftSaved();
      setToastMsg(t("editScript.savedSuccess"));
      setTimeout(() => setToastMsg(""), 3000);
    } catch {
      setSaveMsg(t("editScript.failedSave"));
    } finally {
      setSaving(false);
    }
  };

  const navigateToAudio = async () => {
    const trimmed = script.trim();
    if (!trimmed) {
      setSaveMsg(t("editScript.empty"));
      return;
    }

    const badLine = findEmptySpeakerLine(script);
    if (badLine !== -1) {
      setSaveMsg(
        t("editScript.lineError")
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
        markDraftSaved();
      } catch (error) {
        console.error("Failed to save script:", error);
      } finally {
        setSaving(false);
      }
    }

    persistEditorDraft(content);
    window.location.hash = "#/create";
  };

  const isSaveError =
    saveMsg.includes("Each speaker line must include text after the colon") ||
    saveMsg.includes("Script is empty") ||
    saveMsg.includes("can't clear") ||
    saveMsg.includes("Failed") ||
    saveMsg.includes("No saved draft");
  const isSavedStatus =
    saveMsg.includes(t("editScript.savedKeyword"));
  return (
    <div className="min-h-screen bg-cream dark:bg-[#0a0a0a]">
      <LoadingOverlay show={exporting} />
      
      <div className="h-2 bg-purple-gradient" />

      <main className="w-full max-w-[1400px] mx-auto px-4 py-8 sm:px-6 sm:py-10">
       <header className="mb-6 text-center" >
    <h1 className="text-3xl md:text-4xl font-extrabold text-black dark:text-white">
      {t("editScript.title")}
    </h1>
    <p className="mt-2 text-black/70 dark:text-white/70">
      {t("editScript.subtitle")}
    </p>
  </header>

        <div className="mb-8 w-full overflow-hidden rounded-2xl border border-neutral-200 bg-white/60 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/60 sm:overflow-x-auto sm:p-4">
          <div className="flex w-full min-w-0 items-center gap-1 sm:min-w-max sm:gap-2">
            <StepDot n={1} label={t("editScript.steps.chooseStyle")} done />
            <StepLine on={true} />

            <StepDot n={2} label={t("editScript.steps.addSpeakers")} done />
            <StepLine on={true} />

            <StepDot n={3} label={t("editScript.steps.writeContent")} done />
            <StepLine on={true} />

            <StepDot n={4} label={t("editScript.steps.reviewEdit")} active />
            <StepLine on={false} />

            <StepDot n={5} label={t("editScript.steps.selectMusic")} />
            <StepLine on={false} />

            <StepDot n={6} label={t("editScript.steps.generateAudio")} />
          </div>
        </div>

        <div className="max-w-5xl mx-auto">
          <section className="ui-card">
            <h2 className="ui-card-title">{t("editScript.guidelines.title")}</h2>
            <ul className="list-disc pl-6 space-y-1 text-sm text-black/80 dark:text-white/80">
              <li><strong>{t("editScript.guidelines.noSpeakerEdit")}</strong> {t("editScript.guidelines.leftColon")} {t("editScript.guidelines.locked")}</li>
              <li>{t("editScript.guidelines.editAfterColon")}</li>
              <li>{t("editScript.guidelines.noClear")}</li>
              {speakerLabels.length > 0 && (
                <li>
                  {t("editScript.guidelines.detectedLabels")}:&nbsp;
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
                  ⚠️ {t("editScript.unsavedWarning")}
              </div>
            )}
          </section>

          <div
            className={
              `mt-8 mb-6 max-w-full rounded-2xl border border-neutral-200 px-4 py-4 ` +
              `bg-white shadow-sm shadow-slate-900/[0.04] ` +
              `dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-[0_16px_40px_rgba(0,0,0,0.22)] flex flex-wrap items-start justify-between gap-3 overflow-hidden ` +
              `sm:px-5 sm:shadow-[0_10px_28px_rgba(15,23,42,0.055)] dark:sm:shadow-[0_18px_44px_rgba(0,0,0,0.24)] ` +
              `sm:flex-row sm:items-center sm:gap-4 transition-all ` +
              `duration-300 ${titleJustUpdated
                ? "ring-2 ring-purple-400/30 shadow-[0_14px_34px_rgba(124,58,237,0.13)] dark:shadow-[0_16px_38px_rgba(124,58,237,0.22)] sm:shadow-[0_16px_38px_rgba(124,58,237,0.14)] dark:sm:shadow-[0_20px_46px_rgba(124,58,237,0.24)]"
                : "ring-1 ring-purple-100/35 dark:ring-purple-400/10"
              }`
            }
          >
            <div className="flex min-w-0 flex-[1_1_18rem] items-start gap-3 sm:items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-purple-200 bg-purple-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-purple-400/25 dark:bg-purple-500/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <Mic2 className="w-4 h-4 text-purple-700 dark:text-purple-200" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-purple-700/75 dark:text-purple-200/75 sm:text-[11px]">
                  {t("editScript.podcastTitle")}
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
                    className="mt-1 block w-full min-w-0 resize-none overflow-hidden border-0 border-b border-purple-500/45 bg-transparent px-0 pb-1 text-lg font-semibold leading-tight text-neutral-950 caret-purple-600 outline-none transition placeholder:text-neutral-500 focus:border-purple-600 focus:ring-0 dark:border-purple-300/45 dark:text-white dark:caret-purple-200 dark:focus:border-purple-200"
                    aria-label="Podcast title"
                  />
                ) : (
                  <p className="mt-1 max-w-full break-words text-lg font-semibold leading-tight text-neutral-950 dark:text-white">
                    {loadingDraft ? t("editScript.loading") : showTitle || t("editScript.defaultTitle")}
                  </p>
                )}
              </div>
            </div>

            {!isEditingTitle ? (
              <button
                type="button"
                onClick={startEditTitle}
                className="inline-flex shrink-0 items-center justify-center rounded-full border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 shadow-sm transition-all duration-200 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-800 dark:border-purple-300/30 dark:bg-purple-500/10 dark:text-purple-100 dark:shadow-none dark:hover:border-purple-300/55 dark:hover:bg-purple-500/18"
              >
                {t("editScript.editTitle")}
              </button>
            ) : (
              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={saveTitle}
                  className="min-h-9 flex-1 rounded-full bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-purple-700 sm:min-h-9 sm:flex-none sm:min-w-20"
                >
                  {t("common.save")}
                </button>
                <button
                  type="button"
                  onClick={cancelEditTitle}
                  className="min-h-9 flex-1 rounded-full border border-purple-300/60 px-4 py-1.5 text-xs font-semibold text-purple-700 transition hover:bg-purple-50 dark:border-purple-300/25 dark:text-purple-100 dark:hover:bg-purple-500/12 sm:min-h-9 sm:flex-none sm:min-w-20"
                >
                  {t("common.cancel")}
                </button>
              </div>
            )}
          </div>

          <div className="ui-card mt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h2 className="ui-card-title mb-0">{t("editScript.yourScript")}</h2>
              
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
                  title={hasUnsavedChanges ? t("editScript.saveBeforeExport") : t("editScript.exportScript")}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{exporting ? t("editScript.exporting") : hasUnsavedChanges ? t("editScript.saveToExport") : t("editScript.export")}</span>
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
                    {t("editScript.exportPdf")}
                    </button>
                    <button
                      onClick={() => {
                        setShowExportMenu(false);
                        exportScript("txt");
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-black/80 transition hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/10"
                    >
                      <Download className="w-4 h-4" />
                      {t("editScript.exportTxt")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {loadingDraft ? (
              <div className="text-sm opacity-80">{t("editScript.loadingDraft")}</div>
            ) : (
              <>
                <label htmlFor="scriptArea" className="form-label">
                  {t("editScript.editLines")} {hasUnsavedChanges && <span className="text-yellow-600 dark:text-yellow-400">({t("editScript.unsavedChanges")})</span>}
                </label>
                <textarea
                  id="scriptArea"
                  ref={textareaRef}
                  className="form-textarea"
                  style={{ minHeight: "52vh", lineHeight: 1.55 }}
                  value={script}
                  onChange={handleScriptChange}
                  onKeyDown={onKeyDownGuard}
                  placeholder={t("editScript.placeholder")}
                />

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <button
                    onClick={() => {
                      persistEditorDraft(script.trim());
                      window.location.hash = "#/create";
                    }}

                    className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"
                  >
                    {t("editScript.backToReview")}
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
                      {saving ? t("editScript.saving") : t("editScript.saveScript")}
                    </button>

                    <button
                      onClick={navigateToAudio}
                      className="btn-cta inline-flex items-center gap-2 px-7 py-3 rounded-xl text-base font-semibold"
                    >
                      {t("editScript.continue")} <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div
                  className={
                    "mt-2 flex items-center gap-1.5 text-sm " +
                    (isSaveError
                      ? "text-red-500"
                      : isSavedStatus
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-black/55 dark:text-white/55")
                  }
                >
                  {isSavedStatus ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}
                  <span>{saveMsg}</span>
                </div>
              </>
            )}

            {showAuthModal && (
              <div className="wecast-overlay flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="w-[min(92vw,460px)] rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6">
                  <h2 className="text-lg font-bold text-black dark:text-white mb-2">
                    {t("editScript.auth.title")}
                  </h2>
                  <p className="text-sm text-black/70 dark:text-white/70 mb-5">
                      {t("editScript.auth.description")}
                  </p>

                  <div className="flex flex-wrap gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(false)}
                      className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition"
                    >
                        {t("editScript.auth.continueGuest")}
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
                      {t("common.login")}
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
                      {t("common.signup")}
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
