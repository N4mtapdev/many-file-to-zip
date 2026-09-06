import { supabase, BATCH_FILES_BUCKET } from "./supabase";
import type { SortMode } from "./sorting";
import { sortFiles, buildRenamedName } from "./sorting";

// Fallback for browsers/WebViews where crypto.randomUUID is unavailable
// (older Android WebView, non-HTTPS contexts, etc).
function safeRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

export interface BatchRow {
  id: string;
  session_id: string;
  name: string;
  sort_mode: SortMode;
  status: string;
  file_count: number;
  total_size_bytes: number;
  threshold: number;
  is_full: boolean;
  range_index: number | null;
  zipped_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchFileRow {
  id: string;
  batch_id: string;
  original_name: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string | null;
  sort_order: number;
  renamed_name: string | null;
  content_hash: string | null;
  created_at: string;
}

// The app is now gated behind Google sign-in to a single allowed account
// (enforced by middleware + NextAuth callback), so every device signs in
// as the same user. Using a fixed key here means all devices automatically
// share the same batches instead of each getting an isolated local session.
const SHARED_ACCOUNT_KEY = "noreply.n4mtapdev@gmail.com";

export function getSessionId(): string {
  return SHARED_ACCOUNT_KEY;
}

/**
 * Returns the batch whose STT range contains the given sequence number,
 * creating it if it doesn't exist yet. Range index 0 covers STT
 * (1..threshold], index 1 covers (threshold..2*threshold], etc. A file
 * with no detectable STT falls back to range index 0 (or the caller's
 * fallback range) so it still lands somewhere sensible.
 */
export async function getOrCreateBatchForRange(
  rangeIndex: number,
  threshold: number,
  sortMode: SortMode
): Promise<BatchRow> {
  const sessionId = getSessionId();

  const { data: existing, error: findError } = await supabase
    .from("batches")
    .select("*")
    .eq("session_id", sessionId)
    .eq("range_index", rangeIndex)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing as BatchRow;

  const rangeStart = rangeIndex * threshold + 1;
  const rangeEnd = (rangeIndex + 1) * threshold;
  const { data, error } = await supabase
    .from("batches")
    .insert({
      session_id: sessionId,
      name: `Lô ${rangeIndex + 1} (STT ${rangeStart}-${rangeEnd})`,
      sort_mode: sortMode,
      threshold,
      range_index: rangeIndex,
    })
    .select()
    .single();
  if (error) throw error;
  return data as BatchRow;
}

/** Computes which range index a given STT falls into for a given threshold. */
export function rangeIndexForStt(stt: number, threshold: number): number {
  return Math.floor((stt - 1) / threshold);
}

export async function uploadFileToBatch(
  batchId: string,
  file: File,
  precomputedHash?: string
): Promise<BatchFileRow> {
  const path = `${batchId}/${safeRandomId()}-${sanitizeFileName(file.name)}`;
  const contentType =
    file.type && file.type.length > 0 ? file.type : "application/octet-stream";

  // Read into an ArrayBuffer first rather than passing the File object
  // directly. Some mobile browsers/WebViews (especially with files shared
  // from Google Drive) produce File objects that the SDK's internal fetch
  // mishandles, surfacing as a CORS-like "status 0" network failure.
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (readErr) {
    const detail = readErr instanceof Error ? readErr.message : String(readErr);
    throw new Error(`Không đọc được file "${file.name}": ${detail}`);
  }

  const { error: uploadError } = await supabase.storage
    .from(BATCH_FILES_BUCKET)
    .upload(path, arrayBuffer, { upsert: false, contentType });
  if (uploadError) {
    throw new Error(
      `${uploadError.message || "Không rõ nguyên nhân"} (path: ${path}, size: ${file.size}, type: "${file.type}")`
    );
  }

  const { data, error } = await supabase
    .from("batch_files")
    .insert({
      batch_id: batchId,
      original_name: file.name,
      storage_path: path,
      size_bytes: file.size,
      mime_type: file.type || null,
      sort_order: 0,
      content_hash: precomputedHash ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as BatchFileRow;
}

/**
 * Re-sorts every file in a batch according to sortMode and persists the
 * new sort_order + computed renamed_name back to Supabase.
 */
export async function resortBatch(
  batchId: string,
  sortMode: SortMode,
  renameOptions: {
    usePrefix: boolean;
    padding: number;
    prefixSeparator: string;
    startAt: number;
    keepOriginalName: boolean;
  }
): Promise<BatchFileRow[]> {
  const files = await listBatchFiles(batchId);
  const sorted = sortFiles(
    files.map((f) => ({
      id: f.id,
      name: f.original_name,
      size: f.size_bytes,
      uploadedAt: new Date(f.created_at).getTime(),
    })),
    sortMode
  );

  const updates = sorted.map((sf, index) => {
    const original = files.find((f) => f.id === sf.id)!;
    const renamed = buildRenamedName(original.original_name, index, renameOptions);
    return { id: sf.id, sort_order: index, renamed_name: renamed };
  });

  const chunkSize = 20;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((u) =>
        supabase
          .from("batch_files")
          .update({ sort_order: u.sort_order, renamed_name: u.renamed_name })
          .eq("id", u.id)
      )
    );
  }

  return listBatchFiles(batchId);
}

export async function listBatchFiles(batchId: string) {
  const { data, error } = await supabase
    .from("batch_files")
    .select("*")
    .eq("batch_id", batchId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data as BatchFileRow[];
}

/**
 * Checks a candidate file against the files already in a batch, matching
 * on filename (case-insensitive) and/or exact content hash (SHA-256 of the
 * raw bytes). Returns the first matching existing file, or null.
 */
export function findDuplicate(
  candidateName: string,
  candidateHash: string,
  existingFiles: BatchFileRow[]
): BatchFileRow | null {
  const normalizedName = candidateName.trim().toLowerCase();
  for (const f of existingFiles) {
    const nameMatch = f.original_name.trim().toLowerCase() === normalizedName;
    const hashMatch = !!f.content_hash && f.content_hash === candidateHash;
    if (nameMatch || hashMatch) return f;
  }
  return null;
}

export async function getBatch(batchId: string) {
  const { data, error } = await supabase
    .from("batches")
    .select("*")
    .eq("id", batchId)
    .single();
  if (error) throw error;
  return data as BatchRow;
}

export async function markBatchFull(batchId: string) {
  const { error } = await supabase
    .from("batches")
    .update({ is_full: true })
    .eq("id", batchId);
  if (error) throw error;
}

export async function markBatchZipped(batchId: string) {
  const { error } = await supabase
    .from("batches")
    .update({ zipped_at: new Date().toISOString(), status: "ready" })
    .eq("id", batchId);
  if (error) throw error;
}

export async function updateBatchCounts(
  batchId: string,
  fileCount: number,
  totalSizeBytes: number
) {
  const { error } = await supabase
    .from("batches")
    .update({ file_count: fileCount, total_size_bytes: totalSizeBytes })
    .eq("id", batchId);
  if (error) throw error;
}

export async function deleteBatchFile(fileId: string, storagePath: string) {
  await supabase.storage.from(BATCH_FILES_BUCKET).remove([storagePath]);
  const { error } = await supabase.from("batch_files").delete().eq("id", fileId);
  if (error) throw error;
}

export async function listMyBatches() {
  const sessionId = getSessionId();
  const { data, error } = await supabase
    .from("batches")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as BatchRow[];
}

export function getPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BATCH_FILES_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function downloadBatchFileBlob(storagePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from(BATCH_FILES_BUCKET)
    .download(storagePath);
  if (error) throw error;
  return data;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
