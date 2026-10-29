"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-developer";

// batas aman panjang URL wa.me; lewat dari ini sebaiknya daftar disalin manual
const WA_URL_SOFT_LIMIT = 1800;

// harus sama dengan MAX_FILES di app/api/zip/route.js
const MAX_ZIP = 100;

const driveDownloadUrl = (id) =>
  `https://drive.google.com/uc?export=download&id=${id}`;

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 2.5v7m0 0L5 6.75M8 9.5l3-2.75M3 12.5h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Shell({ children }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-56 sm:px-6 sm:py-12 sm:pb-32">
      {children}
    </main>
  );
}

function Header({ children }) {
  return (
    <header>
      <h1 className="font-display text-[clamp(1.9rem,5vw,2.75rem)] font-medium leading-[1.1] tracking-[-0.01em] text-ink">
        Pilih foto favoritmu
      </h1>
      {children}
    </header>
  );
}

function Notice({ title, children }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="max-w-md">
        <h1 className="font-display text-3xl font-medium leading-tight text-ink">
          {title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{children}</p>
      </div>
    </main>
  );
}

function Picker() {
  const params = useSearchParams();
  const folder = params.get("folder");
  const wa = params.get("wa");

  const [photos, setPhotos] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);
  const zipFormRef = useRef(null);

  const storageKey = `selected:${folder}`;

  // ambil daftar foto
  useEffect(() => {
    if (!folder) {
      setError("Link ini tidak lengkap.");
      setLoading(false);
      return;
    }
    fetch(`/api/drive?folder=${encodeURIComponent(folder)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal memuat foto.");
        return data;
      })
      .then((data) => setPhotos(data.files))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [folder]);

  // load pilihan tersimpan
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setSelected(new Set(JSON.parse(raw)));
    } catch {}
    setReady(true);
  }, [storageKey]);

  // simpan pilihan
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...selected]));
    } catch {}
  }, [selected, ready, storageKey]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // hanya foto yang benar-benar ada di folder
  const chosen = useMemo(
    () => photos.filter((p) => selected.has(p.id)),
    [photos, selected],
  );
  const count = chosen.length;

  const message = useMemo(() => {
    const list = chosen.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
    return `Halo kak, saya sudah memilih ${chosen.length} foto:\n\n${list}\n\nTerima kasih!`;
  }, [chosen]);

  const tooLong = encodeURIComponent(message).length > WA_URL_SOFT_LIMIT;

  const sendWa = () => {
    if (!wa || count === 0) return;
    window.open(
      `https://wa.me/${wa}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const copyList = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const startZip = () => {
    if (count < 2 || count > MAX_ZIP || zipping) return;
    setZipping(true);
    zipFormRef.current?.submit();
    setTimeout(() => setZipping(false), 8000);
  };

  if (loading) {
    return (
      <Shell>
        <Header>
          <p className="mt-2 text-base text-muted">
            Memuat foto dari folder...
          </p>
        </Header>
        <ul
          role="list"
          className="mt-8 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <li
              key={i}
              className="aspect-square animate-pulse rounded-xl bg-line/50 motion-reduce:animate-none"
            />
          ))}
        </ul>
        <p role="status" className="sr-only">
          Memuat foto
        </p>
      </Shell>
    );
  }

  if (error) {
    return (
      <Notice title="Foto belum bisa dibuka">
        {error} Minta fotografer memeriksa pengaturan folder atau membuat link
        baru.
      </Notice>
    );
  }

  if (photos.length === 0) {
    return (
      <Notice title="Folder ini belum berisi foto">
        Minta fotografer mengunggah foto ke folder, lalu buka link ini lagi.
      </Notice>
    );
  }

  const notes = [];
  if (!wa) {
    notes.push(
      "Nomor WhatsApp fotografer tidak ada di link ini. Minta link baru ke fotografer.",
    );
  } else if (tooLong) {
    notes.push(
      "Daftar cukup panjang. Kalau pesan WhatsApp terpotong, tekan Salin daftar lalu tempel di chat.",
    );
  }
  if (count > MAX_ZIP) {
    notes.push(
      `ZIP maksimal ${MAX_ZIP} foto per unduhan. Kurangi pilihan atau unduh bertahap.`,
    );
  }

  const downloadClass = `inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-lightbox disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent sm:flex-none ${focusRing}`;

  return (
    <Shell>
      <Header>
        <p className="mt-2 max-w-md text-base leading-relaxed text-muted">
          Ketuk foto untuk memilih. Daftar nama file yang dipilih akan dikirim
          ke fotografer lewat WhatsApp.
        </p>
        <p className="mt-1 text-sm text-muted">
          {photos.length} foto di folder ini
        </p>
      </Header>

      <ul
        role="list"
        className="mt-8 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      >
        {photos.map((p) => {
          const on = selected.has(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                aria-pressed={on}
                aria-label={`${on ? "Batal pilih" : "Pilih"} ${p.name}`}
                className={`block w-full rounded-xl text-left ${focusRing}`}
              >
                <span
                  className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-line/50 transition-shadow duration-150 motion-reduce:transition-none ${
                    on ? "ring-[3px] ring-safelight" : "ring-0"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://drive.google.com/thumbnail?id=${p.id}&sz=w400`}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-contain"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute left-2 top-2 h-6 w-6"
                  >
                    <span className="absolute inset-0 rounded-full border-2 border-white/90 bg-ink/20" />
                    <span
                      className={`absolute inset-0 flex items-center justify-center rounded-full bg-developer text-white transition duration-150 motion-reduce:transition-none ${
                        on ? "scale-100 opacity-100" : "scale-50 opacity-0"
                      }`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M3.5 8.5l3 3 6-6.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </span>
                </span>
                <span
                  className={`mt-1.5 block truncate text-xs ${
                    on ? "font-semibold text-ink" : "text-muted"
                  }`}
                >
                  {p.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* form tersembunyi: ZIP diunduh lewat iframe supaya halaman tidak berpindah */}
      <form
        ref={zipFormRef}
        method="post"
        action="/api/zip"
        target="zip-frame"
        hidden
      >
        <input type="hidden" name="folder" value={folder ?? ""} />
        <input
          type="hidden"
          name="ids"
          value={JSON.stringify(chosen.map((p) => p.id))}
        />
      </form>
      <iframe name="zip-frame" title="Unduhan ZIP" hidden tabIndex={-1} />

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-sheet/95 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-4 sm:justify-start">
              <p aria-live="polite" className="text-sm font-semibold text-ink">
                {count === 0
                  ? "Belum ada foto dipilih"
                  : `${count} foto dipilih`}
              </p>
              {count > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className={`rounded text-sm font-medium text-muted underline underline-offset-4 hover:text-ink ${focusRing}`}
                  >
                    Hapus pilihan
                  </button>
                  <button
                    type="button"
                    onClick={copyList}
                    className={`rounded text-sm font-medium text-muted underline underline-offset-4 hover:text-ink ${focusRing}`}
                  >
                    {copied ? "Daftar tersalin" : "Salin daftar"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {count === 1 ? (
                <a
                  href={driveDownloadUrl(chosen[0].id)}
                  rel="noopener noreferrer"
                  className={downloadClass}
                >
                  <DownloadIcon />
                  Unduh foto
                </a>
              ) : (
                <button
                  type="button"
                  onClick={startZip}
                  disabled={count === 0 || count > MAX_ZIP || zipping}
                  className={downloadClass}
                >
                  <DownloadIcon />
                  {zipping
                    ? "Menyiapkan ZIP..."
                    : count > 1
                      ? "Unduh ZIP"
                      : "Unduh foto"}
                </button>
              )}
              <button
                type="button"
                onClick={sendWa}
                disabled={count === 0 || !wa}
                className={`flex-1 rounded-xl bg-developer px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-developer-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-muted sm:flex-none ${focusRing}`}
              >
                Kirim ke WhatsApp
              </button>
            </div>
          </div>

          {zipping && (
            <p
              role="status"
              className="mt-2 text-xs leading-relaxed text-muted"
            >
              ZIP sedang disiapkan dan akan muncul di unduhan browser. Untuk
              banyak foto, ini bisa butuh beberapa menit.
            </p>
          )}
          {notes.map((n) => (
            <p key={n} className="mt-2 text-xs leading-relaxed text-muted">
              {n}
            </p>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export default function PilihPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-base text-muted" role="status">
          Memuat...
        </p>
      }
    >
      <Picker />
    </Suspense>
  );
}
