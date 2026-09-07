"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listMyBatches, type BatchRow } from "@/lib/batchStore";
import { IconSpinner, IconCheck, IconInbox } from "@/components/icons";

export default function BatchesPage() {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyBatches()
      .then(setBatches)
      .catch((e) => setError(e instanceof Error ? e.message : "Lỗi tải danh sách."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-5 py-6 sm:py-8">
        <header className="mb-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-[20px] sm:text-[22px] font-black tracking-tight text-ink-dark">
              Các lô đã lưu
            </h1>
            <p className="text-[12px] text-ink-medium mt-0.5">
              Mỗi lô là 1 thư mục lưu trên Supabase Storage.
            </p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-primary rounded px-3.5 py-2 shadow-cta hover:bg-primary-deep hover:shadow-ctaHover hover:-translate-y-0.5 transition-all duration-200"
          >
            + Thêm file mới
          </Link>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 text-ink-medium text-[13px] py-10">
            <IconSpinner className="w-3.5 h-3.5" />
            Đang tải...
          </div>
        ) : error ? (
          <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
            {error}
          </p>
        ) : batches.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <IconInbox className="w-6 h-6 text-ink-medium opacity-40" />
            <p className="text-[13px] text-ink-medium">Chưa có lô nào.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-4">
            {batches.map((b) => {
              const pct = Math.min(100, Math.round((b.file_count / b.threshold) * 100));
              return (
                <Link key={b.id} href={`/batches/${b.id}`} className="group relative block pt-2.5">
                  <div className="absolute top-0 left-3 h-4 w-24 bg-surface-folderTab rounded-t-md border border-b-0 border-surface-border group-hover:bg-accent-amber/20 transition-colors" />
                  <div className="relative rounded-md border border-surface-border bg-surface-folder shadow-card group-hover:shadow-cardHover group-hover:-translate-y-0.5 transition-all duration-200 p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h2 className="text-[13.5px] font-bold text-ink-dark truncate">
                        {b.name}
                      </h2>
                      {b.zipped_at && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[9px] font-mono font-bold text-primary-dark border border-primary/40 px-1 py-0.5">
                          <IconCheck className="w-2.5 h-2.5" /> ZIP
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] font-mono text-ink-medium mb-2">
                      {formatSize(b.total_size_bytes)} · {new Date(b.created_at).toLocaleDateString("vi-VN")}
                    </p>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-mono font-bold text-ink-dark tabular-nums">
                          {String(b.file_count).padStart(2, "0")}/{b.threshold}
                        </span>
                        {!b.is_full && (
                          <span className="font-bold text-accent-amberStrong uppercase tracking-wide text-[9px]">
                            Đang thêm
                          </span>
                        )}
                      </div>
                      <div className="h-1 bg-white/60 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            b.is_full ? "bg-primary" : "bg-accent-amber"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}