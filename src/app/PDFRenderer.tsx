"use client";
import "./polyfill";
import { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
}

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

import { createPortal } from "react-dom";

interface PDFRendererProps {
  url?: string;
  file?: File;
  itemIndex: number;
  fileIndex: number;
  category: string;
  amount: number;
  symbol: string;
  expenseId: string | number;
  excludedPages: Set<string>;
  onToggleExclude?: (key: string) => void;
  onLoadingStateChange?: (key: string, isLoading: boolean) => void;
}

export default function PDFRenderer({
  url,
  file,
  itemIndex,
  fileIndex,
  category,
  amount,
  symbol,
  expenseId,
  excludedPages,
  onToggleExclude,
  onLoadingStateChange,
}: PDFRendererProps) {
  const [pages, setPages] = useState<{ src: string; width: number; height: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const key = `pdf-${itemIndex}-${fileIndex}`;
    let objectUrl = "";
    let isCancelled = false;
    let currentLoadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;

    async function loadPDF() {
      setLoading(true);
      onLoadingStateChange?.(key, true);
      setError(null);
      try {
        let pdfUrl = url;
        if (file) {
          objectUrl = URL.createObjectURL(file);
          pdfUrl = objectUrl;
          console.log(`[PDFRenderer] Created object URL for file: ${file.name}, URL: ${objectUrl}`);
        }
        if (!pdfUrl) {
          if (!isCancelled) {
            setLoading(false);
            onLoadingStateChange?.(key, false);
          }
          return;
        }

        console.log(`[PDFRenderer] Loading PDF from URL: ${pdfUrl}`);
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        currentLoadingTask = loadingTask;
        const pdf = await loadingTask.promise;
        
        if (isCancelled) {
          try {
            loadingTask.destroy();
          } catch {}
          return;
        }

        const pageResults: { src: string; width: number; height: number }[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          if (isCancelled) {
            try {
              loadingTask.destroy();
            } catch {}
            return;
          }

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

        if (!isCancelled) {
          setPages(pageResults);
          console.log(`[PDFRenderer] Successfully loaded ${pdf.numPages} pages.`);
          onLoadingStateChange?.(key, false);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error("Error rendering PDF:", err);
          setError(err instanceof Error ? err.message : String(err));
          onLoadingStateChange?.(key, false);
          setLoading(false);
        }
      }
    }

    console.log(`[PDFRenderer] useEffect trigger for ${key}. url: ${url}, file: ${file?.name}`);
    if ((url && (url.toLowerCase().endsWith('.pdf') || url.startsWith('blob:') || url.includes('blob'))) || file) {
      loadPDF();
    } else {
      Promise.resolve().then(() => {
        setLoading(false);
      });
    }

    return () => {
      isCancelled = true;
      console.log(`[PDFRenderer] useEffect cleanup for ${key}. objectUrl: ${objectUrl}`);
      if (currentLoadingTask) {
        try {
          currentLoadingTask.destroy();
        } catch {}
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      onLoadingStateChange?.(key, false);
    };
  }, [url, file, itemIndex, fileIndex, onLoadingStateChange]);

  useEffect(() => {
    if (loading) return;

    const portalId = `pdf-print-target-${itemIndex}-${fileIndex}`;
    
    const checkTarget = () => {
      const target = document.getElementById(portalId);
      if (target) {
        setPortalTarget(target);
        return true;
      }
      return false;
    };

    if (checkTarget()) return;

    let count = 0;
    const interval = setInterval(() => {
      count++;
      if (checkTarget() || count >= 10) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [itemIndex, fileIndex, loading]);

  if (loading) {
    return <div style={{ padding: '1rem', color: '#64748b' }}>Rendering PDF pages for print...</div>;
  }
  if (error) {
    return <div style={{ color: '#ef4444', padding: '1rem' }}>Error loading PDF: {error}</div>;
  }

  const previewContent = (
    <div className="pdf-render-container">
      {pages.map((page, pageIndex) => {
        const key = `proof_${itemIndex}_${fileIndex}_${pageIndex}`;
        const isExcluded = excludedPages.has(key);

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
      })}
    </div>
  );

  const printContent = (
    <div className="pdf-print-container">
      {pages.map((page, pageIndex) => {
        const key = `proof_${itemIndex}_${fileIndex}_${pageIndex}`;
        const isExcluded = excludedPages.has(key);

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
      })}
    </div>
  );

  return (
    <>
      {previewContent}
      {portalTarget && createPortal(printContent, portalTarget)}
    </>
  );
}
