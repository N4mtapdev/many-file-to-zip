"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Dropzone } from "@/components/Dropzone";
import { FileList, type DisplayFile } from "@/components/FileList";
import { SortModeSelector } from "@/components/SortModeSelector";
import { RenameOptions, type RenameConfig } from "@/components/RenameOptions";
import { IconZip, IconCheck, IconSpinner, IconLayers, IconSort, IconTag, IconInbox, IconInfo, IconUser, IconLogout, IconFolder } from "@/components/icons";
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
        // Queue drained — reset the progress counter for the next batch of adds.
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
      // Keep this local — it's outside the shared queue's error channel.
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
    <main className="min-h-screen bg-surface-tint/40">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-5 py-5 sm:py-6">
        <header className="mb-4 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-light/50 border border-primary-light px-2.5 py-0.5 mb-1.5">
              <IconFolder className="w-3 h-3 text-primary-dark" />
              <span className="text-[10px] font-bold text-primary-dark tracking-wide">
                Công cụ cá nhân
              </span>
            </div>
            <h1 className="text-[20px] sm:text-[22px] font-black leading-tight tracking-tight text-ink-dark">
              Sắp xếp &amp; gộp file thành ZIP
            </h1>
            <p className="text-[12px] text-ink-medium mt-0.5 max-w-[520px]">
              Thêm file bất kỳ lúc nào — mỗi file tự rơi đúng lô theo số thứ
              tự (STT) trong tên. File STT vượt ngưỡng tự chuyển sang lô kế
              tiếp.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Link
              href="/batches"
              className="flex items-center gap-1.5 text-[12px] font-bold text-primary-dark border border-primary-light rounded-md px-3 py-1.5 hover:bg-primary-light/40 transition-colors"
            >
              <IconLayers className="w-3.5 h-3.5" />
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
            {openBatches.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3.5">
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
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            {/* Left column: upload + open batches */}
            <div className="space-y-3">
              <Dropzone onFilesAdded={handleFilesAdded} disabled={queueState.processing} />

              {(queueState.processing || totalQueued > 0) && queueState.queueLength > 0 && (
                <div className="space-y-1 px-0.5">
                  <div className="flex items-center justify-between text-[11px] text-primary-dark font-semibold">
                    <span className="flex items-center gap-1.5">
                      <IconSpinner className="w-3 h-3" />
                      Đang tải file...
                    </span>
                    <span className="tabular-nums">
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
                <div className="flex items-center gap-1.5 text-[12px] text-ink-medium px-0.5">
                  <IconSpinner className="w-3 h-3" />
                  Đang sắp xếp lại...
                </div>
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

              {openBatches.map((entry) => (
                <div
                  key={entry.batch.id}
                  className="rounded-xl border border-surface-border bg-white shadow-card p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-primary-light/60 flex items-center justify-center shrink-0">
                        <IconFolder className="w-3.5 h-3.5 text-primary-dark" />
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
                        <p className="text-[10.5px] text-ink-medium">
                          {entry.files.length} / {entry.batch.threshold} file
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadZip(entry.batch)}
                      disabled={zippingId === entry.batch.id || entry.files.length === 0}
                      className="flex items-center gap-1 text-[11px] font-bold text-white bg-primary rounded-md px-2.5 py-1.5 shadow-cta hover:bg-primary-deep hover:shadow-ctaHover transition-all duration-200 disabled:opacity-40 disabled:shadow-none shrink-0"
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
                  </div>
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
                </div>
              ))}

              {queueState.error && (
                <p className="text-[11.5px] text-red-600 bg-red-50 border border-red-100 rounded-md px-2.5 py-1.5">
                  {queueState.error}
                </p>
              )}
            </div>

            {/* Right column: controls */}
            <div className="space-y-2.5">
              <Panel title="Ngưỡng mỗi lô" icon={<IconTag className="w-3.5 h-3.5" />}>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={HARD_MAX_THRESHOLD}
                    value={threshold}
                    onChange={(e) => {
                      const v = Math.max(
                        1,
                        Math.min(HARD_MAX_THRESHOLD, Number(e.target.value) || 1)
                      );
                      setThreshold(v);
                    }}
                    className="w-20 rounded-md border border-primary-light px-2.5 py-1.5 text-[12px] font-semibold text-ink-dark focus:outline-none focus:border-primary focus:bg-white focus:shadow-focus transition-all"
                  />
                  <span className="text-[11px] text-ink-medium">
                    file/lô (tối đa {HARD_MAX_THRESHOLD})
                  </span>
                </div>
                <p className="text-[10.5px] text-ink-medium mt-1.5 leading-relaxed">
                  Ngưỡng cũng là biên STT cho lô mới. Các lô đã tạo giữ
                  nguyên ngưỡng riêng, không đổi theo.
                </p>
              </Panel>

              <Panel title="Sắp xếp trong lô" icon={<IconSort className="w-3.5 h-3.5" />}>
                <SortModeSelector value={sortMode} onChange={handleSortModeChange} />
              </Panel>

              <Panel title="Đổi tên file" icon={<IconTag className="w-3.5 h-3.5" />}>
                <RenameOptions config={renameConfig} onChange={handleRenameConfigChange} />
              </Panel>

              <Panel title="Lưu ý" icon={<IconInfo className="w-3.5 h-3.5" />}>
                <p className="text-[11px] text-ink-medium leading-relaxed">
                  File vẫn được giữ lại trên Supabase sau khi tải zip — xem
                  lại trong &quot;Các lô đã lưu&quot;.
                </p>
              </Panel>
            </div>
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

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-primary-light bg-white shadow-card p-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        {icon && <span className="text-primary-dark">{icon}</span>}
        <h2 className="text-[11.5px] font-bold text-ink-dark">{title}</h2>
      </div>
      {children}
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
    <div className="rounded-lg border border-surface-border bg-white shadow-card px-2.5 py-2 flex items-center gap-2">
      <div className="w-7 h-7 rounded-md bg-primary-light/50 flex items-center justify-center shrink-0 text-primary-dark">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-black text-ink-dark leading-tight">{value}</p>
        <p className="text-[9.5px] text-ink-medium truncate">{label}</p>
      </div>
    </div>
  );
}

function BatchBadge({ label, tone }: { label: string; tone: "purple" | "primary" }) {
  const cls =
    tone === "purple"
      ? "text-white bg-accent-purple"
      : "text-primary-dark bg-primary-light/70";
  return (
    <span
      className={`text-[9px] font-black uppercase tracking-wide rounded-full px-1.5 py-0.5 shrink-0 ${cls}`}
    >
      {label}
    </span>
  );
}
