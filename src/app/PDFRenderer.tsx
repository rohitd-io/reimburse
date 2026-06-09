"use client";
import "./polyfill";
import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

// Use local worker to avoid CDN fetch issues
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";

// A4 at 96dpi: 210mm = ~794px, minus 2×1cm margin = 190mm = ~718px
// minus 2×2.5rem padding (≈80px) = ~638px content width
const A4_CONTENT_WIDTH_PX = 638;
// A4 content height: 277mm ≈ 1047px, minus ~90px header = ~957px max
const A4_CONTENT_HEIGHT_PX = 920;
// Whitespace threshold: pixels with all channels >= this are considered "white"
const WHITE_THRESHOLD = 245;

/**
 * Scans from the bottom of a canvas upward and returns a new canvas
 * cropped to remove trailing rows of near-white pixels.
 */
function trimCanvasWhitespace(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data; // RGBA flat array

  // Walk rows from bottom upward to find last non-white row
  let lastContentRow = -1;
  for (let y = height - 1; y >= 0; y--) {
    let rowHasContent = false;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // If any pixel is darker than threshold, this row has content
      if (r < WHITE_THRESHOLD || g < WHITE_THRESHOLD || b < WHITE_THRESHOLD) {
        rowHasContent = true;
        break;
      }
    }
    if (rowHasContent) {
      lastContentRow = y;
      break;
    }
  }

  if (lastContentRow === -1) return null; // Page is completely blank

  // Add a small bottom margin (8px) after the last content row
  const croppedHeight = Math.min(lastContentRow + 8, height);
  if (croppedHeight >= height) return canvas; // nothing to trim

  const trimmed = document.createElement("canvas");
  trimmed.width = width;
  trimmed.height = croppedHeight;
  const trimCtx = trimmed.getContext("2d");
  if (!trimCtx) return canvas;
  trimCtx.drawImage(canvas, 0, 0, width, croppedHeight, 0, 0, width, croppedHeight);
  return trimmed;
}

interface PDFRendererProps {
  url: string;
  itemIndex: number;
  fileIndex: number;
  category: string;
  amount: number;
  symbol: string;
  expenseId: string | number;
  excludedPages: Set<string>;
  onToggleExclude?: (key: string) => void;
  isPrint?: boolean;
}

export default function PDFRenderer({
  url,
  itemIndex,
  fileIndex,
  category,
  amount,
  symbol,
  expenseId,
  excludedPages,
  onToggleExclude,
  isPrint = false,
}: PDFRendererProps) {
  const [pages, setPages] = useState<{ src: string; width: number; height: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPDF() {
      setLoading(true);
      setError(null);
      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        const pageResults: { src: string; width: number; height: number }[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          // Compute scale to fit within A4 content width
          const unscaledViewport = page.getViewport({ scale: 1 });
          const scaleByWidth = A4_CONTENT_WIDTH_PX / unscaledViewport.width;
          // Also limit by height so tall pages don't overflow
          const scaleByHeight = A4_CONTENT_HEIGHT_PX / unscaledViewport.height;
          const scale = Math.min(scaleByWidth, scaleByHeight);

          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) throw new Error("Could not get canvas context");

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (page.render({ canvasContext: context, viewport } as any)).promise;

          // Trim trailing whitespace from the rendered page
          const trimmed = trimCanvasWhitespace(canvas);

          if (trimmed) {
            pageResults.push({
              src: trimmed.toDataURL("image/jpeg", 0.85),
              width: trimmed.width,
              height: trimmed.height,
            });
          }
        }

        setPages(pageResults);
      } catch (err: unknown) {
        console.error("Error rendering PDF:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    if (url && (url.toLowerCase().endsWith('.pdf') || url.startsWith('blob:') || url.includes('blob'))) {
      loadPDF();
    }
  }, [url]);

  if (loading) {
    if (isPrint) return null;
    return <div style={{ padding: '1rem', color: '#64748b' }}>Rendering PDF pages for print...</div>;
  }
  if (error) {
    if (isPrint) return null;
    return <div style={{ color: '#ef4444', padding: '1rem' }}>Error loading PDF: {error}</div>;
  }

  return (
    <div className={isPrint ? "pdf-print-container" : "pdf-render-container"}>
      {pages.map((page, pageIndex) => {
        const key = `proof_${itemIndex}_${fileIndex}_${pageIndex}`;
        const isExcluded = excludedPages.has(key);

        if (isPrint) {
          if (isExcluded) return null;
          return (
            <div
              key={pageIndex}
              className="print-proof-item"
            >
              <div className="proof-header">
                <h3>
                  Proof for Item {itemIndex + 1}: {category} (PDF Page {pageIndex + 1} of {pages.length})
                </h3>
                <p>
                  Reimbursement ID: {expenseId} | Amount: {symbol}{Number(amount).toFixed(2)}
                </p>
              </div>
              <div className="proof-content">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.src}
                  alt={`PDF Page ${pageIndex + 1}`}
                  style={{
                    width: page.width,
                    height: page.height,
                    maxWidth: '100%',
                    display: 'block',
                    margin: '0 auto',
                    border: '1px solid #ddd',
                  }}
                />
              </div>
            </div>
          );
        } else {
          // On-screen preview mode
          if (isExcluded) {
            return (
              <div key={pageIndex} className="excluded-page-placeholder no-print">
                <div className="excluded-page-text">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span>Proof {itemIndex + 1} (PDF Page {pageIndex + 1}) - Excluded from Print</span>
                </div>
                <button
                  type="button"
                  className="page-restore-btn"
                  onClick={() => onToggleExclude?.(key)}
                >
                  Restore Page
                </button>
              </div>
            );
          }

          return (
            <div key={pageIndex} className="preview-page-card no-print">
              <div className="preview-page-header">
                <span className="preview-page-title">
                  Proof {itemIndex + 1}: {category} (PDF Page {pageIndex + 1} of {pages.length})
                </span>
                <button
                  type="button"
                  className="page-exclude-btn"
                  onClick={() => onToggleExclude?.(key)}
                >
                  Exclude Page
                </button>
              </div>
              <div style={{ padding: '1.5rem', backgroundColor: '#fff', display: 'flex', justifyContent: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.src}
                  alt={`PDF Page ${pageIndex + 1}`}
                  style={{
                    width: page.width,
                    height: page.height,
                    maxWidth: '100%',
                    display: 'block',
                    border: '1px solid #ddd',
                  }}
                />
              </div>
            </div>
          );
        }
      })}
    </div>
  );
}
