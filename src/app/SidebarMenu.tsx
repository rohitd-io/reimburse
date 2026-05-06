"use client";
import { useCurrency } from "./CurrencyContext";

export default function SidebarMenu() {
  const { currency, setCurrency } = useCurrency();

  return (
    <aside className="sidebar no-print">
      <a href="/" className="sidebar-logo">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
        ReimbursePro
      </a>
      <nav className="sidebar-nav">
        <a href="/submit" className="sidebar-link">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Submit Expense
        </a>
        <a href="/" className="sidebar-link">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          Dashboard
        </a>
      </nav>

      <div
        style={{
          marginTop: "auto",
          paddingTop: "2rem",
          borderTop: "1px solid #1e293b",
        }}
      >
        <label
          style={{
            display: "block",
            fontSize: "0.75rem",
            color: "#94a3b8",
            marginBottom: "0.5rem",
            textTransform: "uppercase",
            fontWeight: 600,
            letterSpacing: "0.05em",
          }}
        >
          Currency Setting
        </label>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as "USD" | "INR")}
          style={{
            width: "100%",
            padding: "0.625rem",
            backgroundColor: "#1e293b",
            color: "white",
            border: "1px solid #334155",
            borderRadius: "0.5rem",
            outline: "none",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <option value="USD">🇺🇸 USD ($)</option>
          <option value="INR">🇮🇳 INR (₹)</option>
        </select>
      </div>
    </aside>
  );
}
