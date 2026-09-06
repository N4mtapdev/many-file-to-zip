"use client";

import type { SortMode } from "@/lib/sorting";

const MODES: { value: SortMode; label: string; hint: string }[] = [
  { value: "natural", label: "Tự nhiên", hint: "file2 trước file10" },
  { value: "alphabetical", label: "Alphabet", hint: "A → Z thuần chữ" },
  { value: "upload_time", label: "Thời gian tải lên", hint: "Cũ → mới" },
  { value: "size", label: "Dung lượng", hint: "Nhỏ → lớn" },
  { value: "extension", label: "Loại file", hint: "Gộp theo đuôi file" },
];

export function SortModeSelector({
  value,
  onChange,
}: {
  value: SortMode;
  onChange: (mode: SortMode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {MODES.map((mode) => {
        const active = mode.value === value;
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            className={`text-left rounded-md border px-2.5 py-2 transition-all duration-150 ${
              active
                ? "bg-primary-light/60 border-primary text-primary-dark shadow-focus"
                : "bg-white border-surface-border text-ink-dark hover:border-primary hover:bg-primary-light/30"
            }`}
          >
            <div className="text-[11.5px] font-bold leading-tight">{mode.label}</div>
            <div className="text-[10px] text-ink-medium mt-0.5">{mode.hint}</div>
          </button>
        );
      })}
    </div>
  );
}
