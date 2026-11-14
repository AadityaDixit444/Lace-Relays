"use client";
/* eslint-disable @next/next/no-img-element -- Magnifier reuses the product asset without a second download. */
import { useRef, useState, type CSSProperties } from "react";
import { X, ZoomIn } from "lucide-react";

type Point = { x: number; y: number };
const clamp = (n: number) => Math.max(1 / 6, Math.min(5 / 6, n));

export function ProductZoom({
  src,
  alt,
  tone,
}: {
  src: string;
  alt: string;
  tone: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [point, setPoint] = useState<Point>({ x: 0.5, y: 0.5 });
  function open() {
    setPoint({ x: 0.5, y: 0.5 });
    dialog.current?.showModal();
  }
  const style = {
    "--zoom-x": `${point.x * 100}%`,
    "--zoom-y": `${point.y * 100}%`,
    "--zoom-dx": `${(0.5 - point.x) * 100}%`,
    "--zoom-dy": `${(0.5 - point.y) * 100}%`,
  } as CSSProperties;
  return (
    <>
      <button
        type="button"
        className={`detail-image product-image zoom-trigger ${tone}`}
        onClick={open}
        aria-label={`Enlarge ${alt}`}
        aria-haspopup="dialog"
      >
        <img src={src} alt={alt} width={800} height={480} />
        <span className="zoom-trigger-label">
          <ZoomIn size={16} /> Inspect the details
        </span>
      </button>
      <dialog
        ref={dialog}
        className="product-zoom-dialog"
        aria-label={`Image detail: ${alt}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <header className="zoom-header">
          <div>
            <strong>{alt}</strong>
            <p>
              Move or drag over the image to magnify. Arrow keys move the lens.
            </p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={() => dialog.current?.close()}
            aria-label="Close image zoom"
          >
            <X size={22} />
          </button>
        </header>
        <div className="zoom-panes" style={style}>
          <div
            className="zoom-source"
            tabIndex={0}
            role="group"
            aria-label="Magnifier position. Use arrow keys to move."
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setPoint({
                x: clamp((e.clientX - rect.left) / rect.width),
                y: clamp((e.clientY - rect.top) / rect.height),
              });
            }}
            onPointerDown={(e) =>
              e.currentTarget.setPointerCapture(e.pointerId)
            }
            onKeyDown={(e) => {
              const delta = {
                ArrowLeft: [-0.04, 0],
                ArrowRight: [0.04, 0],
                ArrowUp: [0, -0.04],
                ArrowDown: [0, 0.04],
              }[e.key];
              if (delta) {
                e.preventDefault();
                setPoint((p) => ({
                  x: clamp(p.x + delta[0]),
                  y: clamp(p.y + delta[1]),
                }));
              }
            }}
          >
            <img
              src={src}
              alt={alt}
              width={800}
              height={480}
              draggable={false}
            />
            <span className="zoom-lens" aria-hidden="true" />
          </div>
          <div
            className="zoom-result"
            aria-label="Three times magnified detail"
          >
            <img
              src={src}
              alt={`Magnified detail of ${alt}`}
              width={800}
              height={480}
              draggable={false}
            />
            <span className="zoom-badge">3× DETAIL</span>
          </div>
        </div>
        <p className="zoom-quality-note">
          Image detail depends on the original photo resolution. Press Escape or
          close to return.
        </p>
      </dialog>
    </>
  );
}
