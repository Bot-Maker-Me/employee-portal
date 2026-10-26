/**
 * Temporary passwords for admin-driven resets. SERVER ONLY — this module is
 * imported by server actions only, so the generator never lands in a client
 * bundle. The value is returned to the administrator once and is never stored,
 * logged, emailed or audited by this app.
 */
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*";

function pick(source: string, byte: number): string {
  return source[byte % source.length];
}

/** 20 characters, always with digits and a symbol, so it satisfies the policy. */
export function generateTemporaryPassword(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);

  const chars: string[] = [];
  for (let i = 0; i < 20; i += 1) chars.push(pick(LETTERS, bytes[i]));

  // Guarantee the character classes the policy hint promises.
  chars[4] = pick(DIGITS, bytes[1]);
  chars[11] = pick(DIGITS, bytes[7]);
  chars[17] = pick(SYMBOLS, bytes[13]);
  chars[2] = pick(SYMBOLS, bytes[19]);

  return chars.join("");
}

/** A placeholder email local part: random, meaningless and never shown. */
export function randomLocalPart(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
