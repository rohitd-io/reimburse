"use client";
import "./polyfill";
import { useState, useEffect, useCallback } from "react";
import { useCurrency } from "./CurrencyContext";
import { submitExpense, getEmployeeSuggestions } from "./actions";
import dynamic from "next/dynamic";
import ProofImage from "./ProofImage";

const PDFRenderer = dynamic(() => import("./PDFRenderer"), { ssr: false });

interface ExpenseItem {
  category: string;
  description: string;
  amount: number;
  proofs?: File[];
  proof_path?: string;
  payment_method?: string;
  reference_no?: string;
}

interface Expense {
  id: string;
  status: string;
  receipt_no?: number | string;
  date: string;
  name: string;
  department: string;
  items: ExpenseItem[];
}

function getProofPaths(proofPathVal?: string): string[] {
  if (!proofPathVal) return [];
  try {
    const parsed = JSON.parse(proofPathVal);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [proofPathVal];
  } catch {
    return [proofPathVal];
  }
}

function formatDateOnly(dateStr?: string): string {
  if (!dateStr) return "";
  return dateStr.split("T")[0];
}

export default function SubmitExpense() {
  const { currency, symbol, setCurrency } = useCurrency();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("Engineering / Software Development");
  const [honeypot, setHoneypot] = useState("");
  const [items, setItems] = useState([
    { category: "Travel & Transit", amount: "", description: "", proofs: [] as File[], paymentMethod: "UPI", referenceNo: "", otherReason: "" }
  ]);
  const [submittedExpense, setSubmittedExpense] = useState<Expense | null>(null);
  const [includeOfficeCopy, setIncludeOfficeCopy] = useState(false);
  const [excludedPages, setExcludedPages] = useState<Set<string>>(new Set());
  const [loadingPDFs, setLoadingPDFs] = useState<Record<string, boolean>>({});
  const [autoPrintTriggered, setAutoPrintTriggered] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // CAPTCHA Challenge States
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaError, setCaptchaError] = useState("");

  const generateCaptcha = useCallback(() => {
    setNum1(Math.floor(Math.random() * 9) + 1);
    setNum2(Math.floor(Math.random() * 9) + 1);
    setCaptchaAnswer("");
    setCaptchaError("");
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const list = await getEmployeeSuggestions();
        setSuggestions(list);
      } catch (err) {
        console.error("Error loading suggestions:", err);
      }
    };
    fetchSuggestions();
    
    // Generate CAPTCHA challenge
    Promise.resolve().then(() => {
      generateCaptcha();
    });
  }, [generateCaptcha]);

  const handlePDFLoadingStateChange = useCallback((key: string, isLoading: boolean) => {
    setLoadingPDFs((prev) => {
      if (prev[key] === isLoading) return prev;
      const next = { ...prev };
      if (isLoading) {
        next[key] = true;
      } else {
        delete next[key];
      }
      return next;
    });
  }, []);

  const isAnyPDFLoading = Object.keys(loadingPDFs).length > 0;

  const handleAddItem = () => {
    setItems([...items, { category: "Travel & Transit", amount: "", description: "", proofs: [] as File[], paymentMethod: "UPI", referenceNo: "", otherReason: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
    }
  };

  const handleItemChange = (index: number, field: string, value: string | File[]) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleToggleExclude = (key: string) => {
    setExcludedPages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => total + (parseFloat(item.amount) || 0), 0);
  };

  const calculateItemsTotal = (itemsToSum: ExpenseItem[]) => {
    return itemsToSum.reduce((total, item) => total + (Number(item.amount) || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCaptchaError("");
    setSubmitting(true);

    // Validate captcha
    if (parseInt(captchaAnswer) !== num1 + num2) {
      setCaptchaError("Incorrect captcha answer. Please try again.");
      generateCaptcha();
      setSubmitting(false);
      return;
    }

    // Validate total upload size (Max 4.5MB total across all files to fit Vercel 5MB payload limit)
    let totalUploadSize = 0;
    for (const item of items) {
      if (item.proofs) {
        for (const file of item.proofs) {
          totalUploadSize += file.size;
        }
      }
    }
    if (totalUploadSize > 4.5 * 1024 * 1024) {
      setCaptchaError("The total size of uploaded files exceeds 4.5MB. Please compress your files or upload them in smaller batches.");
      setSubmitting(false);
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('department', department);
      formData.append('honeypot', honeypot);
      formData.append('num1', String(num1));
      formData.append('num2', String(num2));
      formData.append('captchaAnswer', captchaAnswer);
      
      const itemsMetadata = items.map((item, index) => {
        if (item.proofs && item.proofs.length > 0) {
          item.proofs.forEach((file, fileIdx) => {
            formData.append(`proof_${index}_${fileIdx}`, file);
          });
        }
        return {
          category: item.category === "Other" && item.otherReason ? `Other (${item.otherReason})` : item.category,
          amount: parseFloat(item.amount),
          description: item.description,
          paymentMethod: item.paymentMethod,
          referenceNo: item.referenceNo
        };
      });

      formData.append('items', JSON.stringify(itemsMetadata));

      const result = await submitExpense(formData);

      if (result.success && result.expense) {
        const mergedItems = result.expense.items.map((item, index) => ({
          ...item,
          proofs: items[index].proofs
        }));
        
        setSubmittedExpense({
          ...result.expense,
          id: result.expense.id || "",
          items: mergedItems
        });
        setSubmitted(true);
      } else {
        setCaptchaError(result.error || "Failed to submit expense report.");
        generateCaptcha();
      }
    } catch {
      setCaptchaError("Failed to submit expense report. Please check your network and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setName("");
    setDepartment("Engineering / Software Development");
    setItems([{ category: "Travel & Transit", amount: "", description: "", proofs: [] as File[], paymentMethod: "UPI", referenceNo: "", otherReason: "" }]);
    setSubmittedExpense(null);
    setSubmitted(false);
    setExcludedPages(new Set());
    setLoadingPDFs({});
    setAutoPrintTriggered(false);
    setShowPrintPreview(false);
    generateCaptcha();
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    if (submittedExpense && !autoPrintTriggered) {
      if (!isAnyPDFLoading) {
        const timer = setTimeout(() => {
          window.print();
          setAutoPrintTriggered(true);
        }, 500);
        return () => clearTimeout(timer);
      } else {
        // Fallback: trigger print anyway after 3 seconds if PDFs are still loading
        const timer = setTimeout(() => {
          if (!autoPrintTriggered) {
            window.print();
            setAutoPrintTriggered(true);
          }
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [submittedExpense, isAnyPDFLoading, autoPrintTriggered]);

  if (submittedExpense) {
    const hasProofs = submittedExpense.items.some(item => 
      (item.proofs && item.proofs.length > 0) || 
      (item.proof_path && getProofPaths(item.proof_path).length > 0)
    );
    const hasMultiplePages = includeOfficeCopy || hasProofs;

    return (
      <>
        <div className="header no-print">
          <h1>Expense Report Submitted</h1>
          <p>Your request has been successfully recorded. You can print the voucher below.</p>
        </div>

        <div className="card no-print" style={{ backgroundColor: '#e6fffa', borderColor: '#319795', marginBottom: '2rem' }}>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600, color: '#234e52', fontSize: '1.1rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#319795" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>Voucher Generated Successfully! (Receipt No: #{submittedExpense.receipt_no || submittedExpense.id})</span>
            </div>
            <p style={{ color: '#2d3748', fontSize: '0.9rem' }}>
              The browser&apos;s print dialog should open automatically. If not, click <strong>Print Voucher</strong> below. You can also include a duplicate copy for your office records.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px solid #cbd5e0', paddingTop: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, color: '#2d3748' }}>
                <input 
                  type="checkbox" 
                  checked={includeOfficeCopy} 
                  onChange={(e) => setIncludeOfficeCopy(e.target.checked)} 
                  style={{ width: '1.2rem', height: '1.2rem' }}
                />
                Include Office Copy (Duplicate)
              </label>
              
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={handlePrint} 
                  className="btn btn-primary" 
                  style={{ backgroundColor: '#319795' }}
                >
                  {isAnyPDFLoading ? (
                    "Print Voucher (PDFs Loading...)"
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                      Print Voucher
                    </>
                  )}
                </button>
                <button onClick={handleReset} className="btn btn-secondary">
                  Fill New Request
                </button>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.75rem', borderTop: '1px dashed #cbd5e0', paddingTop: '0.75rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', gap: '0.35rem', color: '#4a5568' }}
                onClick={() => setShowPrintPreview(!showPrintPreview)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
                </svg>
                {showPrintPreview ? "Hide Print Preview & Exclusions" : "Want to exclude some pages? Click to customize print"}
              </button>
            </div>
          </div>
        </div>

        {/* Render PDFRenderers in background so they are ready for print even if preview is hidden */}
        <div className="no-print">
          {submittedExpense.items.map((item, itemIdx) => {
            const files = item.proofs || [];
            const paths = getProofPaths(item.proof_path);

            if (files.length > 0) {
              return files.map((file, fileIdx) => {
                const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                if (isPDF) {
                  return (
                    <PDFRenderer
                      key={`pdf-${itemIdx}-${fileIdx}`}
                      file={file}
                      itemIndex={itemIdx}
                      fileIndex={fileIdx}
                      category={item.category}
                      amount={item.amount}
                      symbol={symbol}
                      expenseId={submittedExpense.id}
                      excludedPages={excludedPages}
                      onToggleExclude={handleToggleExclude}
                      onLoadingStateChange={handlePDFLoadingStateChange}
                      showPreview={showPrintPreview}
                    />
                  );
                }
                return null;
              });
            } else if (paths.length > 0) {
              return paths.map((path, fileIdx) => {
                const isPDF = path.toLowerCase().endsWith('.pdf');
                if (isPDF) {
                  return (
                    <PDFRenderer
                      key={`pdf-path-${itemIdx}-${fileIdx}`}
                      url={`/api/file?url=${encodeURIComponent(path)}`}
                      itemIndex={itemIdx}
                      fileIndex={fileIdx}
                      category={item.category}
                      amount={item.amount}
                      symbol={symbol}
                      expenseId={submittedExpense.id}
                      excludedPages={excludedPages}
                      onToggleExclude={handleToggleExclude}
                      onLoadingStateChange={handlePDFLoadingStateChange}
                      showPreview={showPrintPreview}
                    />
                  );
                }
                return null;
              });
            }
            return null;
          })}
        </div>

        {showPrintPreview && (
          <div style={{ maxWidth: '850px', margin: '0 auto 3rem auto' }} className="no-print">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-main)' }}>
            {hasMultiplePages ? "Print Preview & Page Exclusions" : "Print Preview"}
          </h2>
          
          {/* Original Copy Preview Card */}
          {excludedPages.has("original") ? (
            <div className="excluded-page-placeholder">
              <div className="excluded-page-text">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                <span>Original Payment Voucher - Excluded from Print</span>
              </div>
              <button type="button" className="page-restore-btn" onClick={() => handleToggleExclude("original")}>
                Restore Page
              </button>
            </div>
          ) : (
            <div className="preview-page-card">
              <div className="preview-page-header">
                <span className="preview-page-title">Original Payment Voucher</span>
                {hasMultiplePages && (
                  <button type="button" className="page-exclude-btn" onClick={() => handleToggleExclude("original")}>
                    Exclude Page
                  </button>
                )}
              </div>
              <div className="card-body" style={{ padding: '1rem', backgroundColor: '#fff', color: '#1a1a1a', fontFamily: "'Inter', sans-serif" }}>
                <div className="voucher-preview-scroll">
                  <div className="voucher-preview-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                      <div>
                        <img src="/Emertech.png" alt="Emertech Logo" style={{ height: '70px', marginBottom: '0.15rem' }} />
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Emertech Innovations Pvt. Ltd.</h3>
                        <p style={{ fontSize: '0.7rem', color: '#4a5568', margin: 0, maxWidth: '380px', lineHeight: '1.3' }}>
                          A 609, Shelton Sapphire, behind Croma - Belapur,<br />
                          Sector 15, CBD Belapur, Maharashtra 400614<br />
                          <span style={{ fontSize: '0.625rem', color: '#718096', display: 'block', marginTop: '2px' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', marginRight: '3px', verticalAlign: 'middle' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                            info@emertech.io | 
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', marginLeft: '6px', marginRight: '3px', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                            https://emertech.io
                          </span>
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>Payment Voucher</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e3a8a' }}>RECEIPT No.</span>
                          <span style={{ backgroundColor: '#edf2f7', padding: '0.3rem 0.75rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.9rem' }}>{submittedExpense.receipt_no || submittedExpense.id}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Date</span>
                        <span style={{ fontSize: '0.9rem' }}>{formatDateOnly(submittedExpense.date)}</span>
                      </div>
                      <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Amount</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{symbol}{calculateItemsTotal(submittedExpense.items).toFixed(2)}</span>
                      </div>
                      <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>From</span>
                        <span style={{ fontSize: '0.9rem' }}>{submittedExpense.name} ({submittedExpense.department})</span>
                      </div>
                      <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                        <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Payment For</span>
                        <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                          {Array.from(new Set(submittedExpense.items.map(i => i.category))).join(", ")}
                        </span>
                      </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#1e3a8a', color: '#fff' }}>
                          <th style={{ fontSize: '0.7rem', padding: '0.5rem', textAlign: 'left', borderRadius: '4px 0 0 0' }}>Sr.</th>
                          <th style={{ fontSize: '0.7rem', padding: '0.5rem', textAlign: 'left' }}>Method</th>
                          <th style={{ fontSize: '0.7rem', padding: '0.5rem', textAlign: 'left' }}>Ref No.</th>
                          <th style={{ fontSize: '0.7rem', padding: '0.5rem', textAlign: 'left' }}>Description</th>
                          <th style={{ fontSize: '0.7rem', padding: '0.5rem', textAlign: 'right', borderRadius: '0 4px 0 0' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {submittedExpense.items.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ fontSize: '0.75rem', padding: '0.5rem' }}>{idx + 1}</td>
                            <td style={{ fontSize: '0.75rem', padding: '0.5rem' }}>{item.payment_method || "—"}</td>
                            <td style={{ fontSize: '0.75rem', padding: '0.5rem' }}>{item.reference_no || "—"}</td>
                            <td style={{ fontSize: '0.75rem', padding: '0.5rem' }}>
                              {item.description && item.description.trim() ? `${item.description.trim()} (${item.category})` : item.category}
                            </td>
                            <td style={{ fontSize: '0.75rem', padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>{symbol}{Number(item.amount).toFixed(2)}</td>
                          </tr>
                        ))}
                        {[...Array(Math.max(0, 3 - submittedExpense.items.length))].map((_, i) => (
                          <tr key={`empty-${i}`} style={{ height: '2rem', borderBottom: '1px solid #e2e8f0' }}>
                            <td colSpan={5}></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem' }}>
                      <div style={{ width: '150px', textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '0.25rem', fontSize: '0.75rem', fontWeight: 700, color: '#1e3a8a' }}>Received by</div>
                      </div>
                      <div style={{ width: '150px', textAlign: 'center' }}>
                        <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '0.25rem', fontSize: '0.75rem', fontWeight: 700, color: '#1e3a8a' }}>Client</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Duplicate Copy Preview Card */}
          {includeOfficeCopy && (
            excludedPages.has("duplicate") ? (
              <div className="excluded-page-placeholder">
                <div className="excluded-page-text">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  <span>Duplicate Payment Voucher (Office Copy) - Excluded from Print</span>
                </div>
                <button type="button" className="page-restore-btn" onClick={() => handleToggleExclude("duplicate")}>
                  Restore Page
                </button>
              </div>
            ) : (
              <div className="preview-page-card">
                <div className="preview-page-header">
                  <span className="preview-page-title">Duplicate Payment Voucher (Office Copy)</span>
                  {hasMultiplePages && (
                    <button type="button" className="page-exclude-btn" onClick={() => handleToggleExclude("duplicate")}>
                      Exclude Page
                    </button>
                  )}
                </div>
                <div className="card-body" style={{ padding: '1rem', backgroundColor: '#fff', color: '#1a1a1a', fontFamily: "'Inter', sans-serif" }}>
                  <div className="voucher-preview-scroll">
                    <div className="voucher-preview-container" style={{ border: '1px dashed #718096', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '-10px', left: '20px', backgroundColor: '#fff', padding: '0 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#718096' }}>OFFICE COPY (DUPLICATE)</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                        <div>
                          <img src="/Emertech.png" alt="Emertech Logo" style={{ height: '70px', marginBottom: '0.15rem' }} />
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Emertech Innovations Pvt. Ltd.</h3>
                          <p style={{ fontSize: '0.7rem', color: '#4a5568', margin: 0, maxWidth: '380px', lineHeight: '1.3' }}>
                            A 609, Shelton Sapphire, behind Croma - Belapur,<br />
                            Sector 15, CBD Belapur, Maharashtra 400614<br />
                            <span style={{ fontSize: '0.625rem', color: '#718096', display: 'block', marginTop: '2px' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', marginRight: '3px', verticalAlign: 'middle' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                              info@emertech.io | 
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', marginLeft: '6px', marginRight: '3px', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                              https://emertech.io
                            </span>
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>Payment Voucher</h4>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#1e3a8a' }}>RECEIPT No.</span>
                            <span style={{ backgroundColor: '#edf2f7', padding: '0.3rem 0.75rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.9rem' }}>{submittedExpense.receipt_no || submittedExpense.id} (Office)</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                          <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Date</span>
                          <span style={{ fontSize: '0.9rem' }}>{formatDateOnly(submittedExpense.date)}</span>
                        </div>
                        <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                          <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Amount</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{symbol}{calculateItemsTotal(submittedExpense.items).toFixed(2)}</span>
                        </div>
                        <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                          <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>From</span>
                          <span style={{ fontSize: '0.9rem' }}>{submittedExpense.name} ({submittedExpense.department})</span>
                        </div>
                        <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                          <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Payment For</span>
                          <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                            {Array.from(new Set(submittedExpense.items.map(i => i.category))).join(", ")}
                          </span>
                        </div>
                      </div>

                      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#1e3a8a', color: '#fff' }}>
                            <th style={{ fontSize: '0.7rem', padding: '0.5rem', textAlign: 'left', borderRadius: '4px 0 0 0' }}>Sr.</th>
                            <th style={{ fontSize: '0.7rem', padding: '0.5rem', textAlign: 'left' }}>Method</th>
                            <th style={{ fontSize: '0.7rem', padding: '0.5rem', textAlign: 'left' }}>Ref No.</th>
                            <th style={{ fontSize: '0.7rem', padding: '0.5rem', textAlign: 'left' }}>Description</th>
                            <th style={{ fontSize: '0.7rem', padding: '0.5rem', textAlign: 'right', borderRadius: '0 4px 0 0' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submittedExpense.items.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ fontSize: '0.75rem', padding: '0.5rem' }}>{idx + 1}</td>
                              <td style={{ fontSize: '0.75rem', padding: '0.5rem' }}>{item.payment_method || "—"}</td>
                              <td style={{ fontSize: '0.75rem', padding: '0.5rem' }}>{item.reference_no || "—"}</td>
                              <td style={{ fontSize: '0.75rem', padding: '0.5rem' }}>
                                {item.description && item.description.trim() ? `${item.description.trim()} (${item.category})` : item.category}
                              </td>
                              <td style={{ fontSize: '0.75rem', padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>{symbol}{Number(item.amount).toFixed(2)}</td>
                            </tr>
                          ))}
                          {[...Array(Math.max(0, 3 - submittedExpense.items.length))].map((_, i) => (
                            <tr key={`empty-${i}`} style={{ height: '2rem', borderBottom: '1px solid #e2e8f0' }}>
                              <td colSpan={5}></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem' }}>
                        <div style={{ width: '150px', textAlign: 'center' }}>
                          <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '0.25rem', fontSize: '0.75rem', fontWeight: 700, color: '#1e3a8a' }}>Received by</div>
                        </div>
                        <div style={{ width: '150px', textAlign: 'center' }}>
                          <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: '0.25rem', fontSize: '0.75rem', fontWeight: 700, color: '#1e3a8a' }}>Client</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Proof Pages (Screen Preview - Images only since PDFs are rendered in background above) */}
          {submittedExpense.items.map((item, itemIdx) => {
            const files = item.proofs || [];
            const paths = getProofPaths(item.proof_path);

            if (files.length > 0) {
              return files.map((file, fileIdx) => {
                const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                if (isPDF) return null;

                const key = `proof_${itemIdx}_${fileIdx}_0`;
                const isExcluded = excludedPages.has(key);
                if (isExcluded) {
                  return (
                    <div key={key} className="excluded-page-placeholder">
                      <div className="excluded-page-text">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        <span>Proof {itemIdx + 1} (Image File {fileIdx + 1}) - Excluded from Print</span>
                      </div>
                      <button type="button" className="page-restore-btn" onClick={() => handleToggleExclude(key)}>
                        Restore Page
                      </button>
                    </div>
                  );
                }
                return (
                  <div key={key} className="preview-page-card">
                    <div className="preview-page-header">
                      <span className="preview-page-title">Proof {itemIdx + 1}: {item.category} (Image File {fileIdx + 1})</span>
                      <button type="button" className="page-exclude-btn" onClick={() => handleToggleExclude(key)}>
                        Exclude Page
                      </button>
                    </div>
                    <div style={{ padding: '0.75rem', backgroundColor: '#fff', display: 'flex', justifyContent: 'center' }}>
                      <ProofImage file={file} alt={`Proof ${itemIdx + 1}`} style={{ maxWidth: '100%', maxHeight: '220px', objectFit: 'contain', border: '1px solid #ddd' }} />
                    </div>
                  </div>
                );
              });
            } else if (paths.length > 0) {
              return paths.map((path, fileIdx) => {
                const isPDF = path.toLowerCase().endsWith('.pdf');
                if (isPDF) return null;

                const key = `proof_${itemIdx}_${fileIdx}_0`;
                const isExcluded = excludedPages.has(key);
                const proofSrc = `/api/file?url=${encodeURIComponent(path)}`;
                if (isExcluded) {
                  return (
                    <div key={key} className="excluded-page-placeholder">
                      <div className="excluded-page-text">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        <span>Proof {itemIdx + 1} (Image File {fileIdx + 1}) - Excluded from Print</span>
                      </div>
                      <button type="button" className="page-restore-btn" onClick={() => handleToggleExclude(key)}>
                        Restore Page
                      </button>
                    </div>
                  );
                }
                return (
                  <div key={key} className="preview-page-card">
                    <div className="preview-page-header">
                      <span className="preview-page-title">Proof {itemIdx + 1}: {item.category} (Image File {fileIdx + 1})</span>
                      <button type="button" className="page-exclude-btn" onClick={() => handleToggleExclude(key)}>
                        Exclude Page
                      </button>
                    </div>
                    <div style={{ padding: '0.75rem', backgroundColor: '#fff', display: 'flex', justifyContent: 'center' }}>
                      <ProofImage src={proofSrc} alt={`Proof ${itemIdx + 1}`} style={{ maxWidth: '100%', maxHeight: '220px', objectFit: 'contain', border: '1px solid #ddd' }} />
                    </div>
                  </div>
                );
              });
            }
            return null;
          })}
          </div>
        )}

        {/* Hidden Print Container */}
        <div className="print-container">
          {/* ORIGINAL COPY */}
          {!excludedPages.has("original") && (
            <div 
              className="print-slip" 
              style={{
                minHeight: (includeOfficeCopy && !excludedPages.has("original") && !excludedPages.has("duplicate") && submittedExpense.items.length <= 3) 
                  ? '13.8cm' 
                  : '27.7cm',
                pageBreakAfter: (includeOfficeCopy && !excludedPages.has("original") && !excludedPages.has("duplicate") && submittedExpense.items.length <= 3)
                  ? 'avoid'
                  : 'always',
                breakAfter: (includeOfficeCopy && !excludedPages.has("original") && !excludedPages.has("duplicate") && submittedExpense.items.length <= 3)
                  ? 'avoid'
                  : 'page',
                ...(submittedExpense.items.length > 5 ? { breakInside: 'auto', pageBreakInside: 'auto' } : {})
              }}
            >
              <div className="voucher-header">
                <div className="company-info">
                  <img src="/Emertech.png" alt="Emertech Logo" style={{ width: 'auto', height: '85px', marginBottom: '0.2rem' }} />
                  <h1>Emertech Innovations Pvt. Ltd.</h1>
                  <p>
                    A 609, Shelton Sapphire, behind Croma - Belapur,<br />
                    Sector 15, CBD Belapur, Maharashtra 400614<br />
                    <span style={{ fontSize: '9px', color: '#666', display: 'block', marginTop: '2px' }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', marginRight: '3px', verticalAlign: 'middle' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                      info@emertech.io | 
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', marginLeft: '6px', marginRight: '3px', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                      https://emertech.io
                    </span>
                  </p>
                </div>
                <div className="voucher-title-section">
                  <h2 className="voucher-title">Payment Voucher</h2>
                  <div className="receipt-no-box">
                    <span className="receipt-label">RECEIPT No.</span>
                    <div className="receipt-value">{submittedExpense.receipt_no || submittedExpense.id}</div>
                  </div>
                </div>
              </div>

              <div className="voucher-details-grid">
                <div className="detail-item">
                  <span className="detail-label">Date</span>
                  <div className="detail-value">{formatDateOnly(submittedExpense.date)}</div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Amount</span>
                  <div className="detail-value">{symbol}{calculateItemsTotal(submittedExpense.items).toFixed(2)}</div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">From</span>
                  <div className="detail-value">{submittedExpense.name}</div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Department</span>
                  <div className="detail-value">{submittedExpense.department}</div>
                </div>
                <div className="detail-item payment-for-row">
                  <span className="detail-label">Payment For</span>
                  <div className="detail-value">
                    {Array.from(new Set(submittedExpense.items.map((i) => i.category))).join(", ")}
                  </div>
                </div>
              </div>

              <table className="voucher-table">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>Sr. No.</th>
                    <th>Payment Method</th>
                    <th>Reference No.</th>
                    <th>Description</th>
                    <th style={{ textAlign: "right" }}>Amount ({symbol})</th>
                  </tr>
                </thead>
                <tbody>
                  {submittedExpense.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{item.payment_method || "—"}</td>
                      <td>{item.reference_no || "—"}</td>
                      <td>
                        {item.description && item.description.trim() ? `${item.description.trim()} (${item.category})` : item.category}
                      </td>
                      <td style={{ textAlign: "right" }}>{Number(item.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                  {[...Array(Math.max(0, 3 - submittedExpense.items.length))].map((_, i) => (
                    <tr key={`empty-${i}`} style={{ height: "3rem" }}>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="voucher-footer">
                <div className="sig-block">
                  <div className="sig-line">Received by</div>
                </div>
                <div className="sig-block">
                  <div className="sig-line">Client</div>
                </div>
              </div>
            </div>
          )}

          {/* DUPLICATE COPY */}
          {includeOfficeCopy && !excludedPages.has("duplicate") && (
            <div 
              className={`print-slip ${submittedExpense.items.length <= 3 ? "duplicate-slip" : ""}`}
              style={{
                minHeight: (includeOfficeCopy && !excludedPages.has("original") && !excludedPages.has("duplicate") && submittedExpense.items.length <= 3) 
                  ? '13.8cm' 
                  : '27.7cm',
                pageBreakBefore: (includeOfficeCopy && !excludedPages.has("original") && !excludedPages.has("duplicate") && submittedExpense.items.length <= 3)
                  ? 'avoid'
                  : 'always',
                breakBefore: (includeOfficeCopy && !excludedPages.has("original") && !excludedPages.has("duplicate") && submittedExpense.items.length <= 3)
                  ? 'avoid'
                  : 'page',
                ...(submittedExpense.items.length > 5 ? { breakInside: 'auto', pageBreakInside: 'auto' } : {})
              }}
            >
              <div className="voucher-header">
                <div className="company-info">
                  <img src="/Emertech.png" alt="Emertech Logo" style={{ width: 'auto', height: '85px', marginBottom: '0.2rem' }} />
                  <h1>Emertech Innovations Pvt. Ltd.</h1>
                  <p>
                    A 609, Shelton Sapphire, behind Croma - Belapur,<br />
                    Sector 15, CBD Belapur, Maharashtra 400614<br />
                    <span style={{ fontSize: '9px', color: '#666', display: 'block', marginTop: '2px' }}>
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', marginRight: '3px', verticalAlign: 'middle' }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                      info@emertech.io | 
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline-block', marginLeft: '6px', marginRight: '3px', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                      https://emertech.io
                    </span>
                  </p>
                </div>
                <div className="voucher-title-section">
                  <h2 className="voucher-title">Payment Voucher</h2>
                  <div className="receipt-no-box">
                    <span className="receipt-label">RECEIPT No.</span>
                    <div className="receipt-value">{submittedExpense.receipt_no || submittedExpense.id} (Office)</div>
                  </div>
                </div>
              </div>

              <div className="voucher-details-grid">
                <div className="detail-item">
                  <span className="detail-label">Date</span>
                  <div className="detail-value">{formatDateOnly(submittedExpense.date)}</div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Amount</span>
                  <div className="detail-value">{symbol}{calculateItemsTotal(submittedExpense.items).toFixed(2)}</div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">From</span>
                  <div className="detail-value">{submittedExpense.name}</div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Department</span>
                  <div className="detail-value">{submittedExpense.department}</div>
                </div>
                <div className="detail-item payment-for-row">
                  <span className="detail-label">Payment For</span>
                  <div className="detail-value">
                    {Array.from(new Set(submittedExpense.items.map((i) => i.category))).join(", ")}
                  </div>
                </div>
              </div>

              <table className="voucher-table">
                <thead>
                  <tr>
                    <th style={{ width: "60px" }}>Sr. No.</th>
                    <th>Payment Method</th>
                    <th>Reference No.</th>
                    <th>Description</th>
                    <th style={{ textAlign: "right" }}>Amount ({symbol})</th>
                  </tr>
                </thead>
                <tbody>
                  {submittedExpense.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{item.payment_method || "—"}</td>
                      <td>{item.reference_no || "—"}</td>
                      <td>
                        {item.description && item.description.trim() ? `${item.description.trim()} (${item.category})` : item.category}
                      </td>
                      <td style={{ textAlign: "right" }}>{Number(item.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                  {[...Array(Math.max(0, 3 - submittedExpense.items.length))].map((_, i) => (
                    <tr key={`empty-${i}`} style={{ height: "3rem" }}>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="voucher-footer">
                <div className="sig-block">
                  <div className="sig-line">Received by</div>
                </div>
                <div className="sig-block">
                  <div className="sig-line">Client</div>
                </div>
              </div>
            </div>
          )}

          {/* PROOFS */}
          {submittedExpense.items.map((item, itemIdx) => {
            const files = item.proofs || [];
            const paths = getProofPaths(item.proof_path);

            if (files.length > 0) {
              return files.map((file, fileIdx) => {
                const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                
                if (isPDF) {
                  return (
                    <div
                      key={`pdf-print-target-${itemIdx}-${fileIdx}`}
                      id={`pdf-print-target-${itemIdx}-${fileIdx}`}
                    />
                  );
                } else {
                  const key = `proof_${itemIdx}_${fileIdx}_0`;
                  if (excludedPages.has(key)) return null;
                  return (
                    <div
                      key={key}
                      className="print-proof-item"
                    >
                      <div className="proof-header">
                        <h3>Proof for Item {itemIdx + 1}: {item.category}</h3>
                        <p>Reimbursement ID: {submittedExpense.id} | Amount: {symbol}{Number(item.amount).toFixed(2)}</p>
                      </div>
                      <div className="proof-content">
                        <ProofImage
                          file={file}
                          alt={`Proof ${itemIdx + 1}`}
                          style={{
                            maxWidth: "100%",
                            maxHeight: "19cm",
                            width: "auto",
                            display: "block",
                            margin: "0 auto",
                            border: "1px solid #ddd",
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              });
            } else if (paths.length > 0) {
              return paths.map((path, fileIdx) => {
                const isPDF = path.toLowerCase().endsWith('.pdf');
                
                if (isPDF) {
                  return (
                    <div
                      key={`pdf-print-target-${itemIdx}-${fileIdx}`}
                      id={`pdf-print-target-${itemIdx}-${fileIdx}`}
                    />
                  );
                } else {
                  const key = `proof_${itemIdx}_${fileIdx}_0`;
                  if (excludedPages.has(key)) return null;
                  const proofSrc = `/api/file?url=${encodeURIComponent(path)}`;
                  return (
                    <div
                      key={key}
                      className="print-proof-item"
                    >
                      <div className="proof-header">
                        <h3>Proof for Item {itemIdx + 1}: {item.category}</h3>
                        <p>Reimbursement ID: {submittedExpense.id} | Amount: {symbol}{Number(item.amount).toFixed(2)}</p>
                      </div>
                      <div className="proof-content">
                        <ProofImage
                          src={proofSrc}
                          alt={`Proof ${itemIdx + 1}`}
                          style={{
                            maxWidth: "100%",
                            maxHeight: "19cm",
                            width: "auto",
                            display: "block",
                            margin: "0 auto",
                            border: "1px solid #ddd",
                          }}
                        />
                      </div>
                    </div>
                  );
                }
              });
            }
            return null;
          })}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="header no-print">
        <h1>Submit Expense Report</h1>
        <p>Fill out the details below to request a reimbursement.</p>
      </div>

      {submitted && (
        <div className="card no-print" style={{ backgroundColor: '#d1fae5', borderColor: '#10b981', marginBottom: '2rem' }}>
          <div className="card-body" style={{ color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Expense report submitted successfully! HR will review it shortly.
          </div>
        </div>
      )}

      <div className="card no-print">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title">Expense Details</h2>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary)' }}>
            Total: {symbol}{calculateTotal().toFixed(2)}
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'none' }}>
              <label>Leave this field blank</label>
              <input type="text" name="honeypot" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            </div>
            <div className="form-grid" style={{ marginBottom: '2rem' }}>
              <div>
                <label className="form-label">Employee Name <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
                <input 
                  required 
                  type="text" 
                  className="form-input" 
                  placeholder="John Doe" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  list="employee-names"
                  autoComplete="off"
                />
                <datalist id="employee-names">
                  {suggestions.map((suggestion, idx) => (
                    <option key={idx} value={suggestion} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="form-label">Department <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
                <select required className="form-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
                  <option value="Engineering / Software Development">Engineering / Software Development</option>
                  <option value="Product Management">Product Management</option>
                  <option value="DevOps / Infrastructure">DevOps / Infrastructure</option>
                  <option value="IT Support">IT Support</option>
                  <option value="Design / UX">Design / UX</option>
                  <option value="Sales">Sales</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Customer Support">Customer Support</option>
                  <option value="Human Resources (HR)">Human Resources (HR)</option>
                  <option value="Finance & Accounting">Finance & Accounting</option>
                  <option value="Legal & Compliance">Legal & Compliance</option>
                  <option value="Operations">Operations</option>
                  <option value="Procurement / Vendor Management">Procurement / Vendor Management</option>
                  <option value="Executive Management">Executive Management</option>
                </select>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Default is Engineering. Change to your department from the dropdown if needed.
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Line Items</h3>
                <button type="button" onClick={handleAddItem} className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                  + Add Item
                </button>
              </div>
              
              {items.map((item, index) => (
                <div key={index} style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)', marginBottom: '1rem', position: 'relative' }}>
                  {items.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => handleRemoveItem(index)}
                      style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem' }}
                      title="Remove Item"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  )}
                  <div className="form-grid" style={{ marginBottom: '1rem' }}>
                    <div>
                      <label className="form-label">Expense Category <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
                      <select required className="form-select" value={item.category || "Travel & Transit"} onChange={(e) => handleItemChange(index, 'category', e.target.value)}>
                        <option value="Travel & Transit">Travel & Transit</option>
                        <option value="Accommodation & Hotels">Accommodation & Hotels</option>
                        <option value="Meals & Entertainment">Meals & Entertainment</option>
                        <option value="Office Supplies">Office Supplies</option>
                        <option value="Software Subscriptions">Software Subscriptions</option>
                        <option value="Cloud Services">Cloud Services</option>
                        <option value="Internet & Mobile Bills">Internet & Mobile Bills</option>
                        <option value="Hardware & Equipment">Hardware & Equipment</option>
                        <option value="Training & Certifications">Training & Certifications</option>
                        <option value="Books & Learning Materials">Books & Learning Materials</option>
                        <option value="Conference & Event Fees">Conference & Event Fees</option>
                        <option value="Client Meetings">Client Meetings</option>
                        <option value="Marketing & Advertising">Marketing & Advertising</option>
                        <option value="Recruitment Expenses">Recruitment Expenses</option>
                        <option value="Professional Services">Professional Services</option>
                        <option value="Legal & Compliance Fees">Legal & Compliance Fees</option>
                        <option value="Health & Wellness">Health & Wellness</option>
                        <option value="Remote Work Expenses">Remote Work Expenses</option>
                        <option value="Vehicle & Fuel Expenses">Vehicle & Fuel Expenses</option>
                        <option value="Parking & Tolls">Parking & Tolls</option>
                        <option value="Utilities">Utilities</option>
                        <option value="Team Building Activities">Team Building Activities</option>
                        <option value="Employee Benefits">Employee Benefits</option>
                        <option value="Vendor Payments">Vendor Payments</option>
                        <option value="Project Expenses">Project Expenses</option>
                        <option value="Miscellaneous">Miscellaneous</option>
                        <option value="Other">Other</option>
                      </select>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Default is Travel & Transit. Change to another category from the dropdown if needed.
                      </p>
                      {item.category === "Other" && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <input 
                            required 
                            type="text" 
                            className="form-input" 
                            placeholder="Specify other reason..." 
                            value={item.otherReason || ""} 
                            onChange={(e) => handleItemChange(index, 'otherReason', e.target.value)} 
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="form-label">Description / Business Purpose (Optional)</label>
                      <textarea className="form-textarea" rows={1} placeholder="Explain the purpose..." value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} style={{ resize: 'vertical', minHeight: '38px' }}></textarea>
                    </div>
                  </div>

                  <div className="form-grid" style={{ marginBottom: '1rem' }}>
                    <div>
                      <label className="form-label">Payment Method <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
                      <select required className="form-select" value={item.paymentMethod || "UPI"} onChange={(e) => handleItemChange(index, 'paymentMethod', e.target.value)}>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cash">Cash</option>
                      </select>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Default is UPI. Choose another option from the dropdown if needed.
                      </p>
                    </div>
                    <div>
                      <label className="form-label">Amount <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
                      <div className="input-group">
                        <select 
                          className="input-group-select" 
                          value={currency} 
                          onChange={(e) => setCurrency(e.target.value as 'INR' | 'USD')}
                        >
                          <option value="INR">INR (₹)</option>
                          <option value="USD">USD ($)</option>
                        </select>
                        <input required type="number" step="0.01" min="0" className="form-input input-group-input" placeholder="0.00" value={item.amount} onChange={(e) => handleItemChange(index, 'amount', e.target.value)} />
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Default is INR. Change currency from the dropdown if needed.
                      </p>
                    </div>
                  </div>

                  <div className="form-grid" style={{ marginBottom: '1rem' }}>
                    <div>
                      <label className="form-label">Reference Number</label>
                      <input type="text" className="form-input" placeholder="Transaction ID, Cheque No..." value={item.referenceNo || ""} onChange={(e) => handleItemChange(index, 'referenceNo', e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Proof Document(s) (Image/PDF) (Optional)</label>
                      <input 
                        type="file" 
                        multiple
                        accept="image/*,.pdf" 
                        className="form-input" 
                        style={{ padding: '0.35rem' }} 
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          const validFiles: File[] = [];
                          for (const file of files) {
                            const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                            const isImage = file.type.startsWith('image/');
                            if (!isPDF && !isImage) {
                              alert(`Unsupported file type: "${file.name}". Only images and PDF files are allowed.`);
                              continue;
                            }
                            if (file.size > 4 * 1024 * 1024) {
                              alert(`File "${file.name}" exceeds the 4MB size limit.`);
                            } else {
                              validFiles.push(file);
                            }
                          }
                          const existingProofs = item.proofs || [];
                          handleItemChange(index, 'proofs', [...existingProofs, ...validFiles]);
                          e.target.value = ""; // Clear so selecting same files triggers onChange
                        }} 
                      />
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Max size: 4MB per file. Select multiple files if needed.</p>
                      
                      {item.proofs && item.proofs.length > 0 && (
                        <div className="file-chip-container">
                          {item.proofs.map((file, fileIdx) => (
                            <div key={fileIdx} className="file-chip">
                              <span className="file-chip-name">{file.name}</span>
                              <button
                                type="button"
                                className="file-chip-delete"
                                onClick={() => {
                                  const newProofs = [...item.proofs];
                                  newProofs.splice(fileIdx, 1);
                                  handleItemChange(index, 'proofs', newProofs);
                                }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <line x1="18" y1="6" x2="6" y2="18"/>
                                  <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* CAPTCHA Spam Protection */}
            <div style={{ 
              backgroundColor: '#f8fafc', 
              padding: '1.25rem', 
              borderRadius: '0.5rem', 
              border: '1px solid var(--border)', 
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                Spam Verification <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span style={{ 
                  backgroundColor: '#e2e8f0', 
                  padding: '0.5rem 1rem', 
                  borderRadius: '0.375rem', 
                  fontWeight: 700, 
                  fontSize: '1rem',
                  letterSpacing: '0.05em',
                  userSelect: 'none'
                }}>
                  {num1} + {num2} = ?
                </span>
                <input 
                  required
                  type="number" 
                  className="form-input" 
                  placeholder="Answer..." 
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  style={{ maxWidth: '120px' }}
                />
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={generateCaptcha}
                  style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
                  title="Generate new question"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                  </svg>
                </button>
              </div>
              {captchaError && (
                <p style={{ color: 'var(--danger, #ef4444)', fontSize: '0.8rem', margin: 0, fontWeight: 500 }}>
                  {captchaError}
                </p>
              )}
            </div>

            <div className="review-footer-flex form-actions-footer" style={{ marginTop: '2rem' }}>
              <button type="button" className="btn btn-secondary" onClick={handleReset}>Cancel</button>
              <button type="button" onClick={handleAddItem} className="btn btn-secondary" style={{ marginRight: 'auto' }}>
                + Add New Item
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? (
                  "Saving..."
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Save & Submit
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
