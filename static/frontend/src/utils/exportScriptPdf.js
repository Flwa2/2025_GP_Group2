import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const FONT_URL = "/fonts/arial.ttf";
const FONT_VFS_NAME = "arial.ttf";
const FONT_FAMILY = "ArialUnicode";

let fontLoadPromise = null;

function containsArabic(value) {
  return ARABIC_REGEX.test(String(value || ""));
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function ensureArabicFontRegistered(doc) {
  if (!fontLoadPromise) {
    fontLoadPromise = fetch(FONT_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load PDF font: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then(arrayBufferToBase64);
  }

  const fontBase64 = await fontLoadPromise;
  doc.addFileToVFS(FONT_VFS_NAME, fontBase64);
  doc.addFont(FONT_VFS_NAME, FONT_FAMILY, "normal");
}

function shapeText(doc, text, isArabic) {
  const safeText = String(text || "");
  return isArabic ? doc.processArabic(safeText) : safeText;
}

function drawHeaderText(doc, text, y, { isArabic, fontSize, color }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const x = isArabic ? pageWidth - 20 : 20;

  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  doc.text(shapeText(doc, text, isArabic), x, y, isArabic ? { align: "right" } : undefined);
}

function isDividerLine(line) {
  return /^[-_=~\s]{3,}$/.test(line);
}

function isStageDirectionLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) {
    return false;
  }

  return (
    /^\[.*\]$/.test(trimmed) ||
    isDividerLine(trimmed) ||
    (!trimmed.includes(":") && trimmed.length <= 40)
  );
}

function buildRows(doc, lines, isArabicDocument) {
  return lines.map((line) => {
    const trimmed = line.trim();
    const colonIndex = trimmed.indexOf(":");

    if (colonIndex > 0) {
      const speaker = trimmed.substring(0, colonIndex).trim();
      const text = trimmed.substring(colonIndex + 1).trim();

      if (isArabicDocument) {
        return {
          type: "dialogue",
          cells: [
            shapeText(doc, text, containsArabic(text)),
            shapeText(doc, speaker, containsArabic(speaker)),
          ],
        };
      }

      return {
        type: "dialogue",
        cells: [
          shapeText(doc, speaker, containsArabic(speaker)),
          shapeText(doc, text, containsArabic(text)),
        ],
      };
    }

    const shapedLine = shapeText(doc, trimmed, containsArabic(trimmed));
    if (isStageDirectionLine(trimmed)) {
      if (isArabicDocument) {
        return { type: "stage", cells: [shapedLine, ""] };
      }
      return { type: "stage", cells: ["", shapedLine] };
    }

    if (isArabicDocument) {
      return { type: "dialogue", cells: [shapedLine, ""] };
    }

    return { type: "dialogue", cells: ["", shapedLine] };
  });
}

export async function exportScriptPdf({
  scriptContent,
  title,
  scriptStyle,
  fileNameBase,
}) {
  const content = String(scriptContent || "").trim();
  if (!content) {
    throw new Error("No script content to export");
  }

  const resolvedTitle = String(title || "Podcast Script").trim() || "Podcast Script";
  const isArabicDocument = containsArabic(resolvedTitle) || containsArabic(content);
  const doc = new jsPDF();

  if (isArabicDocument) {
    await ensureArabicFontRegistered(doc);
    doc.setFont(FONT_FAMILY, "normal");
  }

  drawHeaderText(doc, resolvedTitle, 20, {
    isArabic: isArabicDocument,
    fontSize: 20,
    color: [40, 40, 40],
  });

  doc.setFont(isArabicDocument ? FONT_FAMILY : "helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Exported on: ${new Date().toLocaleString()}`, 20, 30);
  doc.text(`WeCast Podcast Script - ${scriptStyle || "Standard"} Style`, 20, 35);

  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  const rows = buildRows(doc, lines, isArabicDocument);
  const tableHead = isArabicDocument
    ? [[shapeText(doc, "النص", true), shapeText(doc, "المتحدث", true)]]
    : [["Speaker", "Dialogue"]];

  autoTable(doc, {
    head: tableHead,
    body: rows.map((row) => row.cells),
    startY: 45,
    styles: {
      font: isArabicDocument ? FONT_FAMILY : "helvetica",
      fontSize: 10,
      cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
      halign: isArabicDocument ? "right" : "left",
      lineColor: [232, 232, 232],
      lineWidth: 0.1,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      font: isArabicDocument ? FONT_FAMILY : "helvetica",
      fillColor: [147, 51, 234],
      textColor: 255,
      halign: isArabicDocument ? "right" : "left",
      fontStyle: isArabicDocument ? "normal" : "bold",
    },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: {
        font: isArabicDocument ? FONT_FAMILY : "helvetica",
        fontStyle: "normal",
        cellWidth: isArabicDocument ? 135 : 40,
        halign: isArabicDocument ? "right" : "left",
      },
      1: {
        font: isArabicDocument ? FONT_FAMILY : "helvetica",
        cellWidth: isArabicDocument ? 35 : "auto",
        halign: isArabicDocument ? "right" : "left",
        fontStyle: "normal",
      },
    },
    margin: isArabicDocument ? { left: 15, right: 15 } : undefined,
    didParseCell: (hookData) => {
      if (hookData.section !== "body") {
        return;
      }

      const row = rows[hookData.row.index];
      if (!row || row.type !== "stage") {
        return;
      }

      if (hookData.column.index === 0) {
        hookData.cell.colSpan = 2;
        hookData.cell.styles.halign = "center";
        hookData.cell.styles.fontStyle = isArabicDocument ? "normal" : "bold";
        hookData.cell.styles.textColor = [75, 85, 99];
        hookData.cell.styles.fillColor = [243, 244, 246];
      } else {
        hookData.cell.text = "";
        hookData.cell.styles.lineWidth = 0;
        hookData.cell.styles.fillColor = [243, 244, 246];
      }
    },
  });

  const rawFileNameBase = String(fileNameBase || resolvedTitle).trim();
  const sanitizedBase = rawFileNameBase
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const fileName = `${sanitizedBase || "podcast_script"}_script.pdf`;

  doc.save(fileName);
  return fileName;
}
