import { createClient } from "@libsql/client";

const url = (process.env.TURSO_DATABASE_URL?.trim() || process.env.TURSO_DB_URL?.trim() || "").trim();
const authToken = (process.env.TURSO_AUTH_TOKEN?.trim() || process.env.TURSO_DB_TOKEN?.trim() || "").trim();

if (!url) {
  console.warn("TURSO_DATABASE_URL or TURSO_DB_URL is not set");
}

const dbUrl = url.endsWith('.turso.') ? url + 'io' : url;

export const db = createClient({
  url: dbUrl,
  authToken,
});

// Initialize tables
db.executeMultiple(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT DEFAULT 'Pending',
    receipt_no INTEGER
  );

  CREATE TABLE IF NOT EXISTS expense_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    proof_path TEXT,
    payment_method TEXT,
    reference_no TEXT
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    otp TEXT,
    otp_expires_at INTEGER,
    otp_attempts INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`).then(async () => {
  try {
    await db.execute("ALTER TABLE admins ADD COLUMN otp_attempts INTEGER DEFAULT 0");
  } catch (err: unknown) {
    const error = err as { message?: string };
    if (!error.message?.includes("duplicate column name") && !error.message?.includes("already exists")) {
      console.error("Failed to alter admins table:", err);
    }
  }
}).catch(err => console.error("DB Init Error:", err));

export default db;
