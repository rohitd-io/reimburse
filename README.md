# Emertech Reimbursement System - Production Guide

This application is built with Next.js and SQLite. Follow these steps to run the app in "Usage Mode" on any local machine.

## 1. Prerequisites
- **Node.js** (v18 or higher) installed on the machine.

## 2. Configuration
Ensure the following files are present in the root directory:
- `.env`: Contains your Spreadsheet ID and other settings.
- `emertech-utilities.json`: Your Google Service Account key file.

## 3. Installation
Open your terminal in this folder and run:
```bash
npm install
```

## 4. Production Build
To optimize the application for speed and stability, run the build command:
```bash
npm run build
```

## 5. Running the App (Usage Mode)
To start the application for daily use:
```bash
npm run start
```
The app will be available at: **http://localhost:3000**

---

## Utility Commands
- **Reset Database**: `npm run reset-db` (Deletes all data and starts fresh)
- **Clear Receipts**: `rm -rf public/receipts/*`
