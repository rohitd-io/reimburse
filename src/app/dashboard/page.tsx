"use client";
import { useState, useEffect } from "react";
import { useCurrency } from "../CurrencyContext";
import { getExpenses, updateExpenseStatus, getReceiptCounter, updateReceiptCounter } from "../actions";
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

export default function HRDashboard() {
  const { symbol } = useCurrency();
  const [expenses, setExpenses] = useState<Expense[]>([]);
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
    } catch (error) {
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
    } catch (err) {
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
          <h1>Reimburse Dashboard</h1>
          <p>
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
        <div className="table-wrapper">
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
                        <td>{exp.date}</td>
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
                            onClick={() => setSelectedExpense(exp)}
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
              onClick={() => setSelectedExpense(null)}
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
                    <strong>Date:</strong> {selectedExpense.date}
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
                              {item.proof_path ?
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "0.5rem",
                                    justifyContent: "center",
                                  }}
                                >
                                  <button
                                    className="btn btn-secondary"
                                    onClick={() =>
                                      setPreviewUrl(
                                        `/api/file?url=${encodeURIComponent(item.proof_path || "")}`,
                                      )
                                    }
                                  >
                                    Preview
                                  </button>
                                  <a
                                    href={`/api/file?url=${encodeURIComponent(item.proof_path || "")}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary"
                                    style={{
                                      padding: "0.2rem 0.5rem",
                                      fontSize: "0.7rem",
                                      display: "flex",
                                      alignItems: "center",
                                    }}
                                    title="Open in new tab"
                                  >
                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                    >
                                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                      <polyline points="15 3 21 3 21 9" />
                                      <line x1="10" y1="14" x2="21" y2="3" />
                                    </svg>
                                  </a>
                                </div>
                              : <span
                                  style={{ fontSize: "0.7rem", color: "#999" }}
                                >
                                  None
                                </span>
                              }
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
                    selectedExpense.items.filter(
                      (i: { proof_path?: string }) => i.proof_path,
                    ).length
                  }{" "}
                  proof document(s) available for review.
                </span>
              </div>
            </div>

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
          <div
            className="print-slip"
            style={
              selectedExpense.items.length > 5 ?
                ({
                  breakInside: "auto",
                  pageBreakInside: "auto",
                } as React.CSSProperties)
              : {}
            }
          >
            <div className="voucher-header">
              <div className="company-info">
                <img
                  src="/Emertech.png"
                  alt="Emertech Logo"
                  style={{
                    width: "auto",
                    height: "85px",
                    marginBottom: "0.75rem",
                  }}
                />
                <h1>Emertech Innovations Pvt. Ltd.</h1>
                <p>
                  A-609, Shelton Sapphaire, sector 15, CBD Belapur, Navi Mumbai
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
                <div className="detail-value">{selectedExpense.date}</div>
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
                    item: {
                      description: string;
                      amount: number;
                      payment_method?: string;
                      reference_no?: string;
                    },
                    idx: number,
                  ) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td>{item.payment_method || "—"}</td>
                      <td>{item.reference_no || "—"}</td>
                      <td>{item.description}</td>
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

          {/* DUPLICATE COPY */}
          {includeOfficeCopy && (
            <div
              className={`print-slip ${selectedExpense.items.length <= 3 ? "duplicate-slip" : ""}`}
              style={
                selectedExpense.items.length > 3 ?
                  ({
                    pageBreakBefore: "always",
                    breakBefore: "page",
                    ...(selectedExpense.items.length > 5 && {
                      breakInside: "auto",
                      pageBreakInside: "auto",
                    }),
                  } as React.CSSProperties)
                : {}
              }
            >
              <div className="voucher-header">
                <div className="company-info">
                  <img
                    src="/Emertech.png"
                    alt="Emertech Logo"
                    style={{
                      width: "auto",
                      height: "85px",
                      marginBottom: "0.75rem",
                    }}
                  />
                  <h1>Emertech Innovations Pvt. Ltd.</h1>
                  <p>
                    A-609, Shelton Sapphaire, sector 15, CBD Belapur, Navi
                    Mumbai
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
                  <div className="detail-value">{selectedExpense.date}</div>
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
                      item: {
                        description: string;
                        amount: number;
                        payment_method?: string;
                        reference_no?: string;
                      },
                      idx: number,
                    ) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{item.payment_method || "—"}</td>
                        <td>{item.reference_no || "—"}</td>
                        <td>{item.description}</td>
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

          {/* PROOF DOCUMENTS (Each on its own page) */}
          {selectedExpense.items
            .filter((item) => item.proof_path)
            .map(
              (
                item: ExpenseItem,
                idx: number,
              ) => (
                <div
                  key={`proof-${idx}`}
                  className="print-proof-page"
                  style={{ pageBreakBefore: "always", breakBefore: "page" }}
                >
                  <div className="proof-header">
                    <h3>
                      Proof for Item {idx + 1}: {item.category}
                    </h3>
                    <p>
                      Reimbursement ID: {selectedExpense.id} | Amount: {symbol}
                      {item.amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="proof-content">
                    {item.proof_path!.toLowerCase().endsWith(".pdf") ?
                      <PDFRenderer
                        url={`/api/file?url=${encodeURIComponent(item.proof_path!)}`}
                      />
                    : <img
                        src={`/api/file?url=${encodeURIComponent(item.proof_path!)}`}
                        alt={`Proof ${idx + 1}`}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "19cm",
                          width: "auto",
                          display: "block",
                          margin: "0 auto",
                          border: "1px solid #ddd",
                        }}
                      />
                    }
                  </div>
                </div>
              ),
            )}
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
