/**
 * Web-push helpers. The VAPID public key is read directly from
 * process.env at call time and never hardcoded.
 */

/** Returns the trimmed VAPID public key if it looks valid, else null. */
export function getVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
  if (!key) return null;
  // An uncompressed P-256 point: starts with "B", ~87 URL-safe base64 chars.
  if (!/^B[A-Za-z0-9_-]{80,100}$/.test(key)) return null;
  return key;
}

export function isVapidKeyConfigured(): boolean {
  return getVapidPublicKey() !== null;
}

/** First 6 characters only — safe to show in diagnostics. */
export function vapidKeyPrefix(): string {
  return getVapidPublicKey()?.slice(0, 6) ?? "";
}

/** Convert a base64url VAPID key into the Uint8Array the Push API expects. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
