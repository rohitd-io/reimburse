const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'expenses.db');
const receiptsDir = path.join(process.cwd(), 'public', 'receipts');

console.log('Resetting database and clearing local files...');

// 1. Delete the database file to force a schema refresh
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('✔ Database file deleted.');
}

// 2. Clear local receipts to avoid orphans
if (fs.existsSync(receiptsDir)) {
  const files = fs.readdirSync(receiptsDir);
  for (const file of files) {
    if (file !== '.gitkeep') {
      fs.unlinkSync(path.join(receiptsDir, file));
    }
  }
  console.log('✔ Local receipts cleared.');
}

console.log('\nSUCCESS: System reset. Start the app to recreate the database with the new 1000+ ID schema.');
