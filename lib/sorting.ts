export type SortMode =
  | "natural"
  | "alphabetical"
  | "upload_time"
  | "size"
  | "extension"
  | "manual";

export interface SortableFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: number; // ms timestamp, order of adding
  manualOrder?: number;
}

/**
 * Natural sort: splits the string into numeric and non-numeric chunks so
 * "file2" sorts before "file10" (unlike plain alphabetical sort).
 */
export function naturalCompare(a: string, b: string): number {
  const chunk = /(\d+|\D+)/g;
  const aParts = a.match(chunk) || [];
  const bParts = b.match(chunk) || [];
  const len = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < len; i++) {
    const ap = aParts[i] ?? "";
    const bp = bParts[i] ?? "";
    if (ap === bp) continue;

    const aNum = Number(ap);
    const bNum = Number(bp);
    const aIsNum = ap !== "" && !Number.isNaN(aNum);
    const bIsNum = bp !== "" && !Number.isNaN(bNum);

    if (aIsNum && bIsNum) {
      if (aNum !== bNum) return aNum - bNum;
      continue;
    }
    return ap.localeCompare(bp, undefined, { sensitivity: "base" });
  }
  return 0;
}

export function sortFiles<T extends SortableFile>(
  files: T[],
  mode: SortMode
): T[] {
  const copy = [...files];
  switch (mode) {
    case "natural":
      return copy.sort((a, b) => naturalCompare(a.name, b.name));
    case "alphabetical":
      return copy.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
    case "upload_time":
      return copy.sort((a, b) => a.uploadedAt - b.uploadedAt);
    case "size":
      return copy.sort((a, b) => a.size - b.size);
    case "extension":
      return copy.sort((a, b) => {
        const extA = getExtension(a.name);
        const extB = getExtension(b.name);
        if (extA === extB) return naturalCompare(a.name, b.name);
        return extA.localeCompare(extB);
      });
    case "manual":
      return copy.sort(
        (a, b) => (a.manualOrder ?? 0) - (b.manualOrder ?? 0)
      );
    default:
      return copy;
  }
}

export function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx === -1 || idx === 0) return "";
  return name.slice(idx + 1).toLowerCase();
}

export function getBaseName(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx === -1 || idx === 0) return name;
  return name.slice(0, idx);
}

/**
 * Extracts a numeric "STT" (sequence number) from a filename by
 * concatenating every digit found, ignoring letters and separators like
 * underscores. E.g. "HappyColor_1101.png" -> 1101. Returns null if the
 * filename has no digits at all.
 */
export function extractSttNumber(name: string): number | null {
  const digits = name.replace(/\D/g, "");
  if (digits.length === 0) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/**
 * Builds the final renamed filename applying a numeric prefix pattern,
 * e.g. pattern "001_" with padding 3 -> "001_original.pdf"
 * If prefixTemplate is empty, the original name is preserved.
 */
export function buildRenamedName(
  originalName: string,
  index: number,
  options: {
    usePrefix: boolean;
    padding: number;
    prefixSeparator: string;
    startAt: number;
    keepOriginalName: boolean;
    customTemplate?: string; // e.g. "{n}_{name}" or "part-{n}"
  }
): string {
  const { usePrefix, padding, prefixSeparator, startAt, keepOriginalName, customTemplate } =
    options;
  const n = index + startAt;
  const padded = String(n).padStart(padding, "0");
  const ext = getExtension(originalName);
  const base = getBaseName(originalName);
  const extSuffix = ext ? `.${ext}` : "";

  if (customTemplate) {
    const replaced = customTemplate
      .replace(/\{n\}/g, padded)
      .replace(/\{name\}/g, base);
    return `${replaced}${extSuffix}`;
  }

  if (!usePrefix) return originalName;

  const namePart = keepOriginalName ? `${prefixSeparator}${base}` : "";
  return `${padded}${namePart}${extSuffix}`;
}
