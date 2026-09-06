"use client";

import { useEffect, useState } from "react";
import { IconFile } from "./icons";
import type { BatchFileRow } from "@/lib/batchStore";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface DuplicateWarningData {
  newFile: File;
  existingFile: BatchFileRow;
  matchType: "name" | "content" | "both";
}

export function DuplicateWarningModal({
  data,
  existingPreviewUrl,
  onKeepBoth,
  onSkip,
}: {
  data: DuplicateWarningData;
  existingPreviewUrl: string | null;
  onKeepBoth: () => void;
  onSkip: () => void;
}) {
  const [newPreviewUrl, setNewPreviewUrl] = useState<string | null>(null);
  const isNewImage = data.newFile.type.startsWith("image/");
  const isExistingImage = !!data.existingFile.mime_type?.startsWith("image/");

  useEffect(() => {
    if (!isNewImage) return;
    const url = URL.createObjectURL(data.newFile);
    setNewPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [data.newFile, isNewImage]);

  const matchLabel =
    data.matchType === "both"
      ? "Trùng cả tên lẫn nội dung"
      : data.matchType === "content"
      ? "Trùng nội dung (ảnh giống hệt, tên khác)"
      : "Trùng tên file";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 py-6 animate-fade-in">
      <div className="w-full max-w-[520px] bg-white rounded-xl shadow-elevated max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-surface-border">
          <span className="inline-block text-[10px] font-bold text-accent-amberStrong bg-accent-amber/10 rounded-full px-2.5 py-1 mb-2">
            {matchLabel}
          </span>
          <h2 className="text-[16px] font-bold text-ink-dark">
            Phát hiện file có thể đã trùng
          </h2>
          <p className="text-[12px] text-ink-medium mt-1">
            So sánh 2 file bên dưới rồi chọn cách xử lý.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5">
          <div>
            <p className="text-[11px] font-bold text-ink-medium mb-2">
              File đã có trong lô
            </p>
            <div className="rounded-lg border border-surface-border overflow-hidden bg-surface-tint aspect-square flex items-center justify-center">
              {isExistingImage && existingPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={existingPreviewUrl}
                  alt={data.existingFile.original_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <IconFile className="w-8 h-8 text-primary-deep" />
              )}
            </div>
            <p className="text-[12px] font-semibold text-ink-dark mt-2 truncate">
              {data.existingFile.original_name}
            </p>
            <p className="text-[11px] text-ink-medium">
              {formatSize(data.existingFile.size_bytes)}
            </p>
            <p className="text-[11px] text-ink-medium">
              {new Date(data.existingFile.created_at).toLocaleString("vi-VN")}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold text-ink-medium mb-2">
              File mới đang thêm
            </p>
            <div className="rounded-lg border border-surface-border overflow-hidden bg-surface-tint aspect-square flex items-center justify-center">
              {isNewImage && newPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={newPreviewUrl}
                  alt={data.newFile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <IconFile className="w-8 h-8 text-primary-deep" />
              )}
            </div>
            <p className="text-[12px] font-semibold text-ink-dark mt-2 truncate">
              {data.newFile.name}
            </p>
            <p className="text-[11px] text-ink-medium">
              {formatSize(data.newFile.size)}
            </p>
          </div>
        </div>

        <div className="p-5 pt-0 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 h-[42px] rounded-lg border border-surface-border text-[13px] font-bold text-ink-dark hover:bg-surface-tint transition-colors"
          >
            Bỏ qua file mới
          </button>
          <button
            type="button"
            onClick={onKeepBoth}
            className="flex-1 h-[42px] rounded-lg bg-primary text-white text-[13px] font-black hover:bg-primary-deep transition-colors"
          >
            Vẫn thêm (giữ cả hai)
          </button>
        </div>
      </div>
    </div>
  );
}
