"use server";

import db from "@/lib/db";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";

export async function getExpenses() {
  const result = await db.execute('SELECT * FROM expenses ORDER BY date DESC');
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

  const name = formData.get('name') as string;
  const department = formData.get('department') as string;
  const itemJSON = formData.get('items') as string;
  const itemsMetadata = JSON.parse(itemJSON);
  const date = new Date().toISOString().split('T')[0];
  
  const info = await db.execute({
    sql: 'INSERT INTO expenses (date, name, department, status) VALUES (?, ?, ?, ?) RETURNING id',
    args: [date, name, department, 'Pending']
  });
  
  const newId = info.rows[0].id;

  for (let i = 0; i < itemsMetadata.length; i++) {
    const item = itemsMetadata[i];
    const file = formData.get(`proof_${i}`) as File;
    let proofPath = "";
    
    if (file && file.size > 0) {
      // Use Vercel Blob storage to upload the file privately
      const blob = await put(`proofs/${newId}_${i}_${file.name}`, file, {
        access: 'private',
      });
      proofPath = blob.url;
    }
    
    await db.execute({
      sql: 'INSERT INTO expense_items (expense_id, category, amount, description, proof_path, payment_method, reference_no) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [String(newId), item.category, item.amount, item.description, proofPath, item.paymentMethod || null, item.referenceNo || null]
    });
  }

  revalidatePath('/');
  revalidatePath('/dashboard');
  return { success: true, id: newId?.toString() };
}

export async function updateExpenseStatus(id: string | number, status: string) {
  await db.execute({
    sql: 'UPDATE expenses SET status = ? WHERE id = ?',
    args: [status, String(id)]
  });
  revalidatePath('/');
  return { success: true };
}
