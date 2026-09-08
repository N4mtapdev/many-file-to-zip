"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Dropzone } from "@/components/Dropzone";
import { FileList, type DisplayFile } from "@/components/FileList";
import { SortModeSelector } from "@/components/SortModeSelector";
import { RenameOptions, type RenameConfig } from "@/components/RenameOptions";
import { IconZip, IconCheck, IconSpinner, IconLayers, IconSort, IconTag, IconInbox, IconInfo, IconUser, IconLogout, IconFolder, IconChevronDown } from "@/components/icons";
import { DuplicateWarningModal } from "@/components/DuplicateWarningModal";
import type { SortMode } from "@/lib/sorting";
import {
  markBatchZipped,
  deleteBatchFile,
  resortBatch,
  updateBatchCounts,
  getPublicUrl,
  listBatchFiles,
  type BatchRow,
  type BatchFileRow,
} from "@/lib/batchStore";
import { uploadQueue, type UploadQueueState } from "@/lib/uploadQueue";

const HARD_MAX_THRESHOLD = 100; // Vercel Hobby function timeout safety cap
const DEFAULT_THRESHOLD = 100;
const BATCH_NEW_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

function isBatchRecent(createdAt: string): boolean {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < BATCH_NEW_THRESHOLD_MS;
}

interface BatchWithFiles {
  batch: BatchRow;
  files: BatchFileRow[];
}

export default function Home() {
  const { data: session } = useSession();
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [sortMode, setSortMode] = useState<SortMode>("natural");
  const [renameConfig, setRenameConfig] = useState<RenameConfig>({
    usePrefix: false,
    padding: 3,
    startAt: 1,
    keepOriginalName: true,
    prefixSeparator: "_",
  });

  const [openBatches, setOpenBatches] = useState<BatchWithFiles[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [zippingId, setZippingId] = useState<string | null>(null);
  const [zipDoneIds, setZipDoneIds] = useState<Set<string>>(new Set());
  const [duplicatePreviewUrl, setDuplicatePreviewUrl] = useState<string | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [openPopover, setOpenPopover] = useState<"sort" | "rename" | null>(null);

  // Local mirror of the shared upload queue's state. Subscribing means this
  // page reflects live progress even if a duplicate popup or upload was
  // already in flight before this component mounted (e.g. after navigating
  // back from /batches).
  const [queueState, setQueueState] = useState<UploadQueueState>({
    queueLength: 0,
    processing: false,
    resorting: false,
    error: null,
    duplicateWarning: null,
    batchUpdate: null,
  });
  const totalQueuedRef = useRef(0);
  const [totalQueued, setTotalQueued] = useState(0);

  const renameOptionsForResort = useMemo(
    () => ({
      usePrefix: renameConfig.usePrefix,
      padding: renameConfig.padding,
      prefixSeparator: renameConfig.prefixSeparator,
      startAt: renameConfig.startAt,
      keepOriginalName: renameConfig.keepOriginalName,
    }),
    [renameConfig]
  );

  useEffect(() => {
    uploadQueue.setConfig(threshold, sortMode, renameOptionsForResort);
  }, [threshold, sortMode, renameOptionsForResort]);

  useEffect(() => {
    const unsubscribe = uploadQueue.subscribe((state) => {
      setQueueState(state);
      if (state.batchUpdate) {
        upsertOpenBatch(state.batchUpdate.batch, state.batchUpdate.files);
      }
      if (state.queueLength === 0 && !state.processing) {
        totalQueuedRef.current = 0;
        setTotalQueued(0);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setLoadingInitial(false);
  }, []);

  useEffect(() => {
    if (!queueState.duplicateWarning) {
      setDuplicatePreviewUrl(null);
      return;
    }
    if (!queueState.duplicateWarning.existingFile.mime_type?.startsWith("image/")) return;
    setDuplicatePreviewUrl(getPublicUrl(queueState.duplicateWarning.existingFile.storage_path));
  }, [queueState.duplicateWarning]);

  function byRangeIndex(a: BatchWithFiles, b: BatchWithFiles) {
    return (a.batch.range_index ?? 0) - (b.batch.range_index ?? 0);
  }

  function upsertOpenBatch(batch: BatchRow, files: BatchFileRow[]) {
    setOpenBatches((prev) => {
      const idx = prev.findIndex((b) => b.batch.id === batch.id);
      if (idx === -1) return [...prev, { batch, files }].sort(byRangeIndex);
      const copy = [...prev];
      copy[idx] = { batch, files };
      return copy.sort(byRangeIndex);
    });
  }

  async function refreshBatch(batchId: string) {
    const files = await listBatchFiles(batchId);
    setOpenBatches((prev) => {
      const idx = prev.findIndex((b) => b.batch.id === batchId);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = { ...copy[idx], files };
      return copy;
    });
    return files;
  }

  function handleFilesAdded(newFiles: File[]) {
    totalQueuedRef.current += newFiles.length;
    setTotalQueued(totalQueuedRef.current);
    uploadQueue.addFiles(newFiles);
  }

  function handleDuplicateSkip() {
    uploadQueue.skipDuplicate();
  }

  function handleDuplicateKeepBoth() {
    uploadQueue.keepDuplicateBoth();
  }

  async function handleRemove(batchId: string, fileId: string) {
    const entry = openBatches.find((b) => b.batch.id === batchId);
    const target = entry?.files.find((f) => f.id === fileId);
    if (!target) return;
    try {
      await deleteBatchFile(fileId, target.storage_path);
      const sorted = await resortBatch(batchId, sortMode, renameOptionsForResort);
      await updateBatchCounts(
        batchId,
        sorted.length,
        sorted.reduce((sum, f) => sum + f.size_bytes, 0)
      );
      await refreshBatch(batchId);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSortModeChange(mode: SortMode) {
    setSortMode(mode);
    try {
      for (const entry of openBatches) {
        const sorted = await resortBatch(entry.batch.id, mode, renameOptionsForResort);
        upsertOpenBatch(entry.batch, sorted);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleRenameConfigChange(config: RenameConfig) {
    setRenameConfig(config);
    try {
      for (const entry of openBatches) {
        const sorted = await resortBatch(entry.batch.id, sortMode, {
          usePrefix: config.usePrefix,
          padding: config.padding,
          prefixSeparator: config.prefixSeparator,
          startAt: config.startAt,
          keepOriginalName: config.keepOriginalName,
        });
        upsertOpenBatch(entry.batch, sorted);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDownloadZip(batch: BatchRow) {
    setZippingId(batch.id);
    try {
      const res = await fetch("/api/zip-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: batch.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Tạo file zip thất bại.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${batch.name || "batch"}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await markBatchZipped(batch.id);
      setZipDoneIds((prev) => new Set(prev).add(batch.id));
    } catch (e) {
      console.error(e);
    } finally {
      setZippingId(null);
    }
  }

  const totalPendingAcrossBatches = openBatches.reduce((sum, b) => sum + b.files.length, 0);
  const uploadedSoFar = Math.max(totalQueued - queueState.queueLength, 0);
  const progressPercent =
    totalQueued > 0 ? Math.round((uploadedSoFar / totalQueued) * 100) : 0;

  return (
    <main className="min-h-screen">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5 sm:py-6">
        {/* Header */}
        <header className="mb-4 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 border border-accent-amberStrong/40 px-2 py-0.5 mb-2 rotate-[-1deg]">
              <span className="text-[9px] font-mono font-bold text-accent-amberStrong tracking-widest uppercase">
                ★ Công cụ cá nhân
              </span>
            </div>
            <h1 className="text-[20px] sm:text-[22px] font-black leading-tight tracking-tight text-ink-dark">
              Sắp xếp &amp; gộp file thành ZIP
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Link
              href="/batches"
              className="flex items-center gap-1.5 text-[12px] font-bold text-ink-dark bg-white border border-surface-border rounded shadow-card px-3 py-1.5 hover:shadow-cardHover hover:-translate-y-0.5 transition-all duration-200"
            >
              <IconLayers className="w-3.5 h-3.5 text-primary" />
              Các lô đã lưu
            </Link>
            {session?.user?.email && (
              <button
                type="button"
                onClick={() => signOut()}
                className="flex items-center gap-1 text-[10.5px] text-ink-medium hover:text-accent-amberStrong transition-colors"
              >
                <IconUser className="w-3 h-3" />
                {session.user.email}
                <IconLogout className="w-3 h-3 ml-0.5" />
              </button>
            )}
          </div>
        </header>

        {loadingInitial ? (
          <div className="flex items-center gap-2 text-ink-medium text-[13px] py-8">
            <IconSpinner className="w-3.5 h-3.5" />
            Đang tải...
          </div>
        ) : (
          <>
            {/* Toolbar: thin dropzone + inline controls + stats, all on the desk surface */}
            <div className="rounded-md border border-surface-border bg-white shadow-card p-2.5 mb-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
                <div className="flex-1 min-w-0">
                  <Dropzone onFilesAdded={handleFilesAdded} disabled={queueState.processing} compact />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <ThresholdControl value={threshold} onChange={setThreshold} />

                  <PopoverButton
                    label="Sắp xếp"
                    icon={<IconSort className="w-3.5 h-3.5" />}
                    open={openPopover === "sort"}
                    onToggle={() => setOpenPopover(openPopover === "sort" ? null : "sort")}
                  >
                    <SortModeSelector value={sortMode} onChange={handleSortModeChange} />
                  </PopoverButton>

                  <PopoverButton
                    label="Đổi tên"
                    icon={<IconTag className="w-3.5 h-3.5" />}
                    open={openPopover === "rename"}
                    onToggle={() => setOpenPopover(openPopover === "rename" ? null : "rename")}
                  >
                    <RenameOptions config={renameConfig} onChange={handleRenameConfigChange} />
                  </PopoverButton>
                </div>
              </div>

              {(queueState.processing || totalQueued > 0) && queueState.queueLength > 0 && (
                <div className="space-y-1 px-0.5 mt-2.5 pt-2.5 border-t border-surface-border">
                  <div className="flex items-center justify-between text-[11px] text-primary-dark font-semibold">
                    <span className="flex items-center gap-1.5">
                      <IconSpinner className="w-3 h-3" />
                      Đang tải file...
                    </span>
                    <span className="font-mono tabular-nums">
                      {uploadedSoFar}/{totalQueued} ({progressPercent}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-primary-light overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-200"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
              {queueState.resorting && queueState.queueLength === 0 && (
                <div className="flex items-center gap-1.5 text-[12px] text-ink-medium px-0.5 mt-2">
                  <IconSpinner className="w-3 h-3" />
                  Đang sắp xếp lại...
                </div>
              )}
            </div>

            {/* Stats row */}
            {openBatches.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 mb-4 sm:max-w-[420px]">
                <StatCard
                  icon={<IconFolder className="w-3.5 h-3.5" />}
                  label="Số lô"
                  value={String(openBatches.length)}
                />
                <StatCard
                  icon={<IconInbox className="w-3.5 h-3.5" />}
                  label="Tổng file"
                  value={String(totalPendingAcrossBatches)}
                />
                <StatCard
                  icon={<IconCheck className="w-3.5 h-3.5" />}
                  label="Đã đầy"
                  value={`${openBatches.filter((b) => b.batch.is_full).length}/${openBatches.length}`}
                />
              </div>
            )}

            {queueState.error && (
              <p className="text-[11.5px] text-red-600 bg-red-50 border border-red-100 rounded-md px-2.5 py-1.5 mb-3">
                {queueState.error}
              </p>
            )}

            {openBatches.length === 0 && totalPendingAcrossBatches === 0 && (
              <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-surface-border px-3.5 py-3">
                <IconInbox className="w-4 h-4 text-ink-medium shrink-0 mt-0.5" />
                <p className="text-[12px] text-ink-medium">
                  Chưa có lô nào — thêm file để bắt đầu. Lô sẽ tự tạo dựa
                  trên số thứ tự (STT) trong tên file.
                </p>
              </div>
            )}

            {/* Batches laid out as folders spread across the desk */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-4">
              {openBatches.map((entry) => {
                const isExpanded = expandedBatchId === entry.batch.id;
                return (
                  <div key={entry.batch.id} className="relative pt-2.5">
                    <div className="absolute top-0 left-3 h-4 w-28 bg-surface-folderTab rounded-t-md border border-b-0 border-surface-border" />
                    <div className="relative rounded-md border border-surface-border bg-surface-folder shadow-card p-3 space-y-2">
                      <button
                        type="button"
                        onClick={() => setExpandedBatchId(isExpanded ? null : entry.batch.id)}
                        className="w-full flex items-center justify-between text-left"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded bg-white/70 border border-surface-border flex items-center justify-center shrink-0">
                            <IconFolder className="w-3 h-3 text-accent-amberStrong" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-[12.5px] font-bold text-ink-dark truncate">
                                {entry.batch.name}
                              </h3>
                              {isBatchRecent(entry.batch.created_at) && !entry.batch.is_full && (
                                <BatchBadge label="Mới" tone="purple" />
                              )}
                              {entry.batch.is_full && <BatchBadge label="Đầy" tone="primary" />}
                            </div>
                            <p className="text-[10px] font-mono text-ink-medium tabular-nums">
                              {String(entry.files.length).padStart(2, "0")} / {entry.batch.threshold} FILE
                            </p>
                          </div>
                        </div>
                        <IconChevronDown
                          className={`w-3.5 h-3.5 text-ink-medium shrink-0 transition-transform duration-200 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadZip(entry.batch)}
                          disabled={zippingId === entry.batch.id || entry.files.length === 0}
                          className="flex items-center gap-1 text-[11px] font-bold text-white bg-primary rounded px-2.5 py-1.5 shadow-cta hover:bg-primary-deep hover:shadow-ctaHover transition-all duration-200 disabled:opacity-40 disabled:shadow-none shrink-0"
                        >
                          {zippingId === entry.batch.id ? (
                            <IconSpinner className="w-3 h-3" />
                          ) : zipDoneIds.has(entry.batch.id) ? (
                            <IconCheck className="w-3 h-3" />
                          ) : (
                            <IconZip className="w-3 h-3" />
                          )}
                          ZIP
                        </button>
                        {!isExpanded && entry.files.length > 0 && (
                          <span className="text-[10px] text-ink-medium truncate">
                            {entry.files
                              .slice(0, 2)
                              .map((f) => f.renamed_name || f.original_name)
                              .join(", ")}
                            {entry.files.length > 2 ? `, +${entry.files.length - 2}` : ""}
                          </span>
                        )}
                      </div>

                      {isExpanded && (
                        <FileList
                          files={entry.files.map(
                            (f): DisplayFile => ({
                              id: f.id,
                              originalName: f.original_name,
                              finalName: f.renamed_name || f.original_name,
                              size: f.size_bytes,
                              status: "uploaded",
                              createdAt: f.created_at,
                            })
                          )}
                          onRemove={(fileId) => handleRemove(entry.batch.id, fileId)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {queueState.duplicateWarning && (
        <DuplicateWarningModal
          data={queueState.duplicateWarning}
          existingPreviewUrl={duplicatePreviewUrl}
          onSkip={handleDuplicateSkip}
          onKeepBoth={handleDuplicateKeepBoth}
        />
      )}
    </main>
  );
}

function ThresholdControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 border border-surface-border rounded px-2 py-1.5 bg-white">
      <IconTag className="w-3.5 h-3.5 text-accent-amberStrong shrink-0" />
      <input
        type="number"
        min={1}
        max={HARD_MAX_THRESHOLD}
        value={value}
        onChange={(e) => {
          const v = Math.max(1, Math.min(HARD_MAX_THRESHOLD, Number(e.target.value) || 1));
          onChange(v);
        }}
        className="w-12 text-[13px] font-mono font-bold text-ink-dark focus:outline-none bg-transparent"
      />
      <span className="text-[10px] text-ink-medium whitespace-nowrap">file/lô</span>
    </div>
  );
}

function PopoverButton({
  label,
  icon,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 border rounded px-2.5 py-1.5 text-[12px] font-bold transition-colors ${
          open
            ? "border-primary text-primary-dark bg-primary-light/30"
            : "border-surface-border text-ink-dark bg-white hover:border-primary/50"
        }`}
      >
        <span className="text-accent-amberStrong">{icon}</span>
        {label}
        <IconChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={onToggle} />
          <div className="absolute right-0 top-full mt-1.5 z-20 w-[280px] rounded-md border border-surface-border bg-white shadow-elevated p-3">
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-surface-border border-l-[3px] border-l-primary bg-white shadow-card px-3 py-2">
      <div className="flex items-center gap-1.5 text-ink-medium mb-0.5">
        <span className="opacity-60">{icon}</span>
        <p className="text-[9.5px] uppercase tracking-wide truncate">{label}</p>
      </div>
      <p className="text-[17px] font-mono font-bold text-ink-dark leading-none tabular-nums">
        {value}
      </p>
    </div>
  );
}

function BatchBadge({ label, tone }: { label: string; tone: "purple" | "primary" }) {
  const cls =
    tone === "purple"
      ? "text-accent-purpleDark border-accent-purple/50"
      : "text-primary-dark border-primary/50";
  return (
    <span
      className={`text-[8.5px] font-mono font-bold uppercase tracking-widest border px-1 py-0.5 shrink-0 ${cls}`}
    >
      {label}
    </span>
  );
}