"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-developer";
const focusRingLight =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

// batas aman panjang URL wa.me; lewat dari ini sebaiknya daftar disalin manual
const WA_URL_SOFT_LIMIT = 1800;

// harus sama dengan MAX_FILES di app/api/zip/route.js
const MAX_ZIP = 100;

// tahan foto selama ini (ms) untuk membuka foto besar
const LONG_PRESS_MS = 700;
// jari bergeser lebih dari ini (px) dianggap scroll, bukan menahan
const MOVE_TOLERANCE = 10;

const driveDownloadUrl = (id) =>
  `https://drive.google.com/uc?export=download&id=${id}`;
const thumbUrl = (id, size) =>
  `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;

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

function ExpandIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10.25 10.25l3.25 3.25M7 5.25v3.5M5.25 7h3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ className = "" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M10 3.5L5.5 8l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 8.5l3 3 6-6.5"
        stroke="currentColor"
        strokeWidth="2"
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

// <dialog> bawaan browser: fokus terkunci, Esc menutup, latar belakang nonaktif
function Modal({
  open,
  onClose,
  label,
  closeOnBackdrop = false,
  className = "",
  children,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // kunci scroll halaman di belakang modal
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      className={className}
    >
      {open ? children : null}
    </dialog>
  );
}

function BigImage({ photo }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="absolute inset-0">
      {/* pratinjau kecil tampil dulu, versi besar memudar masuk di atasnya */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbUrl(photo.id, 400)}
        alt=""
        referrerPolicy="no-referrer"
        className="absolute inset-0 h-full w-full object-contain"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbUrl(photo.id, 1600)}
        alt={photo.name}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 motion-reduce:transition-none ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
      {!loaded && !failed && (
        <p
          role="status"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/80 px-3 py-1 text-xs text-white"
        >
          Memuat ukuran besar...
        </p>
      )}
      {failed && (
        <p
          role="status"
          className="absolute bottom-3 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-full bg-ink/80 px-3 py-1 text-center text-xs text-white"
        >
          Ukuran besar belum bisa dimuat. Yang tampil adalah pratinjau.
        </p>
      )}
    </div>
  );
}

function Viewer({
  photos,
  index,
  selectedIds,
  quotaFull,
  selectedLabel,
  flash,
  onToggle,
  onMove,
  onClose,
}) {
  const photo = photos[index];
  const on = selectedIds.has(photo.id);
  const blocked = quotaFull && !on;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") onMove(-1);
      if (e.key === "ArrowRight") onMove(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onMove]);

  const navClass = `flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-white/10 ${focusRingLight}`;

  return (
    <div className="flex h-dvh w-full flex-col bg-ink text-white">
      <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{photo.name}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-white/70">
            Foto {index + 1} dari {photos.length}
            {on && (
              <span className="inline-flex items-center gap-1 rounded-full bg-developer px-2 py-0.5 font-semibold text-white">
                <CheckIcon size={12} />
                Terpilih
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup foto besar"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10 ${focusRingLight}`}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <BigImage key={photo.id} photo={photo} />
      </div>

      <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {flash && (
          <p
            role="status"
            className="mx-auto mb-2 max-w-md text-center text-xs font-medium text-white"
          >
            {flash}
          </p>
        )}
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Foto sebelumnya"
            className={navClass}
          >
            <ChevronIcon />
          </button>

          <button
            type="button"
            onClick={() => onToggle(photo.id)}
            aria-pressed={on}
            disabled={blocked}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
              on
                ? "bg-developer text-white hover:bg-developer-deep"
                : blocked
                  ? "bg-white/15 text-white/70"
                  : "bg-white text-ink hover:bg-lightbox"
            } ${focusRingLight}`}
          >
            {on ? "Batal pilih" : blocked ? "Kuota penuh" : "Pilih foto ini"}
          </button>

          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === photos.length - 1}
            aria-label="Foto berikutnya"
            className={navClass}
          >
            <ChevronIcon className="rotate-180" />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-white/70">
          {selectedLabel}
        </p>
      </div>
    </div>
  );
}

function Picker() {
  const params = useSearchParams();
  const folder = params.get("folder");
  const wa = params.get("wa");
  const quotaParam = params.get("quota");

  const [photos, setPhotos] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [viewIndex, setViewIndex] = useState(null);
  const [showIntro, setShowIntro] = useState(false);
  const [pressingId, setPressingId] = useState(null);
  const [flash, setFlash] = useState("");

  const zipFormRef = useRef(null);
  const flashTimer = useRef(null);
  const press = useRef({ timer: null, x: 0, y: 0, fired: false });

  const storageKey = `selected:${folder}`;
  const introKey = `intro-seen:${folder}`;

  // kuota dari link; kosong atau tidak valid = tanpa batas
  const quotaNum = useMemo(() => {
    const n = parseInt(quotaParam ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : 10;
  }, [quotaParam]);

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

  // load pilihan tersimpan + cek apakah modal pengantar sudah pernah dilihat
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setSelected(new Set(JSON.parse(raw)));
    } catch {}
    try {
      if (!localStorage.getItem(introKey)) setShowIntro(true);
    } catch {
      setShowIntro(true);
    }
    setReady(true);
  }, [storageKey, introKey]);

  // buang pilihan yang fotonya sudah tidak ada, dan potong sesuai kuota
  useEffect(() => {
    if (!ready || photos.length === 0) return;
    const ids = new Set(photos.map((p) => p.id));
    setSelected((prev) => {
      let next = [...prev].filter((id) => ids.has(id));
      if (quotaNum) next = next.slice(0, quotaNum);
      return next.length === prev.size ? prev : new Set(next);
    });
  }, [ready, photos, quotaNum]);

  // simpan pilihan
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...selected]));
    } catch {}
  }, [selected, ready, storageKey]);

  // bersihkan timer saat halaman ditutup
  useEffect(() => {
    const pressState = press.current;
    return () => {
      clearTimeout(flashTimer.current);
      clearTimeout(pressState.timer);
    };
  }, []);

  // hanya foto yang benar-benar ada di folder
  const chosen = useMemo(
    () => photos.filter((p) => selected.has(p.id)),
    [photos, selected],
  );
  const count = chosen.length;
  const quotaFull = quotaNum !== null && count >= quotaNum;
  const selectedLabel =
    quotaNum !== null
      ? `${count} dari ${quotaNum} foto dipilih`
      : count === 0
        ? "Belum ada foto dipilih"
        : `${count} foto dipilih`;

  const showFlash = (msg) => {
    setFlash(msg);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(""), 3500);
  };

  const toggle = (id) => {
    if (!selected.has(id) && quotaNum !== null && count >= quotaNum) {
      showFlash(
        `Kuota ${quotaNum} foto sudah terpakai. Batal pilih satu foto untuk memilih yang lain.`,
      );
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- tahan 2 detik untuk memperbesar ---
  const cancelPress = () => {
    clearTimeout(press.current.timer);
    press.current.timer = null;
    setPressingId(null);
  };

  const startPress = (e, index) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const state = press.current;
    state.fired = false;
    state.x = e.clientX;
    state.y = e.clientY;
    clearTimeout(state.timer);
    setPressingId(photos[index].id);
    state.timer = setTimeout(() => {
      state.fired = true;
      state.timer = null;
      setPressingId(null);
      setViewIndex(index);
    }, LONG_PRESS_MS);
  };

  const movePress = (e) => {
    const state = press.current;
    if (!state.timer) return;
    if (Math.hypot(e.clientX - state.x, e.clientY - state.y) > MOVE_TOLERANCE) {
      cancelPress();
    }
  };

  // klik setelah tahan lama tidak boleh ikut memilih foto
  const onCardClick = (id) => {
    if (press.current.fired) {
      press.current.fired = false;
      return;
    }
    toggle(id);
  };

  const closeViewer = () => {
    press.current.fired = false;
    setViewIndex(null);
  };

  const moveViewer = (delta) => {
    setViewIndex((i) =>
      i === null ? i : Math.min(photos.length - 1, Math.max(0, i + delta)),
    );
  };

  const closeIntro = () => {
    setShowIntro(false);
    try {
      localStorage.setItem(introKey, "1");
    } catch {}
  };

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
          Ketuk foto untuk memilih, tahan 1 detik untuk memperbesar. Daftar nama
          file yang dipilih dikirim ke fotografer lewat WhatsApp.
        </p>
        <p className="mt-1 text-sm text-muted">
          {photos.length} foto di folder ini
          {quotaNum !== null && `. Kamu bisa memilih sampai ${quotaNum} foto.`}
        </p>
      </Header>

      <ul
        role="list"
        className="mt-8 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      >
        {photos.map((p, i) => {
          const on = selected.has(p.id);
          const pressing = pressingId === p.id;
          return (
            <li key={p.id} className="relative">
              <button
                type="button"
                onClick={() => onCardClick(p.id)}
                onPointerDown={(e) => startPress(e, i)}
                onPointerMove={movePress}
                onPointerUp={cancelPress}
                onPointerLeave={cancelPress}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => e.preventDefault()}
                aria-pressed={on}
                aria-label={`${on ? "Batal pilih" : "Pilih"} ${p.name}`}
                className={`block w-full select-none rounded-xl text-left [-webkit-touch-callout:none] ${focusRing}`}
              >
                <span
                  className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-line/50 transition-[box-shadow,opacity] duration-150 motion-reduce:transition-none ${
                    on ? "ring-[3px] ring-safelight" : "ring-0"
                  } ${quotaFull && !on ? "opacity-50" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl(p.id, 400)}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    referrerPolicy="no-referrer"
                    className="pointer-events-none h-full w-full object-contain"
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
                      <CheckIcon size={14} />
                    </span>
                  </span>
                  {/* penanda waktu menahan: terisi penuh dalam 2 detik */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-1 origin-left bg-safelight"
                    style={{
                      transform: pressing ? "scaleX(1)" : "scaleX(0)",
                      opacity: pressing ? 1 : 0,
                      transition: pressing
                        ? `transform ${LONG_PRESS_MS}ms linear, opacity 150ms linear 300ms`
                        : "none",
                    }}
                  />
                </span>
                <span
                  className={`mt-1.5 block truncate text-xs ${
                    on ? "font-semibold text-ink" : "text-muted"
                  }`}
                >
                  {p.name}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewIndex(i)}
                aria-label={`Perbesar ${p.name}`}
                className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/50 text-white backdrop-blur-sm transition-colors before:absolute before:-inset-1.5 hover:bg-ink/75 ${focusRing}`}
              >
                <ExpandIcon />
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
                {selectedLabel}
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

          {flash && (
            <p
              role="status"
              className="mt-2 text-xs font-semibold leading-relaxed text-ink"
            >
              {flash}
            </p>
          )}
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

      {/* foto besar */}
      <Modal
        open={viewIndex !== null}
        onClose={closeViewer}
        label="Foto ukuran besar"
        className="m-0 h-dvh max-h-none w-dvw max-w-none border-0 bg-ink p-0 text-white backdrop:bg-ink"
      >
        {viewIndex !== null && (
          <Viewer
            photos={photos}
            index={viewIndex}
            selectedIds={selected}
            quotaFull={quotaFull}
            selectedLabel={selectedLabel}
            flash={flash}
            onToggle={toggle}
            onMove={moveViewer}
            onClose={closeViewer}
          />
        )}
      </Modal>

      {/* modal pengantar, muncul sekali per folder */}
      <Modal
        open={showIntro}
        onClose={closeIntro}
        label="Cara memilih foto"
        closeOnBackdrop
        className="m-auto w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-[20px] border border-line bg-sheet p-0 text-ink backdrop:bg-ink/60"
      >
        <div className="p-6">
          <h2 className="font-display text-2xl font-medium leading-tight tracking-[-0.01em]">
            {quotaNum !== null
              ? `Kamu bisa memilih sampai ${quotaNum} foto`
              : "Cara memilih foto"}
          </h2>
          {quotaNum !== null && (
            <p className="mt-2 text-base leading-relaxed text-muted">
              Kuota ini ditentukan fotografer. Kalau sudah penuh, batalkan satu
              pilihan untuk memilih foto lain.
            </p>
          )}
          <ul className="mt-4 space-y-3 text-base leading-relaxed">
            <li>
              <b className="font-semibold">Ketuk foto</b> untuk memilih atau
              membatalkan pilihan.
            </li>
            <li>
              <b className="font-semibold">Tahan 1 detik</b> untuk melihat foto
              lebih besar. Foto besar juga bisa dipilih.
            </li>
            <li>
              <b className="font-semibold">Kirim ke WhatsApp</b> kalau sudah
              selesai, dan daftar nama filenya terkirim ke fotografer.
            </li>
          </ul>
          <button
            type="button"
            onClick={closeIntro}
            className={`mt-6 w-full rounded-xl bg-developer px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-developer-deep ${focusRing}`}
          >
            Mulai memilih
          </button>
        </div>
      </Modal>
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
