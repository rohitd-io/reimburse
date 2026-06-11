"use client";
import "../polyfill";
import { useState, useEffect, useCallback } from "react";
import { useCurrency } from "../CurrencyContext";
import { getExpenses, updateExpenseStatus, getReceiptCounter, updateReceiptCounter } from "../actions";
import { logout } from "../actions/auth";
import dynamic from "next/dynamic";

const PDFRenderer = dynamic(() => import("../PDFRenderer"), { ssr: false });

interface ExpenseItem {
  category: string;
  description: string;
  amount: number;
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

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "—";
  
  // If dateStr is just YYYY-MM-DD (legacy entries), return as is
  if (dateStr.length === 10 && !dateStr.includes('T')) {
    return dateStr;
  }
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));
  
  // Format time (e.g., "08:15 AM")
  const formatTime = (d: Date) => {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  // Format full date with time (e.g., "10 Jun 2026, 08:15 AM")
  const formatFullDateTime = (d: Date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}, ${formatTime(d)}`;
  };
  
  // Check if today
  const isToday = (d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  };

  // Check if yesterday
  const isYesterday = (d: Date) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();
  };
  
  if (diffMins < 1) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  } else if (isToday(date)) {
    return `Today at ${formatTime(date)}`;
  } else if (isYesterday(date)) {
    return `Yesterday at ${formatTime(date)}`;
  } else {
    return formatFullDateTime(date);
  }
}

export default function HRDashboard() {
  const { symbol } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to log out?")) {
      await logout();
      window.location.href = "/login";
    }
  };
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [includeOfficeCopy, setIncludeOfficeCopy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "Pending" | "Approved" | "Discarded"
  >("Pending");
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentCounter, setCurrentCounter] = useState<number>(3000);
  const [isEditingCounter, setIsEditingCounter] = useState(false);
  const [newCounter, setNewCounter] = useState<string>("");
  const [excludedPages, setExcludedPages] = useState<Set<string>>(new Set());
  const [loadingPDFs, setLoadingPDFs] = useState<Record<string, boolean>>({});
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const hasProofs = selectedExpense?.items.some(item => 
    item.proof_path && getProofPaths(item.proof_path).length > 0
  ) || false;
  const hasMultiplePages = includeOfficeCopy || hasProofs;

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

  useEffect(() => {
    Promise.resolve().then(() => {
      setExcludedPages(new Set());
      setLoadingPDFs({});
    });
  }, [selectedExpense]);

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

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const data = await getExpenses();
      setExpenses(data);
      const counter = await getReceiptCounter();
      setCurrentCounter(counter);
    } catch (error) {
      console.error("Failed to fetch expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchExpenses();
  }, []);

  const handleStatusUpdate = async (id: string, status: string) => {
    if (
      status === "Discarded" &&
      !window.confirm("Are you sure you want to discard this expense?")
    )
      return;
    try {
      await updateExpenseStatus(id, status);
      const updated = await getExpenses();
      setExpenses(updated);
      if (selectedExpense?.id === id) {
        setSelectedExpense({ ...selectedExpense, status });
      }
    } catch {
      alert(`Failed to update expense status to ${status}.`);
    }
  };

  const handlePrint = async () => {
    if (!selectedExpense) return;

    try {
      // Since PDF text rendering is problematic, we use the browser's native print functionality
      // This will trigger the @media print styles defined in globals.css
      window.print();
    } catch (error) {
      console.error("Error triggering print:", error);
      alert("Failed to open print dialog.");
    }
  };

  const handleCounterUpdate = async () => {
    const val = parseInt(newCounter);
    if (isNaN(val) || val < 1) {
      alert("Please enter a valid positive number.");
      return;
    }
    try {
      await updateReceiptCounter(val);
      setCurrentCounter(val);
      setIsEditingCounter(false);
      setNewCounter("");
    } catch {
      alert("Failed to update the receipt counter.");
    }
  };

  const calculateTotal = (items: ExpenseItem[]) => {
    return items.reduce((sum, item) => sum + item.amount, 0);
  };

  return (
    <>
      <div
        className="header no-print header-flex"
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>Reimburse Dashboard</h1>
            <button 
              onClick={handleLogout}
              className="btn btn-secondary"
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                color: 'var(--danger, #ef4444)',
                borderColor: 'rgba(239, 68, 68, 0.2)',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: 'pointer',
                borderRadius: '0.375rem',
                transition: 'all 0.2s'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
          </div>
          <p style={{ marginTop: '0.25rem' }}>
            Review pending expense reports and generate printable reimbursement
            slips.
          </p>
        </div>
        <div className="header-controls">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", backgroundColor: "white", padding: "0.25rem 0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)", fontSize: "0.875rem" }}>
            <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>Next Receipt No:</span>
            {isEditingCounter ? (
              <div style={{ display: "flex", gap: "0.25rem" }}>
                <input 
                  type="number" 
                  value={newCounter} 
                  onChange={(e) => setNewCounter(e.target.value)}
                  placeholder={currentCounter.toString()}
                  style={{ width: "80px", padding: "0.2rem", border: "1px solid var(--primary)", borderRadius: "0.25rem" }}
                  autoFocus
                />
                <button onClick={handleCounterUpdate} className="btn btn-primary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>Save</button>
                <button onClick={() => setIsEditingCounter(false)} className="btn btn-secondary" style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}>Cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontWeight: 700, color: "var(--primary)" }}>{currentCounter}</span>
                <button onClick={() => { setIsEditingCounter(true); setNewCounter(currentCounter.toString()); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }} title="Edit Counter">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
              </div>
            )}
          </div>
          <button
            className="btn btn-secondary"
            onClick={fetchExpenses}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              opacity: loading ? 0.7 : 1,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="card no-print">
        <div
          className="card-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 className="card-title">{statusFilter} Reimbursements</h2>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              backgroundColor: "#f1f5f9",
              padding: "0.25rem",
              borderRadius: "0.5rem",
            }}
          >
            <button
              onClick={() => setStatusFilter("Pending")}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                backgroundColor:
                  statusFilter === "Pending" ? "white" : "transparent",
                color:
                  statusFilter === "Pending" ? "var(--primary)" : (
                    "var(--text-muted)"
                  ),
                boxShadow:
                  statusFilter === "Pending" ?
                    "0 1px 3px rgba(0,0,0,0.1)"
                  : "none",
                transition: "all 0.2s",
              }}
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter("Approved")}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                backgroundColor:
                  statusFilter === "Approved" ? "white" : "transparent",
                color:
                  statusFilter === "Approved" ? "var(--primary)" : (
                    "var(--text-muted)"
                  ),
                boxShadow:
                  statusFilter === "Approved" ?
                    "0 1px 3px rgba(0,0,0,0.1)"
                  : "none",
                transition: "all 0.2s",
              }}
            >
              Approved
            </button>
            <button
              onClick={() => setStatusFilter("Discarded")}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                backgroundColor:
                  statusFilter === "Discarded" ? "white" : "transparent",
                color:
                  statusFilter === "Discarded" ? "#b91c1c" : (
                    "var(--text-muted)"
                  ),
                boxShadow:
                  statusFilter === "Discarded" ?
                    "0 1px 3px rgba(0,0,0,0.1)"
                  : "none",
                transition: "all 0.2s",
              }}
            >
              Discarded
            </button>
          </div>
        </div>
        <div className="table-wrapper dashboard-list-wrapper">
          <table>
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Date</th>
                <th>Employee</th>
                <th>Items</th>
                <th>Total Amount</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ?
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", padding: "2rem" }}
                  >
                    Loading expenses...
                  </td>
                </tr>
              : (
                expenses.filter(
                  (e) =>
                    e.status === statusFilter ||
                    (statusFilter === "Pending" && e.status === "NEW"),
                ).length === 0
              ) ?
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", padding: "2rem" }}
                  >
                    No {statusFilter.toLowerCase()} expenses found.
                  </td>
                </tr>
              : expenses
                  .filter(
                    (e) =>
                      e.status === statusFilter ||
                      (statusFilter === "Pending" && e.status === "NEW"),
                  )
                  .map((exp) => {
                    const totalAmount = calculateTotal(exp.items);
                    return (
                      <tr key={exp.id}>
                        <td style={{ fontWeight: 500 }}>
                          {exp.receipt_no || exp.id}
                        </td>
                        <td>{formatRelativeTime(exp.date)}</td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{exp.name}</div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {exp.department}
                          </div>
                        </td>
                        <td>{exp.items.length} item(s)</td>
                        <td style={{ fontWeight: 600 }}>
                          {symbol}
                          {totalAmount.toFixed(2)}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              exp.status === "Pending" ? "badge-pending"
                              : exp.status === "Discarded" ? "badge-discarded"
                              : "badge-approved"
                            }`}
                          >
                            {exp.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            style={{
                              padding: "0.25rem 0.75rem",
                              fontSize: "0.75rem",
                            }}
                            onClick={() => {
                              setSelectedExpense(exp);
                              setShowPrintPreview(false);
                              setTimeout(() => {
                                document
                                  .getElementById("review-details-section")
                                  ?.scrollIntoView({ behavior: "smooth" });
                              }, 100);
                            }}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {selectedExpense && (
        <div
          id="review-details-section"
          className="card no-print"
          style={{ border: "2px solid var(--primary)" }}
        >
          <div
            className="card-header"
            style={{
              backgroundColor: "#f8fafc",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h2 className="card-title">Review Details: {selectedExpense.id}</h2>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSelectedExpense(null);
                setShowPrintPreview(false);
              }}
              style={{ padding: "0.25rem 0.5rem" }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="card-body">
            <div className="review-grid">
              <div>
                <div className="review-info-flex">
                  <div>
                    <strong>Employee:</strong> {selectedExpense.name}
                  </div>
                  <div>
                    <strong>Department:</strong> {selectedExpense.department}
                  </div>
                  <div>
                    <strong>Date:</strong> {formatRelativeTime(selectedExpense.date)}
                  </div>
                </div>

                <h3
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    marginBottom: "1rem",
                    letterSpacing: "0.05em",
                  }}
                >
                  Expense Items
                </h3>
                <div
                  className="table-wrapper"
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                  }}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Description</th>
                        <th style={{ textAlign: "right" }}>Amount</th>
                        <th style={{ textAlign: "center" }}>Proof</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedExpense.items.map(
                        (
                          item: {
                            category: string;
                            description: string;
                            amount: number;
                            proof_path?: string;
                          },
                          i: number,
                        ) => (
                          <tr key={i}>
                            <td>{item.category}</td>
                            <td>{item.description}</td>
                            <td style={{ textAlign: "right" }}>
                              {symbol}
                              {item.amount.toFixed(2)}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              {item.proof_path ? (
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.25rem",
                                    alignItems: "center",
                                  }}
                                >
                                  {getProofPaths(item.proof_path).map((path, pathIdx) => (
                                    <div
                                      key={pathIdx}
                                      style={{
                                        display: "flex",
                                        gap: "0.25rem",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <button
                                        className="btn btn-secondary"
                                        style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem" }}
                                        onClick={() =>
                                          setPreviewUrl(
                                            `/api/file?url=${encodeURIComponent(path || "")}`,
                                          )
                                        }
                                      >
                                        Preview {getProofPaths(item.proof_path).length > 1 ? pathIdx + 1 : ""}
                                      </button>
                                      <a
                                        href={`/api/file?url=${encodeURIComponent(path || "")}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-secondary"
                                        style={{
                                          padding: "0.2rem 0.4rem",
                                          fontSize: "0.7rem",
                                          display: "flex",
                                          alignItems: "center",
                                        }}
                                        title="Open in new tab"
                                      >
                                        <svg
                                          width="10"
                                          height="10"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2.5"
                                        >
                                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                          <polyline points="15 3 21 3 21 9" />
                                          <line x1="10" y1="14" x2="21" y2="3" />
                                        </svg>
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: "0.7rem", color: "#999" }}>None</span>
                              )}
                            </td>
                          </tr>
                        ),
                      )}
                      <tr>
                        <td
                          colSpan={2}
                          style={{ textAlign: "right", fontWeight: "bold" }}
                        >
                          Total:
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: "bold",
                            fontSize: "1.125rem",
                            color: "var(--primary)",
                          }}
                        >
                          {symbol}
                          {calculateTotal(selectedExpense.items).toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: "#f1f5f9",
                  padding: "1.5rem",
                  borderRadius: "0.5rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--secondary)"
                  strokeWidth="1"
                  style={{ marginBottom: "1rem" }}
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span
                  style={{
                    color: "var(--secondary)",
                    textAlign: "center",
                    fontSize: "0.875rem",
                  }}
                >
                  {
                    selectedExpense.items.reduce(
                      (sum, item) => sum + getProofPaths(item.proof_path).length,
                      0
                    )
                  }{" "}
                  proof document(s) available for review.
                </span>
              </div>
            </div>

            {/* Render PDFRenderers in background so they are ready for print even if preview is hidden */}
            <div className="no-print">
              {selectedExpense.items.map((item, itemIdx) => {
                const paths = getProofPaths(item.proof_path);
                return paths.map((path, fileIdx) => {
                  const isPDF = path.toLowerCase().endsWith('.pdf');
                  if (isPDF) {
                    return (
                      <PDFRenderer
                        key={`pdf-${itemIdx}-${fileIdx}`}
                        url={`/api/file?url=${encodeURIComponent(path)}`}
                        itemIndex={itemIdx}
                        fileIndex={fileIdx}
                        category={item.category}
                        amount={item.amount}
                        symbol={symbol}
                        expenseId={selectedExpense.id}
                        excludedPages={excludedPages}
                        onToggleExclude={handleToggleExclude}
                        onLoadingStateChange={handlePDFLoadingStateChange}
                        showPreview={showPrintPreview}
                      />
                    );
                  }
                  return null;
                });
              })}
            </div>

            {showPrintPreview && (
              <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                  {hasMultiplePages ? "Print Preview & Page Exclusions" : "Print Preview"}
                </h3>
              {hasMultiplePages && (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  Click <strong>Exclude Page</strong> to skip printing specific payment slips, individual receipts, or particular pages of a PDF.
                </p>
              )}

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
                              <span style={{ backgroundColor: '#edf2f7', padding: '0.3rem 0.75rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.9rem' }}>{selectedExpense.receipt_no || selectedExpense.id}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                          <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                            <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Date</span>
                            <span style={{ fontSize: '0.9rem' }}>{formatDateOnly(selectedExpense.date)}</span>
                          </div>
                          <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                            <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Amount</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{symbol}{calculateTotal(selectedExpense.items).toFixed(2)}</span>
                          </div>
                          <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                            <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>From</span>
                            <span style={{ fontSize: '0.9rem' }}>{selectedExpense.name} ({selectedExpense.department})</span>
                          </div>
                          <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                            <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Payment For</span>
                            <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                              {Array.from(new Set(selectedExpense.items.map(i => i.category))).join(", ")}
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
                            {selectedExpense.items.map((item, idx) => (
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
                            {[...Array(Math.max(0, 3 - selectedExpense.items.length))].map((_, i) => (
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
                                <span style={{ backgroundColor: '#edf2f7', padding: '0.3rem 0.75rem', borderRadius: '4px', fontWeight: 700, fontSize: '0.9rem' }}>{selectedExpense.receipt_no || selectedExpense.id} (Office)</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                              <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Date</span>
                              <span style={{ fontSize: '0.9rem' }}>{formatDateOnly(selectedExpense.date)}</span>
                            </div>
                            <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                              <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Amount</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{symbol}{calculateTotal(selectedExpense.items).toFixed(2)}</span>
                            </div>
                            <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                              <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>From</span>
                              <span style={{ fontSize: '0.9rem' }}>{selectedExpense.name} ({selectedExpense.department})</span>
                            </div>
                            <div style={{ borderBottom: '1px solid #cbd5e0', paddingBottom: '0.25rem' }}>
                              <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase' }}>Payment For</span>
                              <span style={{ fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                                {Array.from(new Set(selectedExpense.items.map(i => i.category))).join(", ")}
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
                              {selectedExpense.items.map((item, idx) => (
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
                              {[...Array(Math.max(0, 3 - selectedExpense.items.length))].map((_, i) => (
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
              {selectedExpense.items.map((item, itemIdx) => {
                const paths = getProofPaths(item.proof_path);
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={proofSrc} alt={`Proof ${itemIdx + 1}`} style={{ maxWidth: '100%', maxHeight: '220px', objectFit: 'contain', border: '1px solid #ddd' }} />
                      </div>
                    </div>
                  );
                });
              })}
              </div>
            )}

            <div className="review-footer-flex">
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                <input
                  type="checkbox"
                  checked={includeOfficeCopy}
                  onChange={(e) => setIncludeOfficeCopy(e.target.checked)}
                  style={{ width: "1.25rem", height: "1.25rem" }}
                />
                Include Office Copy (Duplicate)
              </label>
              <div style={{ display: "flex", gap: "1rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPrintPreview(!showPrintPreview)}
                  style={{
                    backgroundColor: "#f1f5f9",
                    border: "1px solid var(--border)",
                  }}
                >
                  {showPrintPreview ? "Hide Print Preview" : "Customize Printed Pages (Exclude Pages)"}
                </button>
                {selectedExpense.status === "Pending" && (
                  <>
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        handleStatusUpdate(selectedExpense.id, "Discarded")
                      }
                      style={{
                        backgroundColor: "#fee2e2",
                        color: "#b91c1c",
                        border: "1px solid #fca5a5",
                      }}
                    >
                      Discard
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() =>
                        handleStatusUpdate(selectedExpense.id, "Approved")
                      }
                      style={{
                        backgroundColor: "#fff",
                        border: "1px solid var(--border)",
                      }}
                    >
                      Mark as Approved
                    </button>
                  </>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handlePrint}
                  style={{ backgroundColor: "#10b981" }}
                >
                  {isAnyPDFLoading ? (
                    "Approve & Print Slip (PDFs Loading...)"
                  ) : (
                    <>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                      Approve & Print Slip
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* The Printable Slip (Only visible during print) */}
      {selectedExpense && (
        <div className="print-container">
          {/* ORIGINAL COPY */}
          {!excludedPages.has("original") && (
            <div
              className="print-slip"
              style={{
                minHeight: (includeOfficeCopy && !excludedPages.has("original") && !excludedPages.has("duplicate") && selectedExpense.items.length <= 3) 
                  ? '13.8cm' 
                  : '27.7cm',
                pageBreakAfter: (includeOfficeCopy && !excludedPages.has("original") && !excludedPages.has("duplicate") && selectedExpense.items.length <= 3)
                  ? 'avoid'
                  : 'always',
                breakAfter: (includeOfficeCopy && !excludedPages.has("original") && !excludedPages.has("duplicate") && selectedExpense.items.length <= 3)
                  ? 'avoid'
                  : 'page',
                ...(selectedExpense.items.length > 5 ? { breakInside: 'auto', pageBreakInside: 'auto' } : {})
              } as React.CSSProperties}
            >
              <div className="voucher-header">
                <div className="company-info">
                  <img
                    src="/Emertech.png"
                    alt="Emertech Logo"
                    style={{
                      width: "auto",
                      height: "85px",
                      marginBottom: "0.2rem",
                    }}
                  />
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
                    <div className="receipt-value">
                      {selectedExpense.receipt_no?.toString() ||
                        selectedExpense.id.toString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="voucher-details-grid">
                <div className="detail-item">
                  <span className="detail-label">Date</span>
                  <div className="detail-value">{formatDateOnly(selectedExpense.date)}</div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Amount</span>
                  <div className="detail-value">
                    {symbol}
                    {calculateTotal(selectedExpense.items).toFixed(2)}
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">From</span>
                  <div className="detail-value">{selectedExpense.name}</div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Department</span>
                  <div className="detail-value">{selectedExpense.department}</div>
                </div>
                <div className="detail-item payment-for-row">
                  <span className="detail-label">Payment For</span>
                  <div className="detail-value">
                    {Array.from(
                      new Set(
                        selectedExpense.items.map(
                          (i: { category: string }) => i.category,
                        ),
                      ),
                    ).join(", ")}
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
                  {selectedExpense.items.map(
                    (
                      item: ExpenseItem,
                      idx: number,
                    ) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{item.payment_method || "—"}</td>
                        <td>{item.reference_no || "—"}</td>
                        <td>
                          {item.description && item.description.trim() ? `${item.description.trim()} (${item.category})` : item.category}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {item.amount.toFixed(2)}
                        </td>
                      </tr>
                    ),
                  )}
                  {[...Array(Math.max(0, 3 - selectedExpense.items.length))].map(
                    (_, i) => (
                      <tr key={`empty-${i}`} style={{ height: "3rem" }}>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                      </tr>
                    ),
                  )}
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
              className={`print-slip ${selectedExpense.items.length <= 3 ? "duplicate-slip" : ""}`}
              style={{
                minHeight: (includeOfficeCopy && !excludedPages.has("original") && !excludedPages.has("duplicate") && selectedExpense.items.length <= 3) 
                  ? '13.8cm' 
                  : '27.7cm',
                pageBreakBefore: (includeOfficeCopy && !excludedPages.has("original") && !excludedPages.has("duplicate") && selectedExpense.items.length <= 3)
                  ? 'avoid'
                  : 'always',
                breakBefore: (includeOfficeCopy && !excludedPages.has("original") && !excludedPages.has("duplicate") && selectedExpense.items.length <= 3)
                  ? 'avoid'
                  : 'page',
                ...(selectedExpense.items.length > 5 ? { breakInside: 'auto', pageBreakInside: 'auto' } : {})
              } as React.CSSProperties}
            >
              <div className="voucher-header">
                <div className="company-info">
                  <img
                    src="/Emertech.png"
                    alt="Emertech Logo"
                    style={{
                      width: "auto",
                      height: "85px",
                      marginBottom: "0.2rem",
                    }}
                  />
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
                    <div className="receipt-value">
                      {selectedExpense.receipt_no?.toString() ||
                        selectedExpense.id.toString()}{" "}
                      (Office)
                    </div>
                  </div>
                </div>
              </div>

              <div className="voucher-details-grid">
                <div className="detail-item">
                  <span className="detail-label">Date</span>
                  <div className="detail-value">{formatDateOnly(selectedExpense.date)}</div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Amount</span>
                  <div className="detail-value">
                    {symbol}
                    {calculateTotal(selectedExpense.items).toFixed(2)}
                  </div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">From</span>
                  <div className="detail-value">{selectedExpense.name}</div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Department</span>
                  <div className="detail-value">{selectedExpense.department}</div>
                </div>
                <div className="detail-item payment-for-row">
                  <span className="detail-label">Payment For</span>
                  <div className="detail-value">
                    {Array.from(
                      new Set(
                        selectedExpense.items.map(
                          (i: { category: string }) => i.category,
                        ),
                      ),
                    ).join(", ")}
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
                  {selectedExpense.items.map(
                    (
                      item: ExpenseItem,
                      idx: number,
                    ) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{item.payment_method || "—"}</td>
                        <td>{item.reference_no || "—"}</td>
                        <td>
                          {item.description && item.description.trim() ? `${item.description.trim()} (${item.category})` : item.category}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {item.amount.toFixed(2)}
                        </td>
                      </tr>
                    ),
                  )}
                  {(
                    [
                      ...Array(Math.max(0, 3 - selectedExpense.items.length)),
                    ] as unknown[]
                  ).map((_, i) => (
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

          {/* PROOF DOCUMENTS */}
          {selectedExpense.items.map((item, itemIdx) => {
            const paths = getProofPaths(item.proof_path);
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
                      <p>Reimbursement ID: {selectedExpense.id} | Amount: {symbol}{item.amount.toFixed(2)}</p>
                    </div>
                    <div className="proof-content">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
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
          })}
        </div>
      )}
      {/* Document Preview Modal */}
      {previewUrl && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "2rem",
          }}
        >
          <div
            className="modal-container"
            style={{
              backgroundColor: "white",
              borderRadius: "0.75rem",
              width: "100%",
              maxWidth: "900px",
              height: "90vh",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                padding: "1rem 1.5rem",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1.125rem" }}>
                Document Preview
              </h3>
              <div style={{ display: "flex", gap: "1rem" }}>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Open in New Tab
                </a>
                <button
                  className="btn btn-secondary"
                  onClick={() => setPreviewUrl(null)}
                  style={{ padding: "0.5rem" }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <div
              style={{
                flex: 1,
                overflow: "auto",
                backgroundColor: "#f1f5f9",
                padding: "1rem",
                display: "flex",
                justifyContent: "center",
              }}
            >
              {previewUrl.toLowerCase().endsWith(".pdf") ?
                <iframe
                  src={previewUrl}
                  style={{ width: "100%", height: "100%", border: "none" }}
                />
              : <img
                  src={previewUrl}
                  alt="Document Proof"
                  style={{
                    maxWidth: "100%",
                    height: "auto",
                    objectFit: "contain",
                  }}
                />
              }
            </div>
          </div>
        </div>
      )}
    </>
  );
}
