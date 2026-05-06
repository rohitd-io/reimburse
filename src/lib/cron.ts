import cron from 'node-cron';
import { syncReimbursements } from './sync';

let isCronStarted = false;

export function initCron() {
  if (isCronStarted) return;
  
  // Run every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log('[Cron] Starting scheduled sync...');
    try {
      const result = await syncReimbursements();
      console.log(`[Cron] Sync complete: Imported ${result.importedCount} records.`);
    } catch (error) {
      console.error('[Cron] Sync failed:', error);
    }
  });

  isCronStarted = true;
  console.log('[Cron] Scheduled sync initialized (every 10 minutes).');
}
