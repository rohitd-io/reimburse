import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.TURSO_DB_URL;
const authToken = process.env.TURSO_DB_TOKEN;

const db = createClient({
  url,
  authToken,
});

async function run() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    console.log("Settings table created successfully");
  } catch (e) {
    console.error(e);
  }
}
run();
