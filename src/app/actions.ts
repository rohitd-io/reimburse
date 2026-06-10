"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { headers } from "next/headers";

// Simple in-memory rate limiting cache
// Key: IP address, Value: Array of timestamps of submissions in the last minute
const rateLimitMap = new Map<string, number[]>();

export async function getExpenses() {
  const result = await db.execute('SELECT * FROM expenses ORDER BY date DESC, id DESC');
  const expenses = result.rows;
  
  const results = await Promise.all(expenses.map(async (exp) => {
    const itemsResult = await db.execute({
      sql: 'SELECT * FROM expense_items WHERE expense_id = ?',
      args: [String(exp.id)]
    });
    return { ...exp, items: itemsResult.rows };
  }));
  
  return JSON.parse(JSON.stringify(results));
}

export async function submitExpense(formData: FormData) {
  const honeypot = formData.get('honeypot') as string;
  if (honeypot) {
    // Honeypot field was filled out, likely a bot. Silently ignore.
    return { success: true, id: null };
  }

  // Server-side CAPTCHA verification
  const num1 = formData.get('num1') as string;
  const num2 = formData.get('num2') as string;
  const captchaAnswer = formData.get('captchaAnswer') as string;

  if (!num1 || !num2 || !captchaAnswer) {
    return { success: false, error: "Verification parameters are missing. Please solve the CAPTCHA." };
  }

  if (parseInt(captchaAnswer) !== parseInt(num1) + parseInt(num2)) {
    return { success: false, error: "Spam verification failed. Please try again." };
  }

  // IP-based Rate Limiting (Cooldown check: max 3 requests per minute per IP)
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 3;
  
  const clientSubmissions = rateLimitMap.get(ip) || [];
  const recentSubmissions = clientSubmissions.filter(time => now - time < windowMs);
  
  if (recentSubmissions.length >= maxRequests) {
    const oldestRecent = recentSubmissions[0];
    const secondsLeft = Math.ceil((windowMs - (now - oldestRecent)) / 1000);
    return { 
      success: false, 
      error: `Too many submissions. Please wait ${secondsLeft} seconds and try again.` 
    };
  }
  
  recentSubmissions.push(now);
  rateLimitMap.set(ip, recentSubmissions);

  const name = formData.get('name') as string;
  const department = formData.get('department') as string;
  const itemJSON = formData.get('items') as string;
  const itemsMetadata = JSON.parse(itemJSON);
  const date = new Date().toISOString();
  
  const settingsResult = await db.execute({
    sql: 'SELECT value FROM settings WHERE key = ?',
    args: ['next_receipt_no']
  });
  let receiptNo = 3000;
  if (settingsResult.rows.length > 0) {
    receiptNo = parseInt(settingsResult.rows[0].value as string);
    await db.execute({
      sql: 'UPDATE settings SET value = ? WHERE key = ?',
      args: [String(receiptNo + 1), 'next_receipt_no']
    });
  } else {
    const maxReceiptResult = await db.execute('SELECT MAX(receipt_no) as max_receipt FROM expenses');
    const maxReceipt = maxReceiptResult.rows[0]?.max_receipt as number | null;
    receiptNo = maxReceipt && maxReceipt >= 3000 ? maxReceipt + 1 : 3000;
    
    await db.execute({
      sql: 'INSERT INTO settings (key, value) VALUES (?, ?)',
      args: ['next_receipt_no', String(receiptNo + 1)]
    });
  }
  
  const info = await db.execute({
    sql: 'INSERT INTO expenses (date, name, department, status, receipt_no) VALUES (?, ?, ?, ?, ?) RETURNING id',
    args: [date, name, department, 'Pending', receiptNo]
  });
  
  const newId = info.rows[0].id;
  const itemsWithProof = [];

  for (let i = 0; i < itemsMetadata.length; i++) {
    const item = itemsMetadata[i];
    const proofPaths: string[] = [];
    
    let j = 0;
    while (true) {
      const file = formData.get(`proof_${i}_${j}`) as File;
      if (!file) break;
      
      if (file.size > 0) {
        const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImage = file.type.startsWith('image/');
        if (!isPDF && !isImage) {
          throw new Error(`Unsupported file type: "${file.name}". Only images and PDFs are allowed.`);
        }
        
        // Use Vercel Blob storage to upload the file privately
        const blob = await put(`proofs/${newId}_${i}_${j}_${file.name}`, file, {
          access: 'private',
        });
        proofPaths.push(blob.url);
      }
      j++;
    }
    
    const proofPathValue = proofPaths.length > 0 ? JSON.stringify(proofPaths) : "";
    
    await db.execute({
      sql: 'INSERT INTO expense_items (expense_id, category, amount, description, proof_path, payment_method, reference_no) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [String(newId), item.category, item.amount, item.description, proofPathValue, item.paymentMethod || null, item.referenceNo || null]
    });

    itemsWithProof.push({
      category: item.category,
      amount: item.amount,
      description: item.description,
      proof_path: proofPathValue || undefined,
      payment_method: item.paymentMethod || undefined,
      reference_no: item.referenceNo || undefined
    });
  }

  revalidatePath('/');
  revalidatePath('/dashboard');
  return {
    success: true,
    expense: {
      id: newId?.toString(),
      status: 'Pending',
      receipt_no: receiptNo,
      date,
      name,
      department,
      items: itemsWithProof
    }
  };
}

export async function updateExpenseStatus(id: string | number, status: string) {
  await db.execute({
    sql: 'UPDATE expenses SET status = ? WHERE id = ?',
    args: [status, String(id)]
  });
  revalidatePath('/');
  return { success: true };
}

export async function getReceiptCounter() {
  const result = await db.execute({
    sql: 'SELECT value FROM settings WHERE key = ?',
    args: ['next_receipt_no']
  });
  if (result.rows.length > 0) {
    return parseInt(result.rows[0].value as string);
  }
  const maxReceiptResult = await db.execute('SELECT MAX(receipt_no) as max_receipt FROM expenses');
  const maxReceipt = maxReceiptResult.rows[0]?.max_receipt as number | null;
  return maxReceipt && maxReceipt >= 3000 ? maxReceipt + 1 : 3000;
}

export async function updateReceiptCounter(newCount: number) {
  const result = await db.execute({
    sql: 'SELECT value FROM settings WHERE key = ?',
    args: ['next_receipt_no']
  });
  if (result.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE settings SET value = ? WHERE key = ?',
      args: [String(newCount), 'next_receipt_no']
    });
  } else {
    await db.execute({
      sql: 'INSERT INTO settings (key, value) VALUES (?, ?)',
      args: ['next_receipt_no', String(newCount)]
    });
  }
  revalidatePath('/dashboard');
  return { success: true };
}

export async function getEmployeeSuggestions(): Promise<string[]> {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  
  interface TeamMemberAttribute {
    name?: string;
    designation?: string;
    rank?: number;
  }

  interface TeamMember {
    id: number;
    attributes: TeamMemberAttribute;
  }

  interface APIResponse {
    data?: TeamMember[];
  }

  try {
    const cacheResult = await db.execute({
      sql: 'SELECT value FROM settings WHERE key = ?',
      args: ['employee_names_cache']
    });
    
    const cacheTimeResult = await db.execute({
      sql: 'SELECT value FROM settings WHERE key = ?',
      args: ['employee_names_cache_time']
    });
    
    const cachedValue = cacheResult.rows[0]?.value as string | undefined;
    const cachedTime = cacheTimeResult.rows[0]?.value ? parseInt(cacheTimeResult.rows[0].value as string) : 0;
    
    if (cachedValue && (now - cachedTime < oneDay)) {
      try {
        return JSON.parse(cachedValue) as string[];
      } catch {
        // Parse error, ignore and fetch fresh
      }
    }
    
    console.log("Fetching fresh team names from CMS API...");
    const response = await fetch('https://cms.emertech.io/api/teams?populate=*&sort=rank:ASC', {
      next: { revalidate: 86400 } // Fetch cache daily in Next.js fetch cache
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from API: ${response.statusText}`);
    }
    
    const json = (await response.json()) as APIResponse;
    const names: string[] = (json.data || [])
      .map((item) => item.attributes?.name?.trim())
      .filter((name): name is string => typeof name === "string" && name.length > 0);
      
    await db.execute({
      sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      args: ['employee_names_cache', JSON.stringify(names)]
    });
    
    await db.execute({
      sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      args: ['employee_names_cache_time', String(now)]
    });
    
    return names;
  } catch (err) {
    console.error("Error fetching or caching employee names:", err);
    try {
      const cacheResult = await db.execute({
        sql: 'SELECT value FROM settings WHERE key = ?',
        args: ['employee_names_cache']
      });
      const cachedValue = cacheResult.rows[0]?.value as string | undefined;
      if (cachedValue) return JSON.parse(cachedValue) as string[];
    } catch {}
    return [];
  }
}
