"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export type LightboxImage = {
  id: string;
  storageKey: string;
  alt: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
};

/**
 * Gallery grid with a lightbox.
 *
 * Built on the native <dialog> element, which gives the modal semantics, the
 * focus trap, the inert background and Escape-to-close for free — all of which
 * are easy to get subtly wrong by hand.
 */
export function GalleryGrid({ images }: { images: LightboxImage[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // Remembered so focus can return to the thumbnail the viewer opened.
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const open = useCallback((index: number, trigger: HTMLButtonElement) => {
    openerRef.current = trigger;
    setActiveIndex(index);
    dialogRef.current?.showModal();
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const step = useCallback(
    (delta: number) => {
      setActiveIndex((current) => {
        if (current === null) return current;
        // Wraps around, so the arrows never dead-end.
        return (current + delta + images.length) % images.length;
      });
    },
    [images.length],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      }
    }

    function onClose() {
      setActiveIndex(null);
      openerRef.current?.focus();
    }

    dialog.addEventListener("keydown", onKeyDown);
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      dialog.removeEventListener("close", onClose);
    };
  }, [step]);

  const active = activeIndex === null ? null : images[activeIndex];

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {images.map((image, index) => (
          <li key={image.id}>
            <button
              type="button"
              onClick={(event) => open(index, event.currentTarget)}
              className="group relative block w-full overflow-hidden"
            >
              <span className="sr-only">
                View larger: {image.caption ?? image.alt ?? `image ${index + 1}`}
              </span>
              <Image
                src={`/media/${image.storageKey}`}
                alt={image.alt ?? ""}
                width={image.width ?? 800}
                height={image.height ?? 600}
                sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                loading="lazy"
                {...(image.blurDataUrl
                  ? { placeholder: "blur" as const, blurDataURL: image.blurDataUrl }
                  : {})}
                className="aspect-square w-full object-cover transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-navy-950/0 transition-colors group-hover:bg-navy-950/20" />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label="Image viewer"
        // The ::backdrop is styled in globals.css; open:flex is what makes the
        // dialog lay out once it is shown.
        className="m-auto max-h-[92vh] w-[min(64rem,94vw)] bg-transparent p-0 backdrop:bg-navy-950/85 open:flex open:flex-col"
        onClick={(event) => {
          // Clicking the backdrop (the dialog element itself) dismisses.
          if (event.target === dialogRef.current) close();
        }}
      >
        {active ? (
          <div className="flex flex-col gap-3">
            <div className="relative flex items-center justify-center">
              <Image
                key={active.id}
                src={`/media/${active.storageKey}`}
                alt={active.alt ?? ""}
                width={active.width ?? 1600}
                height={active.height ?? 1066}
                sizes="(min-width: 1024px) 64rem, 94vw"
                className="max-h-[76vh] w-auto object-contain"
              />
            </div>

            <div className="flex items-center justify-between gap-4 text-white">
              <p className="min-w-0 text-sm">
                {active.caption ? <span>{active.caption}</span> : null}
                <span className="ml-2 text-white/60">
                  {(activeIndex ?? 0) + 1} of {images.length}
                </span>
              </p>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <span className="sr-only">Previous image</span>
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
                    <path d="M13 8H2m4-4-4 4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <span className="sr-only">Next image</span>
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
                    <path d="M3 8h11M10 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"
                >
                  <span className="sr-only">Close viewer</span>
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
                    <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
