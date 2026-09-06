import type { SortMode } from "./sorting";
import { extractSttNumber } from "./sorting";
import { computeFileHash } from "./dedup";
import {
  getOrCreateBatchForRange,
  rangeIndexForStt,
  uploadFileToBatch,
  resortBatch,
  markBatchFull,
  updateBatchCounts,
  findDuplicate,
  listBatchFiles,
  type BatchRow,
  type BatchFileRow,
} from "./batchStore";
import type { DuplicateWarningData } from "@/components/DuplicateWarningModal";

export interface UploadQueueState {
  queueLength: number;
  processing: boolean;
  resorting: boolean;
  error: string | null;
  duplicateWarning: DuplicateWarningData | null;
  batchUpdate: { batch: BatchRow; files: BatchFileRow[] } | null;
}

type Listener = (state: UploadQueueState) => void;

interface RenameOptionsShape {
  usePrefix: boolean;
  padding: number;
  prefixSeparator: string;
  startAt: number;
  keepOriginalName: boolean;
}

/**
 * Module-level singleton. Because this lives at module scope (not inside a
 * React component), the queue and its progress survive navigating between
 * pages (e.g. Home -> /batches -> back to Home) — only a full page reload
 * or closing the tab would reset it. React components subscribe via
 * `subscribe()` to receive live updates and re-render accordingly.
 */
class UploadQueueManager {
  private queue: File[] = [];
  private processing = false;
  private resorting = false;
  private error: string | null = null;
  private duplicateWarning: DuplicateWarningData | null = null;
  private listeners = new Set<Listener>();

  private threshold = 100;
  private sortMode: SortMode = "natural";
  private renameOptions: RenameOptionsShape = {
    usePrefix: false,
    padding: 3,
    prefixSeparator: "_",
    startAt: 1,
    keepOriginalName: true,
  };

  setConfig(threshold: number, sortMode: SortMode, renameOptions: RenameOptionsShape) {
    this.threshold = threshold;
    this.sortMode = sortMode;
    this.renameOptions = renameOptions;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private emit(batchUpdate: UploadQueueState["batchUpdate"] = null) {
    const state = this.getState(batchUpdate);
    this.listeners.forEach((l) => l(state));
  }

  private getState(batchUpdate: UploadQueueState["batchUpdate"] = null): UploadQueueState {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      resorting: this.resorting,
      error: this.error,
      duplicateWarning: this.duplicateWarning,
      batchUpdate,
    };
  }

  addFiles(files: File[]) {
    this.error = null;
    this.queue = [...this.queue, ...files];
    this.emit();
    if (!this.processing) {
      this.processNext();
    }
  }

  skipDuplicate() {
    this.queue = this.queue.slice(1);
    this.duplicateWarning = null;
    this.emit();
    this.processNext();
  }

  async keepDuplicateBoth() {
    const file = this.queue[0];
    this.duplicateWarning = null;
    if (!file) {
      this.emit();
      return;
    }
    try {
      const stt = extractSttNumber(file.name);
      const rangeIndex = stt !== null ? rangeIndexForStt(stt, this.threshold) : 0;
      const batch = await getOrCreateBatchForRange(rangeIndex, this.threshold, this.sortMode);
      const hash = await computeFileHash(file);
      await uploadFileToBatch(batch.id, file, hash);
      this.queue = this.queue.slice(1);
      const sorted = await this.finalizeBatch(batch);
      this.emit({ batch, files: sorted });
    } catch (e) {
      this.error = `Lỗi khi tải "${file.name}": ${e instanceof Error ? e.message : String(e)}`;
      this.queue = this.queue.slice(1);
      this.emit();
    }
    this.processNext();
  }

  private async finalizeBatch(batch: BatchRow): Promise<BatchFileRow[]> {
    const sorted = await resortBatch(batch.id, this.sortMode, this.renameOptions);
    await updateBatchCounts(
      batch.id,
      sorted.length,
      sorted.reduce((sum, f) => sum + f.size_bytes, 0)
    );
    const nowFull = sorted.length >= batch.threshold;
    if (nowFull) await markBatchFull(batch.id);
    return sorted;
  }

  private async processNext() {
    if (this.processing) return;
    this.processing = true;
    this.emit();

    while (this.queue.length > 0) {
      const file = this.queue[0];

      try {
        const stt = extractSttNumber(file.name);
        const rangeIndex = stt !== null ? rangeIndexForStt(stt, this.threshold) : 0;
        const batch = await getOrCreateBatchForRange(rangeIndex, this.threshold, this.sortMode);

        if (batch.is_full) {
          this.error = `"${file.name}" thuộc lô đã đầy (${batch.name}) — không thể thêm nữa.`;
          this.queue = this.queue.slice(1);
          this.emit();
          continue;
        }

        const hash = await computeFileHash(file);
        const existingFiles = await listBatchFiles(batch.id);
        const dup = findDuplicate(file.name, hash, existingFiles);

        if (dup) {
          const nameMatch = dup.original_name.trim().toLowerCase() === file.name.trim().toLowerCase();
          const contentMatch = !!dup.content_hash && dup.content_hash === hash;
          this.duplicateWarning = {
            newFile: file,
            existingFile: dup,
            matchType: nameMatch && contentMatch ? "both" : contentMatch ? "content" : "name",
          };
          this.processing = false;
          this.emit({ batch, files: existingFiles });
          return; // Pause until the user decides via skipDuplicate/keepDuplicateBoth.
        }

        await uploadFileToBatch(batch.id, file, hash);
        this.queue = this.queue.slice(1);

        this.resorting = true;
        this.emit();
        const sorted = await this.finalizeBatch(batch);
        this.resorting = false;
        this.emit({ batch: { ...batch, file_count: sorted.length }, files: sorted });
      } catch (e) {
        this.error = `Lỗi khi tải "${file.name}": ${e instanceof Error ? e.message : String(e)}`;
        this.queue = this.queue.slice(1);
        this.emit();
      }
    }

    this.processing = false;
    this.emit();
  }
}

// Single shared instance for the whole app session.
export const uploadQueue = new UploadQueueManager();
