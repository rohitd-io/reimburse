const encoder = new TextEncoder();

async function getKey(): Promise<CryptoKey> {
  // Use SESSION_SECRET from env, fallback to a secure default if not set (not recommended for production)
  const secret = process.env.SESSION_SECRET || "emertech-reimbursement-fallback-secret-at-least-32-bytes";
  const keyData = encoder.encode(secret);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export interface SessionPayload {
  email: string;
  expires: number;
}

/**
 * Signs a session payload and returns a base64 encoded token.
 */
export async function signSession(payload: SessionPayload): Promise<string> {
  const key = await getKey();
  const dataStr = JSON.stringify(payload);
  const dataBytes = encoder.encode(dataStr);
  const signature = await crypto.subtle.sign("HMAC", key, dataBytes);
  
  // Safe Base64 encoding for headers/cookies
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  const payloadBase64 = btoa(dataStr)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
    
  return `${payloadBase64}.${signatureBase64}`;
}

/**
 * Verifies a session token and returns the payload if valid and not expired.
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    if (!token) return null;
    const [payloadBase64, signatureBase64] = token.split(".");
    if (!payloadBase64 || !signatureBase64) return null;

    const key = await getKey();
    
    // Decode safe Base64
    const dataStr = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"));
    const dataBytes = encoder.encode(dataStr);

    const sigBin = atob(signatureBase64.replace(/-/g, "+").replace(/_/g, "/"));
    const sigBytes = new Uint8Array(sigBin.length);
    for (let i = 0; i < sigBin.length; i++) {
      sigBytes[i] = sigBin.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);
    if (!isValid) return null;

    const payload = JSON.parse(dataStr) as SessionPayload;
    
    // Verify expiration time
    if (Date.now() > payload.expires) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
