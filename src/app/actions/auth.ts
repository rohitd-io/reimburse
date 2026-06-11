"use server";

import db from "@/lib/db";
import nodemailer from "nodemailer";
import { cookies } from "next/headers";
import { signSession } from "@/lib/session";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function requestOtp(
  email: string,
  num1?: number,
  num2?: number,
  captchaAnswer?: string,
  honeypot?: string
) {
  if (honeypot) {
    // Silently ignore bots
    return { success: true };
  }

  // Server-side CAPTCHA verification
  if (num1 === undefined || num2 === undefined || !captchaAnswer) {
    return { success: false, error: "Verification parameters are missing. Please solve the CAPTCHA." };
  }

  if (parseInt(captchaAnswer) !== num1 + num2) {
    return { success: false, error: "Security verification failed. Please try again." };
  }

  // Check if admin exists
  const result = await db.execute({
    sql: 'SELECT id, otp_expires_at FROM admins WHERE email = ?',
    args: [email.toLowerCase()]
  });

  if (result.rows.length === 0) {
    return { success: false, error: "Email is not authorized as an admin." };
  }

  // Cooldown rate-limit check (60 seconds)
  const lastExpiry = result.rows[0].otp_expires_at as number | null;
  if (lastExpiry) {
    const timeSinceLastRequest = lastExpiry - 10 * 60 * 1000;
    const timeElapsed = Date.now() - timeSinceLastRequest;
    if (timeElapsed > 0 && timeElapsed < 60 * 1000) {
      const secondsLeft = Math.ceil((60 * 1000 - timeElapsed) / 1000);
      return { success: false, error: `Please wait ${secondsLeft} seconds before requesting a new OTP.` };
    }
  }

  // Generate 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Save OTP in DB and reset attempts to 0
  await db.execute({
    sql: 'UPDATE admins SET otp = ?, otp_expires_at = ?, otp_attempts = 0 WHERE email = ?',
    args: [otp, expiresAt, email.toLowerCase()]
  });

  // Send email
  try {
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    const currentYear = new Date().getFullYear();

    await transporter.sendMail({
      from: `"Emertech Reimbursement Dashboard" <${fromEmail}>`,
      to: email,
      subject: "Reimburse Dashboard Login - Your OTP",
      text: `Emertech Reimbursement Dashboard Login\n\nYou are requesting access to the Reimbursement Dashboard. Please use the following One-Time Password (OTP) to complete your login:\n\nOTP: ${otp}\n\nThis OTP is valid for 10 minutes. If you did not request this, please ignore this email.\n\n© ${currentYear} Emertech Innovations Pvt. Ltd.`,
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Login OTP</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      color: #0f172a;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 500px;
      margin: 2rem auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      border: 1px solid #e2e8f0;
    }
    .header {
      background-color: #0f172a;
      padding: 2rem;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      font-size: 1.35rem;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.025em;
    }
    .content {
      padding: 2.5rem 2rem;
      text-align: center;
    }
    .welcome-text {
      font-size: 0.95rem;
      color: #475569;
      margin-top: 0;
      margin-bottom: 1.5rem;
      line-height: 1.6;
    }
    .otp-card {
      background-color: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 1.25rem 2rem;
      margin: 1.5rem 0;
      display: inline-block;
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 2.25rem;
      font-weight: 800;
      color: #2563eb;
      letter-spacing: 0.2em;
      margin: 0;
    }
    .expiry-note {
      font-size: 0.875rem;
      color: #64748b;
      margin: 1.5rem 0 0 0;
      line-height: 1.5;
    }
    .footer {
      background-color: #f8fafc;
      padding: 1.25rem 2rem;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer p {
      font-size: 0.75rem;
      color: #94a3b8;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Emertech Innovations</h1>
    </div>
    <div class="content">
      <p class="welcome-text">You are requesting access to the Reimbursement Dashboard. Please use the following One-Time Password (OTP) to complete your login:</p>
      <div class="otp-card">
        <div class="otp-code">${otp}</div>
      </div>
      <p class="expiry-note">This OTP is valid for <strong>10 minutes</strong>. If you did not request this login, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; ${currentYear} Emertech Innovations Pvt. Ltd. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send email", error);
    return { success: false, error: "Failed to send OTP email. Please check SMTP configuration." };
  }
}

export async function verifyOtp(email: string, otp: string, honeypot?: string) {
  if (honeypot) {
    // Silently ignore bots
    return { success: true };
  }

  const result = await db.execute({
    sql: 'SELECT * FROM admins WHERE email = ?',
    args: [email.toLowerCase()]
  });

  if (result.rows.length === 0) {
    return { success: false, error: "Invalid or expired OTP" };
  }

  const admin = result.rows[0];
  const storedOtp = admin.otp as string | null;
  const expiresAt = admin.otp_expires_at as number | null;
  const attempts = (admin.otp_attempts as number) || 0;

  if (attempts >= 5) {
    // Invalidate OTP entirely
    await db.execute({
      sql: 'UPDATE admins SET otp = NULL, otp_expires_at = NULL WHERE email = ?',
      args: [email.toLowerCase()]
    });
    return { success: false, error: "Too many failed attempts. This OTP has been invalidated. Please request a new one." };
  }

  if (!storedOtp || !expiresAt || Date.now() > expiresAt) {
    return { success: false, error: "OTP has expired or is invalid. Please request a new one." };
  }

  if (storedOtp !== otp) {
    const newAttempts = attempts + 1;
    if (newAttempts >= 5) {
      await db.execute({
        sql: 'UPDATE admins SET otp = NULL, otp_expires_at = NULL, otp_attempts = 0 WHERE email = ?',
        args: [email.toLowerCase()]
      });
      return { success: false, error: "Too many failed attempts. This OTP has been invalidated. Please request a new one." };
    } else {
      await db.execute({
        sql: 'UPDATE admins SET otp_attempts = ? WHERE email = ?',
        args: [newAttempts, email.toLowerCase()]
      });
      return { success: false, error: `Invalid OTP. You have ${5 - newAttempts} attempts remaining.` };
    }
  }

  // Clear OTP and reset attempts on success
  await db.execute({
    sql: 'UPDATE admins SET otp = NULL, otp_expires_at = NULL, otp_attempts = 0 WHERE email = ?',
    args: [email.toLowerCase()]
  });

  // Set cookie securely with cryptographically signed token
  const sessionToken = await signSession({
    email: email.toLowerCase(),
    expires: Date.now() + 3600 * 1000 // 1 hour
  });

  (await cookies()).set("emertech_reimburse_session", sessionToken, {
    path: "/",
    maxAge: 3600, // 1 hour
    httpOnly: true, 
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  });

  return { success: true };
}

export async function logout() {
  (await cookies()).delete("emertech_reimburse_session");
  return { success: true };
}
