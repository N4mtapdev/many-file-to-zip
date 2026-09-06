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
import { IconSpinner, IconZip, IconCheck, IconFile } from "@/components/icons";

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
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-2 text-ink-medium text-[14px]">
          <IconSpinner className="w-4 h-4" />
          Đang tải...
        </div>
      </main>
    );
  }

  if (error || !batch) {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10">
          <p className="text-[13px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error || "Không tìm thấy lô này."}
          </p>
          <Link href="/batches" className="text-[13px] text-primary-dark font-bold mt-4 inline-block">
            ← Quay lại danh sách
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Link href="/batches" className="text-[13px] text-primary-dark font-bold mb-4 inline-block">
          ← Quay lại danh sách
        </Link>

        <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[26px] sm:text-[30px] font-black tracking-tight text-ink-dark">
              {batch.name}
            </h1>
            <p className="text-[13px] text-ink-medium mt-1">
              {files.length} / {batch.threshold} file ·{" "}
              {new Date(batch.created_at).toLocaleString("vi-VN")}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={zipping || files.length === 0}
            className="flex items-center gap-2 rounded-lg bg-primary text-white font-black text-[13px] px-5 h-[42px] shadow-cta hover:bg-primary-deep hover:shadow-ctaHover transition-all duration-200 disabled:opacity-50"
          >
            {zipping ? (
              <>
                <IconSpinner className="w-4 h-4" />
                Đang nén...
              </>
            ) : zipDone ? (
              <>
                <IconCheck className="w-4 h-4" />
                Đã tải xuống
              </>
            ) : (
              <>
                <IconZip className="w-4 h-4" />
                Tải lại ZIP
              </>
            )}
          </button>
        </header>

        {error && (
          <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {files.map((f, index) => (
            <div
              key={f.id}
              className="rounded-lg border border-surface-border overflow-hidden bg-surface-tint aspect-square relative group"
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
                <div className="w-full h-full flex items-center justify-center">
                  <IconFile className="w-8 h-8 text-primary-deep" />
                </div>
              )}
              <span className="absolute top-1 left-1 text-[10px] font-bold text-white bg-black/50 rounded px-1.5 py-0.5">
                {index + 1}
              </span>
              <FileTypeCorner name={f.original_name} />
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white truncate">
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
      className={`absolute top-1 right-1 text-[9px] font-black uppercase text-white rounded px-1.5 py-0.5 ${cls}`}
    >
      {ext}
    </span>
  );
}
