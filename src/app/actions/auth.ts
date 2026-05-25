"use server";

import db from "@/lib/db";
import nodemailer from "nodemailer";
import { cookies } from "next/headers";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function requestOtp(email: string) {
  // Check if admin exists
  const result = await db.execute({
    sql: 'SELECT id FROM admins WHERE email = ?',
    args: [email.toLowerCase()]
  });

  if (result.rows.length === 0) {
    return { success: false, error: "Email is not authorized as an admin." };
  }

  // Generate 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Save OTP in DB
  await db.execute({
    sql: 'UPDATE admins SET otp = ?, otp_expires_at = ? WHERE email = ?',
    args: [otp, expiresAt, email.toLowerCase()]
  });

  // Send email
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "HR Dashboard Login - Your OTP",
      text: `Your login OTP is: ${otp}\n\nIt is valid for 10 minutes.`,
      html: `<p>Your login OTP is: <strong style="font-size: 1.5rem;">${otp}</strong></p><p>It is valid for 10 minutes.</p>`,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send email", error);
    return { success: false, error: "Failed to send OTP email. Please check SMTP configuration." };
  }
}

export async function verifyOtp(email: string, otp: string) {
  const result = await db.execute({
    sql: 'SELECT * FROM admins WHERE email = ? AND otp = ?',
    args: [email.toLowerCase(), otp]
  });

  if (result.rows.length === 0) {
    return { success: false, error: "Invalid or expired OTP" };
  }

  const admin = result.rows[0];
  const expiresAt = admin.otp_expires_at as number;

  if (Date.now() > expiresAt) {
    return { success: false, error: "OTP has expired" };
  }

  // Clear OTP
  await db.execute({
    sql: 'UPDATE admins SET otp = NULL, otp_expires_at = NULL WHERE email = ?',
    args: [email.toLowerCase()]
  });

  // Set cookie securely
  (await cookies()).set("auth_token", "true", {
    path: "/",
    maxAge: 86400 * 7, // 7 days
    httpOnly: false, 
    secure: process.env.NODE_ENV === "production"
  });

  return { success: true };
}
