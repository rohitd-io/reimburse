"use client";
import { useState } from "react";
import { useCurrency } from "./CurrencyContext";
import { submitExpense } from "./actions";

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

      await submitExpense(formData);

      setSubmitted(true);
      setName("");
      setDepartment("");
      setItems([{ category: "", amount: "", description: "", proof: null, paymentMethod: "", referenceNo: "" }]);
      (e.target as HTMLFormElement).reset();
      
      setTimeout(() => {
        setSubmitted(false);
      }, 5000);
    } catch (error) {
      alert("Failed to submit expense report.");
    } finally {
      setSubmitting(false);
    }
  };

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
                            e.target.value = ""; // reset
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

            {/* Global file input removed in favor of per-item proofs */}

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
