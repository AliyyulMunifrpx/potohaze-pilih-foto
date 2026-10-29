import { NextResponse } from "next/server";

export async function GET(req) {
  const folderId = new URL(req.url).searchParams.get("folder");

  if (!folderId || !/^[a-zA-Z0-9_-]+$/.test(folderId)) {
    return NextResponse.json(
      { error: "Link folder tidak valid." },
      { status: 400 },
    );
  }

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "API key belum diatur di server." },
      { status: 500 },
    );
  }

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

    if (!res.ok) {
      const status = res.status;
      const message =
        status === 404 || status === 403
          ? "Folder tidak ditemukan atau belum diatur 'Anyone with the link'."
          : "Gagal mengambil folder dari Google Drive.";
      return NextResponse.json({ error: message }, { status });
    }

    const data = await res.json();
    files.push(...(data.files ?? []));
    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  return NextResponse.json({ files });
}
