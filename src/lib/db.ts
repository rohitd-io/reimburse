import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'expenses.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT DEFAULT 'Pending'
  );

  -- Set auto-increment starting value for both tables
  INSERT OR IGNORE INTO sqlite_sequence (name, seq) VALUES ('expenses', 999);
  INSERT OR IGNORE INTO sqlite_sequence (name, seq) VALUES ('reimbursements', 999);

  CREATE TABLE IF NOT EXISTS expense_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    proof_path TEXT,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS reimbursements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_hash TEXT UNIQUE,
    employee_name TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    receipt_url TEXT,
    local_file_path TEXT,
    status TEXT DEFAULT 'NEW',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Set auto-increment starting value to 1000
  INSERT OR IGNORE INTO sqlite_sequence (name, seq) VALUES ('reimbursements', 999);

  CREATE TABLE IF NOT EXISTS sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    records_imported INTEGER,
    status TEXT,
    error_message TEXT
  );
`);

import { initCron } from './cron';
if (process.env.NODE_ENV !== 'test') {
  initCron();
}

export default db;
