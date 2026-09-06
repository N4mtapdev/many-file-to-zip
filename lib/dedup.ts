/**
 * Computes a SHA-256 hex hash of a file's raw bytes using the browser's
 * built-in Web Crypto API (no external library needed). Two files with the
 * exact same byte content will always produce the same hash — this is an
 * exact-match check, not a perceptual/similarity check.
 */
export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeFileName(name: string): string {
  return name.trim().toLowerCase();
}
