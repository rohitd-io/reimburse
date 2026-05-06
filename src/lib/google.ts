import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
  // Fallback to JSON string if path is not provided
  credentials: process.env.GOOGLE_SERVICE_ACCOUNT_PATH 
    ? undefined 
    : JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
});

export const sheets = google.sheets({ version: 'v4', auth });
export const drive = google.drive({ version: 'v3', auth });
export const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
