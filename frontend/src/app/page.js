"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const WA_NUMBER = "6285179919500";
const WA_DISPLAY = "+62 851-7991-9500";

function extractFolderId(input) {
  const match =
    input.match(/\/folders\/([a-zA-Z0-9_-]+)/) ||
    input.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-developer";

export default function PhotographerPage() {
  const [driveLink, setDriveLink] = useState("");
  const [result, setResult] = useState("");
  const [hint, setHint] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const resultRef = useRef(null);

  const trimmed = driveLink.trim();
  const folderId = useMemo(() => extractFolderId(trimmed), [trimmed]);

  const onChange = (value) => {
    setDriveLink(value);
    setHint("");
    setResult("");
    setCopied(false);
    setCopyError(false);
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
    } catch {
      setHint("Tidak bisa membaca clipboard. Tempel manual di kolom ini.");
    }
  };

  const generate = (e) => {
    e.preventDefault();
    if (!folderId) return;
    setCopied(false);
    setCopyError(false);
    setResult(
      `${window.location.origin}/pilih?folder=${folderId}&wa=${WA_NUMBER}`,
    );
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  };

  // di HP, tombol generate ada di atas hasil: bawa hasil ke layar
  useEffect(() => {
    if (!result || !resultRef.current) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    resultRef.current.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "nearest",
    });
  }, [result]);

  const invalid = trimmed.length > 0 && !folderId;

  return (
    <main className="min-h-screen bg-lightbox px-5 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <h1 className="font-display text-[clamp(2rem,6vw,3.1rem)] font-medium leading-[1.08] tracking-[-0.01em] text-ink">
          Buat link pilih foto untuk klien
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-muted">
          Tempel link folder Google Drive. Klien memilih foto langsung dari link
          yang dibuat, dan daftar nama filenya dikirim ke WhatsApp {WA_DISPLAY}.
        </p>

        <form
          onSubmit={generate}
          className="mt-8 rounded-[20px] border border-line bg-sheet p-5 sm:p-6"
        >
          <label
            htmlFor="drive-link"
            className="text-sm font-semibold text-ink"
          >
            Link folder Google Drive
          </label>

          <div className="mt-2 flex gap-2">
            <input
              id="drive-link"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={driveLink}
              onChange={(e) => onChange(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
              aria-invalid={invalid}
              aria-describedby="drive-hint"
              className={`min-w-0 flex-1 rounded-xl border bg-sheet px-3.5 py-3 text-base text-ink placeholder:text-muted/70 ${focusRing} ${
                invalid ? "border-danger" : "border-line"
              }`}
            />
            <button
              type="button"
              onClick={paste}
              className={`shrink-0 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-lightbox ${focusRing}`}
            >
              Tempel
            </button>
          </div>

          <p
            id="drive-hint"
            aria-live="polite"
            className={`mt-2 flex min-h-5 items-center gap-1.5 text-sm ${
              folderId && !hint ? "text-developer" : "text-danger"
            }`}
          >
            {hint ? (
              hint
            ) : folderId ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3.5 8.5l3 3 6-6.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Folder terdeteksi.
              </>
            ) : invalid ? (
              "Link ini belum terbaca sebagai folder. Salin link dari folder, bukan dari satu file."
            ) : null}
          </p>

          <button
            type="submit"
            disabled={!folderId}
            className={`mt-4 w-full rounded-xl bg-developer px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-developer-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-muted ${focusRing}`}
          >
            Buat link untuk klien
          </button>
        </form>

        <details className="group mt-4 rounded-xl border border-line bg-sheet text-sm">
          <summary
            className={`flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 font-medium text-ink [&::-webkit-details-marker]:hidden ${focusRing}`}
          >
            Folder harus bisa dibuka siapa saja yang punya link
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className="shrink-0 transition-transform group-open:rotate-180"
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </summary>
          <ol className="list-decimal space-y-1.5 px-4 pb-4 pl-9 leading-relaxed text-muted">
            <li>Di Google Drive, klik kanan folder lalu pilih Bagikan.</li>
            <li>Di bagian Akses umum, pilih Siapa saja yang memiliki link.</li>
            <li>Pastikan perannya Pelihat (Viewer), lalu klik Selesai.</li>
          </ol>
        </details>

        {result && (
          <section
            key={result}
            ref={resultRef}
            aria-labelledby="result-title"
            className="develop mt-6 rounded-[20px] border border-developer bg-sheet p-5 sm:p-6"
          >
            <h2
              id="result-title"
              className="font-display text-xl font-medium text-ink"
            >
              Link siap dikirim ke klien
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Klien membuka link ini, memilih foto, lalu menekan Kirim ke
              WhatsApp.
            </p>

            <input
              readOnly
              value={result}
              aria-label="Link untuk klien"
              onFocus={(e) => e.target.select()}
              className={`mt-4 w-full rounded-xl border border-line bg-lightbox px-3.5 py-2.5 text-sm text-ink ${focusRing}`}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copy}
                className={`rounded-xl bg-developer px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-developer-deep ${focusRing}`}
              >
                {copied ? "Link tersalin" : "Salin link"}
              </button>
              <a
                href={result}
                target="_blank"
                rel="noopener noreferrer"
                className={`rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-lightbox ${focusRing}`}
              >
                Buka halaman klien
              </a>
            </div>

            {copyError && (
              <p className="mt-3 text-sm text-danger" role="alert">
                Tidak bisa menyalin otomatis. Pilih link di atas lalu salin
                manual.
              </p>
            )}
            <span className="sr-only" role="status">
              {copied ? "Link tersalin" : ""}
            </span>
          </section>
        )}
      </div>
    </main>
  );
}
