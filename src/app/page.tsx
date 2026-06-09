"use client";
import { useState, useEffect } from "react";
import { useCurrency } from "./CurrencyContext";
import { submitExpense } from "./actions";
import dynamic from "next/dynamic";

const PDFRenderer = dynamic(() => import("./PDFRenderer"), { ssr: false });

interface ExpenseItem {
  category: string;
  description: string;
  amount: number;
  proof?: File | null;
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

export default function SubmitExpense() {
  const { symbol } = useCurrency();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [items, setItems] = useState([
    { category: "", amount: "", description: "", proof: null as File | null, paymentMethod: "", referenceNo: "" }
  ]);
  const [submittedExpense, setSubmittedExpense] = useState<Expense | null>(null);
  const [includeOfficeCopy, setIncludeOfficeCopy] = useState(false);

  const handleAddItem = () => {
    setItems([...items, { category: "", amount: "", description: "", proof: null, paymentMethod: "", referenceNo: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      const newItems = [...items];
      newItems.splice(index, 1);
      setItems(newItems);
    }
  };

  const handleItemChange = (index: number, field: string, value: string | File | null) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems as typeof items);
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => total + (parseFloat(item.amount) || 0), 0);
  };

  const calculateItemsTotal = (itemsToSum: ExpenseItem[]) => {
    return itemsToSum.reduce((total, item) => total + (Number(item.amount) || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('department', department);
      formData.append('honeypot', honeypot);
      
      const itemsMetadata = items.map((item, index) => {
        if (item.proof) {
          formData.append(`proof_${index}`, item.proof);
        }
        return {
          category: item.category,
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
          proof: items[index].proof
        }));
        
        setSubmittedExpense({
          ...result.expense,
          id: result.expense.id || "",
          items: mergedItems
        });
        setSubmitted(true);
      } else {
        alert("Failed to submit expense report.");
      }
    } catch (error) {
      alert("Failed to submit expense report.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setName("");
    setDepartment("");
    setItems([{ category: "", amount: "", description: "", proof: null as File | null, paymentMethod: "", referenceNo: "" }]);
    setSubmittedExpense(null);
    setSubmitted(false);
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    if (submittedExpense) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [submittedExpense]);

  if (submittedExpense) {
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
              The browser's print dialog should open automatically. If not, click <strong>Print Voucher</strong> below. You can also include a duplicate copy for your office records.
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
                <button onClick={handlePrint} className="btn btn-primary" style={{ backgroundColor: '#319795' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Print Voucher
                </button>
                <button onClick={handleReset} className="btn btn-secondary">
                  Fill New Request
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card no-print" style={{ maxWidth: '850px', margin: '0 auto 3rem auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}>
          <div className="card-header" style={{ backgroundColor: '#f7fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="card-title" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Voucher Preview</h2>
            <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', backgroundColor: '#e2e8f0', borderRadius: '4px', fontWeight: 500 }}>Voucher Details Only</span>
          </div>
          <div className="card-body" style={{ padding: '2rem', backgroundColor: '#fff', color: '#1a1a1a', fontFamily: "'Inter', sans-serif" }}>
            
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <img src="/Emertech.png" alt="Emertech Logo" style={{ height: '70px', marginBottom: '0.5rem' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Emertech Innovations Pvt. Ltd.</h3>
                  <p style={{ fontSize: '0.7rem', color: '#4a5568', margin: 0, maxWidth: '250px' }}>A-609, Shelton Sapphaire, sector 15, CBD Belapur, Navi Mumbai</p>
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
                  <span style={{ fontSize: '0.9rem' }}>{submittedExpense.date}</span>
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
                      <td style={{ fontSize: '0.75rem', padding: '0.5rem' }}>{item.description}</td>
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

            {includeOfficeCopy && (
              <div style={{ border: '1px dashed #718096', borderRadius: '8px', padding: '2rem', backgroundColor: '#fcfcfc', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-10px', left: '20px', backgroundColor: '#fff', padding: '0 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#718096' }}>OFFICE COPY (DUPLICATE)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <img src="/Emertech.png" alt="Emertech Logo" style={{ height: '70px', marginBottom: '0.5rem' }} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Emertech Innovations Pvt. Ltd.</h3>
                    <p style={{ fontSize: '0.7rem', color: '#4a5568', margin: 0, maxWidth: '250px' }}>A-609, Shelton Sapphaire, sector 15, CBD Belapur, Navi Mumbai</p>
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
                    <span style={{ fontSize: '0.9rem' }}>{submittedExpense.date}</span>
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
                        <td style={{ fontSize: '0.75rem', padding: '0.5rem' }}>{item.description}</td>
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
            )}
            
            {submittedExpense.items.filter(item => item.proof || item.proof_path).length > 0 && (
              <div style={{ marginTop: '3rem', borderTop: '1px solid #e2e8f0', paddingTop: '2rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem' }}>Uploaded Proof Documents</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  {submittedExpense.items.filter(item => item.proof || item.proof_path).map((item, idx) => {
                    const isPDF = item.proof 
                      ? (item.proof.type === 'application/pdf' || item.proof.name.toLowerCase().endsWith('.pdf'))
                      : item.proof_path?.toLowerCase().endsWith('.pdf');
                    const objectUrl = item.proof ? URL.createObjectURL(item.proof) : undefined;
                    const proofSrc = objectUrl || `/api/file?url=${encodeURIComponent(item.proof_path!)}`;

                    return (
                      <div key={idx} style={{ border: '1px solid #cbd5e0', borderRadius: '6px', padding: '0.75rem', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          Proof {idx + 1}: {item.category}
                        </div>
                        <div style={{ flex: 1, height: '120px', backgroundColor: '#edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: '4px' }}>
                          {isPDF ? (
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <text x="7" y="17" fill="#e53e3e" fontSize="7" fontWeight="bold">PDF</text>
                            </svg>
                          ) : (
                            <img src={proofSrc} alt={`Proof ${idx + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="print-container">
          <div className="print-slip" style={submittedExpense.items.length > 5 ? { breakInside: 'auto', pageBreakInside: 'auto' } : {}}>
            <div className="voucher-header">
              <div className="company-info">
                <img src="/Emertech.png" alt="Emertech Logo" style={{ width: 'auto', height: '85px', marginBottom: '0.75rem' }} />
                <h1>Emertech Innovations Pvt. Ltd.</h1>
                <p>A-609, Shelton Sapphaire, sector 15, CBD Belapur, Navi Mumbai</p>
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
                <div className="detail-value">{submittedExpense.date}</div>
              </div>
              <div className="detail-item">
                <span className="detail-label">Amount</span>
                <div className="detail-value">{symbol}{calculateItemsTotal(submittedExpense.items).toFixed(2)}</div>
              </div>
              <div className="detail-item">
                <span className="detail-label">From</span>
                <div className="detail-value">{submittedExpense.name}</div>
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
                    <td>{item.description}</td>
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

          {includeOfficeCopy && (
            <div 
              className={`print-slip ${submittedExpense.items.length <= 3 ? "duplicate-slip" : ""}`}
              style={
                submittedExpense.items.length > 3 
                  ? { pageBreakBefore: 'always', breakBefore: 'page', ...(submittedExpense.items.length > 5 && { breakInside: 'auto', pageBreakInside: 'auto' }) }
                  : {}
              }
            >
              <div className="voucher-header">
                <div className="company-info">
                  <img src="/Emertech.png" alt="Emertech Logo" style={{ width: 'auto', height: '85px', marginBottom: '0.75rem' }} />
                  <h1>Emertech Innovations Pvt. Ltd.</h1>
                  <p>A-609, Shelton Sapphaire, sector 15, CBD Belapur, Navi Mumbai</p>
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
                  <div className="detail-value">{submittedExpense.date}</div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Amount</span>
                  <div className="detail-value">{symbol}{calculateItemsTotal(submittedExpense.items).toFixed(2)}</div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">From</span>
                  <div className="detail-value">{submittedExpense.name}</div>
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
                      <td>{item.description}</td>
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

          {submittedExpense.items
            .filter((item) => item.proof || item.proof_path)
            .map((item, idx) => {
              const isPDF = item.proof 
                ? (item.proof.type === 'application/pdf' || item.proof.name.toLowerCase().endsWith('.pdf'))
                : item.proof_path?.toLowerCase().endsWith('.pdf');
              const objectUrl = item.proof ? URL.createObjectURL(item.proof) : undefined;
              const proofSrc = objectUrl || `/api/file?url=${encodeURIComponent(item.proof_path!)}`;

              return (
                <div key={`proof-${idx}`} className="print-proof-page" style={{ pageBreakBefore: "always", breakBefore: "page" }}>
                  <div className="proof-header">
                    <h3>Proof for Item {idx + 1}: {item.category}</h3>
                    <p>Reimbursement ID: {submittedExpense.id} | Amount: {symbol}{Number(item.amount).toFixed(2)}</p>
                  </div>
                  <div className="proof-content">
                    {isPDF ? (
                      <PDFRenderer url={proofSrc} />
                    ) : (
                      <img
                        src={proofSrc}
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
                    )}
                  </div>
                </div>
              );
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <div>
                <label className="form-label">Employee Name <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
                <input required type="text" className="form-input" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Department <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
                <select required className="form-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
                  <option value="">Select Department</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Sales">Sales</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Operations">Operations</option>
                </select>
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
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                    <div>
                      <label className="form-label">Expense Category <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
                      <select required className="form-select" value={item.category} onChange={(e) => handleItemChange(index, 'category', e.target.value)}>
                        <option value="">Select Category</option>
                        <option value="Travel & Transit">Travel & Transit</option>
                        <option value="Meals & Entertainment">Meals & Entertainment</option>
                        <option value="Office Supplies">Office Supplies</option>
                        <option value="Software Subscriptions">Software Subscriptions</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Amount ({symbol}) <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
                      <input required type="number" step="0.01" min="0" className="form-input" placeholder="0.00" value={item.amount} onChange={(e) => handleItemChange(index, 'amount', e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                    <div>
                      <label className="form-label">Payment Method</label>
                      <select className="form-select" value={item.paymentMethod || ""} onChange={(e) => handleItemChange(index, 'paymentMethod', e.target.value)}>
                        <option value="">Select Method (Optional)</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Reference Number</label>
                      <input type="text" className="form-input" placeholder="Transaction ID, Cheque No..." value={item.referenceNo || ""} onChange={(e) => handleItemChange(index, 'referenceNo', e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                    <div>
                      <label className="form-label">Description / Business Purpose <span style={{ color: 'var(--danger, #ef4444)' }}>*</span></label>
                      <textarea required className="form-textarea" rows={1} placeholder="Explain the purpose..." value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)}></textarea>
                    </div>
                    <div>
                      <label className="form-label">Proof Document (Image/PDF) (Optional)</label>
                      <input 
                        type="file" 
                        accept="image/*,.pdf" 
                        className="form-input" 
                        style={{ padding: '0.35rem' }} 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && file.size > 10 * 1024 * 1024) {
                            alert("File size exceeds 10MB limit.");
                            e.target.value = "";
                            return;
                          }
                          handleItemChange(index, 'proof', file || null);
                        }} 
                      />
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Max size: 10MB</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
              <button type="button" className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? (
                  "Submitting..."
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Submit for Approval
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
