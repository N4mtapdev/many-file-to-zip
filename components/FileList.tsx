"use client";

import { IconFile, IconTrash } from "./icons";
import type { SortMode } from "@/lib/sorting";
import { getExtension } from "@/lib/sorting";

export interface DisplayFile {
  id: string;
  originalName: string;
  finalName: string;
  size: number;
  status: "pending" | "uploading" | "uploaded" | "error";
  createdAt?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const NEW_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function isRecent(createdAt?: string): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < NEW_THRESHOLD_MS;
}

export function FileList({
  files,
  onRemove,
}: {
  files: DisplayFile[];
  sortMode?: SortMode;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="rounded-lg border border-surface-border overflow-hidden">
      <div className="max-h-[340px] overflow-y-auto divide-y divide-surface-border">
        {files.map((file, index) => (
          <div
            key={file.id}
            className="flex items-center gap-2 px-2.5 py-1.5 bg-white transition-colors duration-150 animate-fade-in"
          >
            <span className="text-[10px] font-bold text-primary w-5 shrink-0 text-center tabular-nums">
              {index + 1}
            </span>

            <div className="w-6 h-6 rounded-md bg-surface-tint border border-primary-light flex items-center justify-center shrink-0">
              <IconFile className="w-3 h-3 text-primary-deep" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-semibold text-ink-dark truncate">
                  {file.finalName}
                </p>
                {isRecent(file.createdAt) && <NewBadge />}
              </div>
              {file.finalName !== file.originalName && (
                <p className="text-[10px] text-ink-medium truncate">
                  gốc: {file.originalName}
                </p>
              )}
            </div>

            <FileTypeBadge name={file.originalName} />

            <span className="text-[10px] text-ink-medium shrink-0 tabular-nums">
              {formatSize(file.size)}
            </span>

            <StatusBadge status={file.status} />

            <button
              type="button"
              onClick={() => onRemove(file.id)}
              className="w-6 h-6 rounded-md border border-surface-border flex items-center justify-center text-ink-medium hover:border-accent-amber hover:text-accent-amberStrong hover:bg-accent-amber/5 transition-colors shrink-0"
              aria-label="Xóa file"
            >
              <IconTrash className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DisplayFile["status"] }) {
  if (status === "pending") return null;
  const map = {
    uploading: { label: "Đang tải", cls: "text-accent-amberStrong bg-accent-amber/10" },
    uploaded: { label: "Xong", cls: "text-primary-dark bg-primary-light/60" },
    error: { label: "Lỗi", cls: "text-red-600 bg-red-50" },
  } as const;
  const info = map[status];
  if (!info) return null;
  return (
    <span
      className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${info.cls}`}
    >
      {info.label}
    </span>
  );
}

function NewBadge() {
  return (
    <span className="text-[9px] font-black text-white bg-accent-purple rounded-full px-1.5 py-0.5 shrink-0 uppercase tracking-wide">
      Mới
    </span>
  );
}

// Color coding by category so file types are recognizable at a glance.
const TYPE_STYLES: Record<string, string> = {
  jpg: "text-sky-700 bg-sky-50",
  jpeg: "text-sky-700 bg-sky-50",
  png: "text-sky-700 bg-sky-50",
  gif: "text-purple-700 bg-purple-50",
  webp: "text-sky-700 bg-sky-50",
  heic: "text-sky-700 bg-sky-50",
  pdf: "text-red-700 bg-red-50",
  doc: "text-blue-700 bg-blue-50",
  docx: "text-blue-700 bg-blue-50",
  xls: "text-emerald-700 bg-emerald-50",
  xlsx: "text-emerald-700 bg-emerald-50",
  mp4: "text-amber-700 bg-amber-50",
  mov: "text-amber-700 bg-amber-50",
  webm: "text-amber-700 bg-amber-50",
  mp3: "text-pink-700 bg-pink-50",
  wav: "text-pink-700 bg-pink-50",
  zip: "text-slate-700 bg-slate-100",
  rar: "text-slate-700 bg-slate-100",
};

function FileTypeBadge({ name }: { name: string }) {
  const ext = getExtension(name);
  if (!ext) return null;
  const style = TYPE_STYLES[ext] || "text-ink-medium bg-surface-tint";
  return (
    <span
      className={`text-[9px] font-black uppercase tracking-wide rounded px-1.5 py-0.5 shrink-0 ${style}`}
    >
      {ext}
    </span>
  );
}
