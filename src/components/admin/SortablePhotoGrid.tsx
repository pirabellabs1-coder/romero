"use client";
/**
 * Drag-and-drop wrapper for the gallery photo grid.
 *
 * Each tile gets a dedicated drag handle (grip icon, top-left corner)
 * so the rest of the tile keeps working normally — clicking the cover
 * button, editing the alt text, picking a span, etc. never accidentally
 * starts a drag. The handle is the only draggable surface.
 *
 * On drop the local order is updated optimistically and persisted via a
 * single bulk server action that rewrites every sort_order in one
 * transaction. The arrow buttons inside PhotoTile remain as a fallback.
 *
 * Native HTML5 DnD — no extra dependency. Mouse + trackpad only;
 * touch devices fall back to the arrow buttons.
 */
import { useMemo, useRef, useState, useTransition, type ReactElement } from "react";

type ReorderAction = (
  galleryId: number,
  orderedIds: number[]
) => Promise<{ ok: true } | { ok: false; error: string }>;

type Props = {
  galleryId: number;
  initialOrder: number[];
  reorderAction: ReorderAction;
  /** One ReactElement per photo, keyed by photo id (as string). */
  tilesById: Record<string, ReactElement>;
};

export default function SortablePhotoGrid({
  galleryId,
  initialOrder,
  reorderAction,
  tilesById,
}: Props) {
  const [order, setOrder] = useState<number[]>(initialOrder);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "ok" }
    | { kind: "err"; msg: string }
  >({ kind: "idle" });
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const ids = useMemo(() => order, [order]);

  function persist(next: number[]) {
    setStatus({ kind: "saving" });
    start(async () => {
      const res = await reorderAction(galleryId, next);
      if (res.ok) {
        setStatus({ kind: "ok" });
        setTimeout(() => setStatus({ kind: "idle" }), 2200);
      } else {
        setStatus({ kind: "err", msg: res.error });
      }
    });
  }

  function commitReorder(fromId: number, toId: number) {
    if (fromId === toId) return;
    setOrder((prev) => {
      const fIdx = prev.indexOf(fromId);
      const tIdx = prev.indexOf(toId);
      if (fIdx === -1 || tIdx === -1) return prev;
      const next = prev.slice();
      const [moved] = next.splice(fIdx, 1);
      next.splice(tIdx, 0, moved);
      persist(next);
      return next;
    });
  }

  return (
    <>
      <div className="spg-hint">
        <span className="spg-hint-icon" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="5" r="1" />
            <circle cx="9" cy="12" r="1" />
            <circle cx="9" cy="19" r="1" />
            <circle cx="15" cy="5" r="1" />
            <circle cx="15" cy="12" r="1" />
            <circle cx="15" cy="19" r="1" />
          </svg>
        </span>
        <span className="spg-hint-text">
          Saisissez la poignée <strong>⋮⋮</strong> en haut à gauche d&apos;une photo pour la glisser-déposer à la position voulue.
          Les flèches restent disponibles pour un ajustement fin.
        </span>
        {status.kind === "saving" && <span className="spg-pill spg-pill--saving">Enregistrement…</span>}
        {status.kind === "ok" && <span className="spg-pill spg-pill--ok">✓ Ordre enregistré</span>}
        {status.kind === "err" && <span className="spg-pill spg-pill--err">❌ {status.msg}</span>}
      </div>

      <div
        className={`spg-grid${pending ? " is-pending" : ""}`}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 20,
          marginTop: 16,
        }}
      >
        {ids.map((pid) => {
          const tile = tilesById[String(pid)];
          if (!tile) return null;
          const isDragging = dragId === pid;
          const isOver = overId === pid && dragId !== null && dragId !== pid;
          return (
            <div
              key={pid}
              ref={(el) => { itemRefs.current[String(pid)] = el; }}
              className={`spg-item${isDragging ? " is-dragging" : ""}${isOver ? " is-over" : ""}`}
              onDragOver={(e) => {
                if (dragId === null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overId !== pid) setOverId(pid);
              }}
              onDragLeave={() => {
                if (overId === pid) setOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragId;
                setDragId(null);
                setOverId(null);
                if (from === null) return;
                commitReorder(from, pid);
              }}
            >
              {/* Drag handle — the ONLY draggable surface. The rest of the
                  tile (buttons, inputs, selects) stays normally clickable. */}
              <button
                type="button"
                className="spg-handle"
                title="Glisser pour déplacer"
                aria-label="Glisser pour déplacer cette photo"
                draggable
                onDragStart={(e) => {
                  setDragId(pid);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(pid));
                  // Make the drag preview the whole tile, not just the handle.
                  const node = itemRefs.current[String(pid)];
                  if (node) {
                    const rect = node.getBoundingClientRect();
                    e.dataTransfer.setDragImage(
                      node,
                      Math.min(40, rect.width / 2),
                      Math.min(40, rect.height / 2)
                    );
                  }
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="9" cy="5" r="1" />
                  <circle cx="9" cy="12" r="1" />
                  <circle cx="9" cy="19" r="1" />
                  <circle cx="15" cy="5" r="1" />
                  <circle cx="15" cy="12" r="1" />
                  <circle cx="15" cy="19" r="1" />
                </svg>
              </button>

              {tile}
            </div>
          );
        })}
      </div>

      <style>{`
        .spg-hint {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12.5px;
          color: var(--ink);
          padding: 12px 16px;
          background: rgba(184, 151, 90, 0.08);
          border: 1px solid rgba(184, 151, 90, 0.35);
          border-radius: 6px;
          margin: 22px 0 0;
        }
        .spg-hint-icon {
          flex-shrink: 0;
          color: var(--gold);
          display: inline-flex;
          align-items: center;
        }
        .spg-hint-text { flex: 1; line-height: 1.5; }
        .spg-hint-text strong { color: var(--gold-deep); font-weight: 600; }
        .spg-pill {
          flex-shrink: 0;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.04em;
        }
        .spg-pill--saving { background: var(--cream-deep); color: var(--muted); }
        .spg-pill--ok { background: rgba(46, 61, 46, 0.1); color: var(--sage-deep); }
        .spg-pill--err { background: rgba(139, 46, 46, 0.1); color: #8B2E2E; }

        .spg-grid.is-pending { opacity: 0.85; }

        .spg-item {
          position: relative;
          transition: transform 140ms ease, opacity 140ms ease, box-shadow 140ms ease;
        }
        .spg-item.is-dragging {
          opacity: 0.35;
          transform: scale(0.97);
        }
        .spg-item.is-over::before {
          content: "";
          position: absolute;
          inset: -6px;
          border: 2px dashed var(--gold);
          border-radius: 8px;
          pointer-events: none;
          z-index: 5;
        }

        .spg-handle {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 4;
          width: 32px;
          height: 32px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(46, 61, 46, 0.85);
          color: #F4EFE3;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          cursor: grab;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(4px);
          transition: background 120ms, transform 120ms;
        }
        .spg-handle:hover {
          background: var(--gold);
          color: #FFFFFF;
          transform: scale(1.06);
        }
        .spg-handle:active { cursor: grabbing; transform: scale(0.96); }
        .spg-handle:focus-visible {
          outline: 2px solid var(--gold);
          outline-offset: 2px;
        }
      `}</style>
    </>
  );
}
