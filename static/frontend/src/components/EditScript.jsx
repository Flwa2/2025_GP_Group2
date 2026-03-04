import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Mic2, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const API_BASE = import.meta.env.PROD
  ? "https://wecast.onrender.com"
  : "http://localhost:5000";

/* -------------------- overlay: rotating logo -------------------- */
function LoadingOverlay({ show, logoSrc = "/logo.png" }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-black/70 backdrop-blur-sm"
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
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full grid place-items-center text-sm font-bold ${dot}`}>
        {n}
      </div>
      <div className={`text-sm font-semibold ${labelCls}`}>{label}</div>
    </div>
  );
}

const StepLine = ({ on }) => (
  <div className={`h-[3px] flex-1 rounded-full ${on ? "bg-gradient-to-r from-purple-600 to-pink-500" : "bg-black/10 dark:bg-white/10"}`} />
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
  const [lastSavedScript, setLastSavedScript] = useState("");
  const [lastSavedTitle, setLastSavedTitle] = useState(""); // Track last saved title
  const [scriptStyle, setScriptStyle] = useState("");
  
  const isAuthenticated = () =>
    !!(localStorage.getItem("token") || sessionStorage.getItem("token"));

  const lastValidRef = useRef("");
  const textareaRef = useRef(null);

  useEffect(() => {
    const editData = JSON.parse(sessionStorage.getItem('editData') || '{}');
    if (editData.scriptStyle) {
      setScriptStyle(editData.scriptStyle);
    }
  }, []);

  // Update hasUnsavedChanges to include title changes
  const hasUnsavedChanges = useMemo(() => {
    return script.trim() !== lastSavedScript.trim() || showTitle !== lastSavedTitle;
  }, [script, lastSavedScript, showTitle, lastSavedTitle]);

  const exportScriptAsPDF = async () => {
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

      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text(title, 20, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Exported on: ${new Date().toLocaleString()}`, 20, 30);
      doc.text(`WeCast Podcast Script - ${scriptStyle || "Standard"} Style`, 20, 35);
      
      const lines = scriptContent.split(/\r?\n/).filter(line => line.trim());
      
      const tableData = [];
      lines.forEach(line => {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0) {
          const speaker = line.substring(0, colonIndex).trim();
          const text = line.substring(colonIndex + 1).trim();
          tableData.push([speaker, text]);
        } else {
          tableData.push(["", line]);
        }
      });
      
      autoTable(doc, {
        head: [["Speaker", "Dialogue"]],
        body: tableData,
        startY: 45,
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [147, 51, 234], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 40 },
          1: { cellWidth: 'auto' }
        }
      });
      
      const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_script.pdf`;
      doc.save(fileName);
      
      setToastMsg("Script exported successfully!");
      setTimeout(() => setToastMsg(""), 3000);
      
    } catch (error) {
      console.error("Error exporting script:", error);
      setToastMsg("Failed to export script. Please try again.");
      setTimeout(() => setToastMsg(""), 3000);
    } finally {
      setExporting(false);
    }
  };

  const displayedScript = scriptTemplate
    ? scriptTemplate.replaceAll("{{SHOW_TITLE}}", showTitle || "Podcast Show")
    : script;
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
    if (!showTitle) return;
    setTitleJustUpdated(true);
    const t = setTimeout(() => setTitleJustUpdated(false), 900);
    return () => clearTimeout(t);
  }, [showTitle]);

  useEffect(() => {
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
      const fromCreate = JSON.parse(sessionStorage.getItem("editData") || "{}");

      const template = (fromCreate.scriptTemplate || "").trim();

      let show =
        (fromCreate.showTitle || "").trim() ||
        (fromCreate.episodeTitle || "").trim();

      if (!show) {
        show = "Podcast Show";
      }

      if (template) {
        const visible = template.replaceAll("{{SHOW_TITLE}}", show || "Podcast Show");
        setScriptTemplate(template);
        setShowTitle(show || "Podcast Show");
        setScript(visible);
        setLastSavedScript(visible);
        setLastSavedTitle(show || "Podcast Show"); // Track saved title
        lastValidRef.current = visible;
      } else {
        const initial = (fromCreate.generatedScript || "").trim() || "";
        setScript(initial);
        setLastSavedScript(initial);
        setLastSavedTitle(show || "Podcast Show"); // Track saved title
        lastValidRef.current = initial;
        if (show) {
          setShowTitle(show);
        }
      }

      setLoadingDraft(false);
      return;
    }

    fetch(`${API_BASE}/api/draft`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const template = (d.script || "").trim();
        const show =
          (d.show_title || "").trim() ||
          (d.title || "").trim();

        const visible = template
          ? template.replaceAll("{{SHOW_TITLE}}", show || "Podcast Show")
          : "";

        setScriptTemplate(template);
        setShowTitle(show || "Podcast Show");
        setScript(visible);
        setLastSavedScript(visible);
        setLastSavedTitle(show || "Podcast Show"); // Track saved title
        lastValidRef.current = visible || "";
      })
      .finally(() => setLoadingDraft(false));

  }, []);

  useEffect(() => {
    const editData = JSON.parse(sessionStorage.getItem('editData') || '{}');
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

    if (!isAuthenticated()) {
      sessionStorage.setItem("guestEditDraft", content);
      setSaveMsg("Sign up or log in to save your script.");
      setShowAuthModal(true);
      return;
    }

    setSaving(true);
    setSaveMsg("Saving…");
    try {
      const r = await fetch(`${API_BASE}/api/edit/save`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edited_script: content,
          show_title: showTitle || "",
        }),
      });
      if (!r.ok) throw new Error();
      setSaveMsg("Last saved: " + new Date().toLocaleTimeString());
      setLastSavedScript(content);
      setLastSavedTitle(showTitle || ""); // Save the current title
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
        await fetch(`${API_BASE}/api/edit/save`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            edited_script: content,
            show_title: showTitle || "",
          }),
        });
        setLastSavedScript(content);
        setLastSavedTitle(showTitle || ""); // Save the current title
      } catch (error) {
        console.error("Failed to save script:", error);
      } finally {
        setSaving(false);
      }
    }

    const editData = JSON.parse(sessionStorage.getItem("editData") || "{}");
    const updatedEditData = {
      ...editData,
      generatedScript: content,
      scriptTemplate,
      showTitle,
      episodeTitle: showTitle,
      fromEdit: true,
    };

    sessionStorage.setItem("editData", JSON.stringify(updatedEditData));
    sessionStorage.setItem("forceStep", "4");
    window.location.hash = "#/create";
  };

  return (
    <div className="min-h-screen bg-cream dark:bg-[#0a0a0a]">
      <LoadingOverlay show={exporting} />
      
      <div className="h-2 bg-purple-gradient" />

      <main className="w-full max-w-[1400px] mx-auto px-6 py-10">
       <header className="mb-6 text-center" >
    <h1 className="text-3xl md:text-4xl font-extrabold text-black dark:text-white">
      Review & Edit Script
    </h1>
    <p className="mt-2 text-black/70 dark:text-white/70">
      Review your script, make quick edits, and get it ready for audio.
    </p>
  </header>

        <div className="w-full rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 p-4 mb-8">
          <div className="flex items-center gap-2">
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
              `mt-8 mb-6 px-5 py-4 rounded-2xl border border-amber-200/70 ` +
              `bg-gradient-to-r from-amber-50 via-amber-100 to-amber-50 ` +
              `dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-800 ` +
              `shadow-sm flex items-center justify-between gap-4 transition-all ` +
              `duration-300 ${titleJustUpdated
                ? "ring-2 ring-purple-300/70 shadow-md"
                : "ring-0"
              }`
            }
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-white/80 dark:bg-neutral-700 flex items-center justify-center shadow-sm">
                <Mic2 className="w-4 h-4 text-purple-600 dark:text-purple-300" />
              </div>
              <div>
                <p className="text-[11px] tracking-[0.18em] uppercase text-neutral-500 dark:text-neutral-400">
                  Podcast Title
                </p>
                <p className="mt-1 text-lg font-semibold text-neutral-900 dark:text-white">
                  {showTitle || "Podcast Show"}
                </p>
              </div>
            </div>

            {!isEditingTitle ? (
              <button
                type="button"
                onClick={startEditTitle}
                className="text-xs px-3 py-1.5 rounded-full border border-neutral-300 dark:border-neutral-600 
                        text-neutral-700 dark:text-neutral-100 
                        hover:bg-neutral-900/5 dark:hover:bg-white/10 
                        hover:border-purple-400 transition-all duration-200"
              >
                Edit title
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="text-xs px-2 py-1 rounded-lg border border-neutral-300 dark:border-neutral-600 
                          bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 w-44 
                          focus:outline-none focus:ring-2 focus:ring-purple-400/70"
                />
                <button
                  type="button"
                  onClick={saveTitle}
                  className="text-xs px-3 py-1.5 rounded-full bg-purple-600 text-white 
                          hover:bg-purple-700 transition-colors duration-200"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEditTitle}
                  className="text-xs px-2 py-1 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-100"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="ui-card mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="ui-card-title mb-0">Your Script</h2>
              
              <button
                onClick={exportScriptAsPDF}
                disabled={exporting || !script.trim() || hasUnsavedChanges}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium
                         shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed
                         ${hasUnsavedChanges 
                           ? 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed' 
                           : 'bg-purple-600 hover:bg-purple-700 text-white'
                         }`}
                title={hasUnsavedChanges ? "Please save your changes before exporting" : "Export script as PDF"}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{exporting ? "Exporting..." : hasUnsavedChanges ? "Save to enable export" : "Export as PDF"}</span>
              </button>
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

                <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
                  <button
                    onClick={() => {
                      const editData = JSON.parse(sessionStorage.getItem("editData") || "{}");
                      const updatedEditData = {
                        ...editData,
                        generatedScript: script,
                        scriptTemplate,
                        showTitle,
                        episodeTitle: showTitle,
                        fromEdit: true,
                      };
                      sessionStorage.setItem("editData", JSON.stringify(updatedEditData));
                      sessionStorage.setItem("forceStep", "4");
                      window.location.hash = "#/create";
                    }}

                    className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition"
                  >
                    Back to Review
                  </button>

                  <div className="flex items-center gap-3 flex-wrap">
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
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
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
