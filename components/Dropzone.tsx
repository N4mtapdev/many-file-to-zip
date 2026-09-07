"use client";

import { useCallback, useRef, useState } from "react";
import { IconUpload } from "./icons";

export function Dropzone({
  onFilesAdded,
  disabled,
}: {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFilesAdded(files);
    },
    [onFilesAdded, disabled]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`rounded-md border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-all duration-200 ${
        disabled
          ? "opacity-50 cursor-not-allowed border-surface-border bg-white"
          : isDragging
          ? "border-primary bg-primary-light/30 scale-[1.005] shadow-cardHover"
          : "border-surface-border bg-white shadow-card hover:border-accent-amberStrong/60 hover:shadow-cardHover"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) onFilesAdded(files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-col items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-surface-folder border border-accent-amberStrong/30 flex items-center justify-center">
          <IconUpload className="w-4 h-4 text-accent-amberStrong" />
        </div>
        <div>
          <p className="text-[13.5px] font-semibold text-ink-dark">
            Kéo thả file vào đây, hoặc bấm để chọn
          </p>
          <p className="text-[11px] font-mono text-ink-medium mt-0.5">
            hệ thống tự lưu lên Supabase và sắp xếp lại ngay
          </p>
        </div>
      </div>
    </div>
  );
}