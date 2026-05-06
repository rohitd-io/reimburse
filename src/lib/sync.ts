import { sheets, drive, GOOGLE_SHEET_ID } from './google';
import db from './db';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';

const SHEET_NAME = 'Form Responses 1';
const RECEIPTS_DIR = path.join(process.cwd(), 'public', 'receipts');

// Ensure receipts directory exists
fs.ensureDirSync(RECEIPTS_DIR);

function getFileIdFromUrl(url: string): string | null {
  if (!url) return null;
  // Google Form uploads often have multiple URLs separated by commas
  const firstUrl = url.split(',')[0].trim();
  // Regex to extract ID from various Drive URL formats
  const match = firstUrl.match(/(?:id=|\/d\/|docs\.google\.com\/.*?\/)([-\w]{25,})/);
  return match ? match[1] : null;
}

async function downloadDriveFile(fileId: string, destPath: string) {
  // 1. Get metadata to check mimeType and Name
  const metadata = await drive.files.get({ fileId, fields: '*' });
  console.log(`[Sync] FULL METADATA FOR ${fileId}:`, JSON.stringify(metadata.data, null, 2));
  
  const mimeType = metadata.data.mimeType || '';
  const fileName = metadata.data.name || 'unknown';

  console.log(`[Sync] Drive File Check - Name: "${fileName}", Type: "${mimeType}"`);

  let response;
  if (mimeType.startsWith('application/vnd.google-apps.')) {
    // It's a Google Doc/Sheet/etc. - must use export
    console.log(`[Sync] Exporting Google Doc type (${mimeType}) to PDF...`);
    response = await drive.files.export(
      { fileId, mimeType: 'application/pdf' },
      { responseType: 'stream' }
    );
  } else {
    // It's a binary file (JPG, PDF, etc.)
    response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
  }
  
  return new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(destPath);
    response.data
      .on('end', () => resolve(true))
      .on('error', (err) => reject(err))
      .pipe(dest);
  });
}

export async function syncReimbursements() {
  if (!GOOGLE_SHEET_ID) {
    throw new Error('GOOGLE_SHEET_ID is not defined');
  }

  let importedCount = 0;
  const errors: string[] = [];

  try {
    // 1. Fetch data from Google Sheets (Expanding range to A:Z to catch all items)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SHEET_ID,
      range: `${SHEET_NAME}!A:Z`, 
    });

    const rows = response.data.values;
    console.log('[Sync] Fetched rows count:', rows?.length || 0);
    
    if (!rows || rows.length <= 1) {
      console.log('[Sync] No data or only headers found.');
      return { importedCount: 0, errors: ['No data found or only header row exists'] };
    }

    const headers = rows[0];
    console.log('[Sync] Sheet Headers:', headers);

    const getCol = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));

    const globalCols = {
      timestamp: getCol('Timestamp'),
      name: getCol('Employee Name'),
      id: getCol('Employee ID'),
      dateOfPayment: getCol('Date of Payment'),
      purpose: getCol('Payment For'),
    };

    console.log('[Sync] Global Column Mapping:', globalCols);
    
    // Debug: Print indices for all items
    for (let j = 1; j <= 3; j++) {
      console.log(`[Sync] Item ${j} Mapping:`, {
        amount: getCol(`Amount (Item ${j})`),
        description: getCol(`Description (Item ${j})`),
        receipt: getCol(`Upload Receipt (Item ${j})`)
      });
    }

    const dataRows = rows.slice(1);

    for (let i = 0; i < dataRows.length; i++) {
      const rowIndex = i + 2;
      const row = dataRows[i];

      console.log(`\n--- [DEBUG] RAW DATA FOR ROW ${rowIndex} ---`);
      console.log(JSON.stringify(row, null, 2));
      console.log('-------------------------------------------\n');
      
      const timestamp = row[globalCols.timestamp] || '';
      const employeeName = row[globalCols.name] || 'Unknown';
      const employeeId = row[globalCols.id] || 'no-id';

      // Process up to 3 items per row
      for (let itemIdx = 1; itemIdx <= 3; itemIdx++) {
        const amtCol = getCol(`Amount (Item ${itemIdx})`);
        const descCol = getCol(`Description (Item ${itemIdx})`);
        const receiptCol = getCol(`Upload Receipt (Item ${itemIdx})`);

        console.log(`[Sync] Item ${itemIdx} looking at Column ${receiptCol}: "${row[receiptCol]}"`);

        if (amtCol === -1 || !row[amtCol]) continue;

        const amount = parseFloat(row[amtCol].toString().replace(/[^0-9.]/g, ''));
        if (isNaN(amount) || amount <= 0) continue;

        const description = row[descCol] || row[globalCols.purpose] || 'Reimbursement';
        const receiptUrl = row[receiptCol] || '';

        console.log(`[Sync] Row ${rowIndex} Item ${itemIdx} Raw Receipt URL: "${receiptUrl}"`);

        // Unique ID for idempotency: hash of timestamp + employeeId + item index
        const syncHash = crypto.createHash('md5')
          .update(`${timestamp}-${employeeId}-item${itemIdx}`)
          .digest('hex');

        // Check if already exists in local DB
        const existing = db.prepare('SELECT id FROM reimbursements WHERE sync_hash = ?').get(syncHash);
        if (existing) continue;

        let localFilePath = '';
        const fileId = getFileIdFromUrl(receiptUrl);

        if (fileId) {
          try {
            const safeTimestamp = timestamp.replace(/[:/ ]/g, '_') || Date.now().toString();
            const fileName = `${employeeId}_item${itemIdx}_${safeTimestamp}.jpg`;
            localFilePath = `/receipts/${fileName}`;
            const fullPath = path.join(RECEIPTS_DIR, fileName);
            
            console.log(`[Sync] Attempting download for File ID: ${fileId}`);
            await downloadDriveFile(fileId, fullPath);
            console.log(`[Sync] Successfully saved: ${localFilePath}`);
          } catch (err: any) {
            console.error(`[Sync] Failed download for Row ${rowIndex} Item ${itemIdx}:`, err.message);
          }
        } else if (receiptUrl) {
          console.warn(`[Sync] Could not extract File ID from URL: ${receiptUrl}`);
        }

        try {
          // Insert into SQLite (ID is auto-incremented starting from 1000)
          db.prepare(`
            INSERT INTO reimbursements (sync_hash, employee_name, employee_id, amount, description, receipt_url, local_file_path, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(syncHash, employeeName, employeeId, amount, description, receiptUrl, localFilePath, 'PROCESSED');

          importedCount++;
          console.log(`[Sync] Imported Item ${itemIdx} for ${employeeName} (Row ${rowIndex})`);
        } catch (err: any) {
          console.error(`[Sync] Database error for Row ${rowIndex} Item ${itemIdx}:`, err.message);
          errors.push(`Row ${rowIndex} Item ${itemIdx}: ${err.message}`);
        }
      }
    }

    // Log the sync
    db.prepare('INSERT INTO sync_logs (records_imported, status) VALUES (?, ?)').run(importedCount, errors.length > 0 ? 'PARTIAL' : 'SUCCESS');

    return { importedCount, errors };
  } catch (err: any) {
    console.error('Sync failed:', err);
    db.prepare('INSERT INTO sync_logs (records_imported, status, error_message) VALUES (?, ?, ?)')
      .run(0, 'FAILED', err.message);
    throw err;
  }
}
