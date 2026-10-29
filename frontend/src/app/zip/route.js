import { Zip, ZipPassThrough } from "fflate";

export const runtime = "nodejs";
// 300 detik butuh Fluid compute (default di project Vercel baru).
// Kalau build protes soal batas durasi, ganti jadi 60.
export const maxDuration = 300;

const MAX_FILES = 100;
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

async function listFolder(folderId, apiKey) {
  const files = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`,
      fields: "nextPageToken,files(id,name)",
      pageSize: "1000",
      orderBy: "name",
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
    );
    if (!res.ok) return null;

    const data = await res.json();
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  return files;
}

// nama file di dalam ZIP harus unik dan tanpa slash
function withZipNames(files) {
  const used = new Map();
  return files.map((f) => {
    const clean = f.name.replace(/[\\/]/g, "-");
    const n = used.get(clean) ?? 0;
    used.set(clean, n + 1);
    if (n === 0) return { ...f, zipName: clean };

    const dot = clean.lastIndexOf(".");
    const base = dot > 0 ? clean.slice(0, dot) : clean;
    const ext = dot > 0 ? clean.slice(dot) : "";
    return { ...f, zipName: `${base} (${n + 1})${ext}` };
  });
}

// ZIP dibuat sambil jalan: satu potongan foto masuk, satu potongan ZIP keluar.
function zipStream(files, apiKey) {
  let controller;

  const zip = new Zip((err, chunk, final) => {
    if (err) {
      controller.error(err);
      return;
    }
    controller.enqueue(chunk);
    if (final) controller.close();
  });

  async function* work() {
    for (const f of files) {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&key=${apiKey}`,
      );
      if (!res.ok || !res.body) continue; // lewati file yang gagal diambil

      // ZipPassThrough = disimpan tanpa kompresi
      const entry = new ZipPassThrough(f.zipName);
      zip.add(entry);

      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        entry.push(value);
        yield;
      }
      entry.push(new Uint8Array(0), true);
      yield;
    }
    zip.end();
  }

  const iterator = work();

  return new ReadableStream({
    start(c) {
      controller = c;
    },
    async pull() {
      try {
        await iterator.next();
      } catch (e) {
        controller.error(e);
      }
    },
    cancel() {
      iterator.return();
    },
  });
}

export async function POST(req) {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) return jsonError("API key belum diatur di server.", 500);

  let folderId;
  let ids;
  try {
    const form = await req.formData();
    folderId = String(form.get("folder") ?? "");
    ids = JSON.parse(String(form.get("ids") ?? "[]"));
  } catch {
    return jsonError("Permintaan tidak valid.", 400);
  }

  const valid =
    ID_PATTERN.test(folderId) &&
    Array.isArray(ids) &&
    ids.length > 0 &&
    ids.length <= MAX_FILES &&
    ids.every((id) => typeof id === "string" && ID_PATTERN.test(id));

  if (!valid) return jsonError("Pilihan foto tidak valid.", 400);

  // hanya foto yang benar-benar ada di folder ini yang boleh masuk ZIP
  const all = await listFolder(folderId, apiKey);
  if (!all) return jsonError("Gagal membaca folder.", 502);

  const wanted = new Set(ids);
  const files = withZipNames(all.filter((f) => wanted.has(f.id)));
  if (files.length === 0)
    return jsonError("Foto tidak ditemukan di folder.", 404);

  return new Response(zipStream(files, apiKey), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="foto-pilihan.zip"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
