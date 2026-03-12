function sanitizeFileNameBase(value) {
  const rawFileNameBase = String(value || "").trim();
  return rawFileNameBase
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function exportScriptTxt({
  scriptContent,
  title,
  fileNameBase,
}) {
  const content = String(scriptContent || "").trim();
  if (!content) {
    throw new Error("No script content to export");
  }

  const resolvedTitle = String(title || "Podcast Script").trim() || "Podcast Script";
  const sanitizedBase = sanitizeFileNameBase(fileNameBase || resolvedTitle);
  const fileName = `${sanitizedBase || "podcast_script"}_script.txt`;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }

  return fileName;
}
