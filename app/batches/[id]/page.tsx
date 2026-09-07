"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getBatch,
  listBatchFiles,
  getPublicUrl,
  markBatchZipped,
  type BatchRow,
  type BatchFileRow,
} from "@/lib/batchStore";
import { getExtension } from "@/lib/sorting";
import { IconSpinner, IconZip, IconCheck, IconFile, IconFolder } from "@/components/icons";

function isImage(mime: string | null): boolean {
  return !!mime && mime.startsWith("image/");
}

const TYPE_STYLES: Record<string, string> = {
  jpg: "bg-sky-500", jpeg: "bg-sky-500", png: "bg-sky-500", webp: "bg-sky-500", heic: "bg-sky-500",
  gif: "bg-purple-500",
  pdf: "bg-red-500",
  doc: "bg-blue-500", docx: "bg-blue-500",
  xls: "bg-emerald-500", xlsx: "bg-emerald-500",
  mp4: "bg-amber-500", mov: "bg-amber-500", webm: "bg-amber-500",
  mp3: "bg-pink-500", wav: "bg-pink-500",
  zip: "bg-slate-500", rar: "bg-slate-500",
};

export default function BatchDetailPage() {
  const params = useParams();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<BatchRow | null>(null);
  const [files, setFiles] = useState<BatchFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [zipping, setZipping] = useState(false);
  const [zipDone, setZipDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getBatch(batchId), listBatchFiles(batchId)])
      .then(([b, f]) => {
        setBatch(b);
        setFiles(f);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu."))
      .finally(() => setLoading(false));
  }, [batchId]);

  async function handleDownloadZip() {
    setZipping(true);
    setError(null);
    try {
      const res = await fetch("/api/zip-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Tạo file zip thất bại.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${batch?.name || "batch"}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      await markBatchZipped(batchId);
      setZipDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi khi tải zip.");
    } finally {
      setZipping(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-surface-tint/40 flex items-center justify-center">
        <div className="flex items-center gap-2 text-ink-medium text-[13px]">
          <IconSpinner className="w-3.5 h-3.5" />
          Đang tải...
        </div>
      </main>
    );
  }

  if (error || !batch) {
    return (
      <main className="min-h-screen bg-surface-tint/40">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-5 py-8">
          <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error || "Không tìm thấy lô này."}
          </p>
          <Link href="/batches" className="text-[12px] text-primary-dark font-bold mt-3 inline-block">
            ← Quay lại danh sách
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-tint/40">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-5 py-6 sm:py-8">
        <Link href="/batches" className="text-[12px] text-primary-dark font-bold mb-3 inline-block">
          ← Quay lại danh sách
        </Link>

        <header className="mb-5 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary-light/60 flex items-center justify-center shrink-0">
              <IconFolder className="w-4.5 h-4.5 text-primary-dark" />
            </div>
            <div>
              <h1 className="text-[19px] sm:text-[21px] font-black tracking-tight text-ink-dark">
                {batch.name}
              </h1>
              <p className="text-[11.5px] text-ink-medium">
                {files.length} / {batch.threshold} file ·{" "}
                {new Date(batch.created_at).toLocaleString("vi-VN")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={zipping || files.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-primary text-white font-black text-[12px] px-4 h-[38px] shadow-cta hover:bg-primary-deep hover:shadow-ctaHover hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:shadow-none disabled:translate-y-0"
          >
            {zipping ? (
              <>
                <IconSpinner className="w-3.5 h-3.5" />
                Đang nén...
              </>
            ) : zipDone ? (
              <>
                <IconCheck className="w-3.5 h-3.5" />
                Đã tải xuống
              </>
            ) : (
              <>
                <IconZip className="w-3.5 h-3.5" />
                Tải lại ZIP
              </>
            )}
          </button>
        </header>

        {error && (
          <p className="text-[11.5px] text-red-600 bg-red-50 border border-red-100 rounded-md px-2.5 py-1.5 mb-3">
            {error}
          </p>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
          {files.map((f, index) => (
            <div
              key={f.id}
              className="rounded-lg border border-surface-border shadow-card hover:shadow-cardHover transition-shadow duration-200 overflow-hidden bg-white aspect-square relative group"
            >
              {isImage(f.mime_type) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getPublicUrl(f.storage_path)}
                  alt={f.renamed_name || f.original_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-surface-tint">
                  <IconFile className="w-7 h-7 text-primary-deep" />
                </div>
              )}
              <span className="absolute top-1 left-1 text-[9.5px] font-bold text-white bg-black/50 rounded px-1.5 py-0.5">
                {index + 1}
              </span>
              <FileTypeCorner name={f.original_name} />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[9.5px] text-white truncate">
                  {f.renamed_name || f.original_name}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function FileTypeCorner({ name }: { name: string }) {
  const ext = getExtension(name);
  if (!ext) return null;
  const cls = TYPE_STYLES[ext] || "bg-slate-400";
  return (
    <span
      className={`absolute top-1 right-1 text-[8.5px] font-black uppercase text-white rounded px-1.5 py-0.5 ${cls}`}
    >
      {ext}
    </span>
  );
}
