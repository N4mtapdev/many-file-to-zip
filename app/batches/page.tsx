"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listMyBatches, type BatchRow } from "@/lib/batchStore";
import { IconSpinner, IconCheck } from "@/components/icons";

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
    <main className="min-h-screen bg-white">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[26px] sm:text-[30px] font-black tracking-tight text-ink-dark">
              Các lô đã lưu
            </h1>
            <p className="text-[14px] text-ink-medium mt-1">
              Mỗi lô là 1 thư mục lưu trên Supabase Storage.
            </p>
          </div>
          <Link
            href="/"
            className="text-[13px] font-bold text-primary-dark border border-primary-light rounded-md px-4 py-2 hover:bg-primary-light/40 transition-colors"
          >
            + Thêm file mới
          </Link>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 text-ink-medium text-[14px] py-10">
            <IconSpinner className="w-4 h-4" />
            Đang tải...
          </div>
        ) : error ? (
          <p className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error}
          </p>
        ) : batches.length === 0 ? (
          <p className="text-[14px] text-ink-medium">Chưa có lô nào.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {batches.map((b) => (
              <Link
                key={b.id}
                href={`/batches/${b.id}`}
                className="rounded-xl border border-surface-border hover:border-primary hover:shadow-cardHover transition-all duration-200 p-4 bg-white block"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="text-[15px] font-bold text-ink-dark truncate">
                    {b.name}
                  </h2>
                  {b.zipped_at && (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-primary-dark bg-primary-light/60 rounded-full px-2 py-1">
                      <IconCheck className="w-3 h-3" /> Đã zip
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-ink-medium">
                  {b.file_count} / {b.threshold} file · {formatSize(b.total_size_bytes)}
                </p>
                <p className="text-[11px] text-ink-medium mt-2">
                  {new Date(b.created_at).toLocaleString("vi-VN")}
                </p>
                {!b.is_full && (
                  <span className="inline-block mt-3 text-[10px] font-bold text-accent-amberStrong bg-accent-amber/10 rounded-full px-2 py-1">
                    Đang thêm file
                  </span>
                )}
              </Link>
            ))}
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
