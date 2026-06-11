"use client";
import { useState, useEffect } from "react";
import { requestOtp, verifyOtp } from "../actions/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"EMAIL" | "OTP">("EMAIL");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  
  // Captcha states
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  const generateCaptcha = () => {
    setNum1(Math.floor(Math.random() * 9) + 1);
    setNum2(Math.floor(Math.random() * 9) + 1);
    setCaptchaAnswer("");
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      generateCaptcha();
    });
  }, []);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate captcha
    if (parseInt(captchaAnswer) !== num1 + num2) {
      setError("Incorrect captcha answer. Please try again.");
      generateCaptcha();
      return;
    }

    setLoading(true);
    try {
      const res = await requestOtp(email, num1, num2, captchaAnswer, honeypot);
      if (res.success) {
        setStep("OTP");
      } else {
        setError(res.error || "Failed to request OTP");
        generateCaptcha();
      }
    } catch {
      setError("An unexpected error occurred");
      generateCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await verifyOtp(email, otp, honeypot);
      if (res.success) {
        window.location.href = "/dashboard";
      } else {
        setError(res.error || "Invalid OTP");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f1f5f9', padding: '1rem' }}>
      <div className="card no-print" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem 2rem', borderRadius: '1rem', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)' }}>Reimburse Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {step === "EMAIL" ? "Sign in with your authorized admin email" : "Enter the OTP sent to your email"}
          </p>
        </div>

        {step === "EMAIL" ? (
          <form onSubmit={handleRequestOtp}>
            {/* Honeypot field for bot protection */}
            <div style={{ display: 'none' }}>
              <label>Leave this field blank</label>
              <input 
                type="text" 
                name="honeypot" 
                tabIndex={-1} 
                autoComplete="off" 
                value={honeypot} 
                onChange={(e) => setHoneypot(e.target.value)} 
              />
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Admin Email</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="admin@emertech.io"
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required
                style={{ padding: '0.75rem', fontSize: '1rem' }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Security Verification: What is {num1} + {num2}? <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
              </label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="Enter answer"
                value={captchaAnswer} 
                onChange={e => setCaptchaAnswer(e.target.value)} 
                required
                style={{ padding: '0.75rem', fontSize: '1rem' }}
              />
            </div>

            {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center', backgroundColor: '#fef2f2', padding: '0.5rem', borderRadius: '0.375rem' }}>{error}</div>}
            
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 600, justifyContent: 'center' }}>
              {loading ? "Sending OTP..." : "Get Login OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            {/* Honeypot field for bot protection */}
            <div style={{ display: 'none' }}>
              <label>Leave this field blank</label>
              <input 
                type="text" 
                name="honeypot" 
                tabIndex={-1} 
                autoComplete="off" 
                value={honeypot} 
                onChange={(e) => setHoneypot(e.target.value)} 
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>6-Digit OTP</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="123456"
                value={otp} 
                onChange={e => setOtp(e.target.value)} 
                required
                maxLength={6}
                style={{ padding: '0.75rem', fontSize: '1.25rem', letterSpacing: '0.25em', textAlign: 'center' }}
              />
            </div>
            
            {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem', textAlign: 'center', backgroundColor: '#fef2f2', padding: '0.5rem', borderRadius: '0.375rem' }}>{error}</div>}
            
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 600, justifyContent: 'center' }}>
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
            <button 
              type="button" 
              onClick={() => { setStep("EMAIL"); setOtp(""); setError(""); generateCaptcha(); }} 
              className="btn btn-secondary" 
              disabled={loading}
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', fontSize: '0.875rem', justifyContent: 'center' }}
            >
              Back to Email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
