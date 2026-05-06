import { NextResponse } from 'next/server';
import { syncReimbursements } from '@/lib/sync';

export async function POST() {
  try {
    const result = await syncReimbursements();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Sync Error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Optional: Return sync history/status
  return NextResponse.json({ message: 'Use POST to trigger sync' });
}
