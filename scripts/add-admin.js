const { createClient } = require("@libsql/client");
require("dotenv").config({ path: ".env" });

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Please provide an email address. Usage: node scripts/add-admin.js <email>");
    process.exit(1);
  }

  const url = process.env.TURSO_DB_URL?.trim();
  const authToken = process.env.TURSO_DB_TOKEN?.trim();

  if (!url) {
    console.error("TURSO_DB_URL is missing from .env");
    process.exit(1);
  }

  const dbUrl = url.endsWith('.turso.') ? url + 'io' : url;

  const db = createClient({
    url: dbUrl,
    authToken,
  });

  try {
    // Create the admins table if it doesn't exist
    await db.executeMultiple(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        otp TEXT,
        otp_expires_at INTEGER
      );
    `);

    // Insert the admin
    await db.execute({
      sql: 'INSERT INTO admins (email) VALUES (?)',
      args: [email.toLowerCase()]
    });
    console.log(`✅ Admin ${email} added successfully!`);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      console.log(`⚠️ Admin ${email} already exists.`);
    } else {
      console.error("❌ Failed to add admin:", err);
    }
  }
}

main();
