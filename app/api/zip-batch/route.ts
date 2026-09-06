import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import archiver from "archiver";
import { PassThrough } from "stream";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby caps this at 10s regardless; Pro can use more.

const BUCKET = "batch-files";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { batchId } = body as { batchId?: string };

    if (!batchId) {
      return NextResponse.json({ error: "Thiếu batchId" }, { status: 400 });
    }

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kmcjfvbqmoihkjgwisnz.supabase.co";
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttY2pmdmJxbW9paGtqZ3dpc256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzOTg4NzAsImV4cCI6MjEwMzk3NDg3MH0.71vQ81pJ_Z4RpCa1ge2wapyB71kJAa1jGOSwjPjg1UQ";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .select("*")
      .eq("id", batchId)
      .single();
    if (batchError || !batch) {
      return NextResponse.json({ error: "Không tìm thấy batch" }, { status: 404 });
    }

    const { data: files, error: filesError } = await supabase
      .from("batch_files")
      .select("*")
      .eq("batch_id", batchId)
      .order("sort_order", { ascending: true });
    if (filesError) {
      return NextResponse.json({ error: filesError.message }, { status: 500 });
    }
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Batch không có file nào" }, { status: 400 });
    }

    const archive = archiver("zip", { zlib: { level: 6 } });
    const passthrough = new PassThrough();
    archive.pipe(passthrough);

    // Fire off the archiving process; errors are captured on the archive/passthrough.
    (async () => {
      try {
        for (const f of files) {
          const { data: fileBlob, error: downloadError } = await supabase.storage
            .from(BUCKET)
            .download(f.storage_path);
          if (downloadError || !fileBlob) continue;
          const arrayBuffer = await fileBlob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const entryName = f.renamed_name || f.original_name;
          archive.append(buffer, { name: entryName });
        }
        await archive.finalize();
      } catch (err) {
        archive.abort();
        passthrough.destroy(err instanceof Error ? err : new Error("Zip failed"));
      }
    })();

    const zipFileName = `${batch.name || "batch"}.zip`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-");

    // Convert Node stream to a Web ReadableStream for the Response.
    const webStream = new ReadableStream({
      start(controller) {
        passthrough.on("data", (chunk) => controller.enqueue(chunk));
        passthrough.on("end", () => controller.close());
        passthrough.on("error", (err) => controller.error(err));
      },
      cancel() {
        passthrough.destroy();
      },
    });

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Lỗi không xác định" },
      { status: 500 }
    );
  }
}
