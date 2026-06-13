"use client";
/**
 * Drag-and-drop wrapper for the gallery photo grid.
 *
 * Each child is wrapped in a draggable shell. On drop we optimistically
 * reorder the local list AND call the bulk reorder server action so the
 * change persists. Arrow buttons inside PhotoTile keep working as a
 * fallback (and for keyboard users).
 *
 * Native HTML5 DnD only — no extra dependency. Mouse + trackpad on
 * desktop; touch devices fall back to the arrow buttons.
 */
import { useMemo, useState, useTransition, type ReactElement } from "react";

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

  const ids = useMemo(() => order, [order]);

  function moveLocal(fromId: number, toId: number) {
    if (fromId === toId) return;
    setOrder((prev) => {
      const from = prev.indexOf(fromId);
      const to = prev.indexOf(toId);
      if (from === -1 || to === -1) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function persist(next: number[]) {
    setStatus({ kind: "saving" });
    start(async () => {
      const res = await reorderAction(galleryId, next);
      if (res.ok) {
        setStatus({ kind: "ok" });
        setTimeout(() => setStatus({ kind: "idle" }), 1800);
      } else {
        setStatus({ kind: "err", msg: res.error });
      }
    });
  }

  return (
    <>
      <div className="sortable-photo-grid__hint">
        <span>↕</span>
        <span>
          Glissez-déposez les photos pour les réorganiser. Les flèches restent disponibles pour un ajustement précis.
        </span>
        {status.kind === "saving" && <span className="sortable-photo-grid__pill saving">Enregistrement…</span>}
        {status.kind === "ok" && <span className="sortable-photo-grid__pill ok">✓ Ordre enregistré</span>}
        {status.kind === "err" && <span className="sortable-photo-grid__pill err">❌ {status.msg}</span>}
      </div>

      <div
        className={`sortable-photo-grid${pending ? " is-pending" : ""}`}
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
              draggable
              onDragStart={(e) => {
                setDragId(pid);
                e.dataTransfer.effectAllowed = "move";
                // Required for Firefox to start the drag.
                e.dataTransfer.setData("text/plain", String(pid));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragId !== null && overId !== pid) setOverId(pid);
              }}
              onDragLeave={() => {
                if (overId === pid) setOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragId;
                setDragId(null);
                setOverId(null);
                if (from === null || from === pid) return;
                // Commit the new order locally first, then persist.
                setOrder((prev) => {
                  const fIdx = prev.indexOf(from);
                  const tIdx = prev.indexOf(pid);
                  if (fIdx === -1 || tIdx === -1) return prev;
                  const next = prev.slice();
                  const [moved] = next.splice(fIdx, 1);
                  next.splice(tIdx, 0, moved);
                  persist(next);
                  return next;
                });
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={`sortable-photo-grid__item${isDragging ? " is-dragging" : ""}${isOver ? " is-over" : ""}`}
              style={{
                opacity: isDragging ? 0.4 : 1,
                outline: isOver ? "2px dashed var(--gold)" : "none",
                outlineOffset: 4,
                transition: "outline-color 120ms",
                cursor: "grab",
              }}
              aria-grabbed={isDragging}
            >
              {tile}
            </div>
          );
        })}
      </div>

      <style>{`
        .sortable-photo-grid__hint {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: var(--muted);
          padding: 10px 14px;
          background: var(--cream);
          border: 1px dashed var(--rule);
          border-radius: 6px;
          margin: 22px 0 0;
        }
        .sortable-photo-grid__hint > span:first-child {
          font-size: 14px;
          color: var(--gold);
        }
        .sortable-photo-grid__pill {
          margin-left: auto;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 500;
        }
        .sortable-photo-grid__pill.saving { background: var(--cream-deep); color: var(--muted); }
        .sortable-photo-grid__pill.ok { background: rgba(46, 61, 46, 0.08); color: var(--sage-deep); }
        .sortable-photo-grid__pill.err { background: rgba(139, 46, 46, 0.08); color: #8B2E2E; }
        .sortable-photo-grid__item:active { cursor: grabbing; }
        .sortable-photo-grid.is-pending { pointer-events: none; }
      `}</style>
    </>
  );
}
