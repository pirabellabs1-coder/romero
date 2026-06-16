"use client";
/**
 * Drag-and-drop wrapper for the gallery photo grid.
 *
 * Architecture notes (read before changing):
 * - The server page renders one <SortablePhotoItem id={p.id}> per photo
 *   as a child of this component. We track the order locally with
 *   useState and reposition items via CSS `order` so React never has
 *   to reconcile a reshuffled list — the children array stays stable.
 * - Drag state lives in refs (dragIdRef, ids) because HTML5 drag events
 *   fire synchronously and would see a stale React state otherwise.
 * - The handle is a div with role="button" because <button draggable>
 *   has quirky native behavior in some browsers (clicks vs drags).
 * - onDragOver MUST call preventDefault() to mark the element as a
 *   valid drop target — without it the drop never fires.
 *
 * Touch devices don't get DnD (HTML5 spec doesn't support touch);
 * the arrow buttons inside PhotoTile remain the fallback there.
 */
import { Children, useMemo, useRef, useState, useTransition } from "react";

type ReorderAction = (
  galleryId: number,
  orderedIds: number[]
) => Promise<{ ok: true } | { ok: false; error: string }>;

type ItemMeta = { id: number; node: React.ReactNode };

type GridProps = {
  galleryId: number;
  reorderAction: ReorderAction;
  /** SortablePhotoItem elements — see below. */
  children: React.ReactNode;
};

/** Wraps each photo tile. Carries the photo id used to compute order. */
export function SortablePhotoItem({ id, children }: { id: number; children: React.ReactNode }) {
  // The grid reads { props.id, props.children } from each child via
  // React.Children traversal; this component is just a tagged carrier.
  // We render nothing here — the grid renders the body inside its own
  // wrapper so it can attach DnD listeners and the CSS order property.
  return <>{children}</>;
}
// Tag so Children.map can recognise it even after JSX compilation.
(SortablePhotoItem as React.FC<{ id: number; children: React.ReactNode }> & {
  __sortableTag?: boolean;
}).__sortableTag = true;

export default function SortablePhotoGrid({ galleryId, reorderAction, children }: GridProps) {
  // Extract id + node from each <SortablePhotoItem id={…}>.
  const items: ItemMeta[] = useMemo(() => {
    const out: ItemMeta[] = [];
    Children.forEach(children, (child) => {
      if (!child || typeof child !== "object" || !("props" in child)) return;
      const props = (child as React.ReactElement).props as { id?: number; children?: React.ReactNode };
      if (typeof props.id === "number") {
        out.push({ id: props.id, node: props.children });
      }
    });
    return out;
  }, [children]);

  // Order is the array of photo IDs in their current visual order.
  const [order, setOrder] = useState<number[]>(() => items.map((it) => it.id));
  const [overId, setOverId] = useState<number | null>(null);
  const [dragId, setDragIdState] = useState<number | null>(null);
  const dragIdRef = useRef<number | null>(null);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "ok" }
    | { kind: "err"; msg: string }
  >({ kind: "idle" });
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function setDragId(v: number | null) {
    dragIdRef.current = v;
    setDragIdState(v);
  }

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

  // Map photo id → its visual order index for CSS `order`.
  const orderIndex = useMemo(() => {
    const m: Record<string, number> = {};
    order.forEach((id, i) => { m[String(id)] = i; });
    return m;
  }, [order]);

  return (
    <>
      <div className="spg-hint" role="note">
        <span className="spg-hint-icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="5" r="1.2" />
            <circle cx="9" cy="12" r="1.2" />
            <circle cx="9" cy="19" r="1.2" />
            <circle cx="15" cy="5" r="1.2" />
            <circle cx="15" cy="12" r="1.2" />
            <circle cx="15" cy="19" r="1.2" />
          </svg>
        </span>
        <span className="spg-hint-text">
          <strong>Glisser-déposer&nbsp;:</strong> saisissez la <strong>poignée dorée</strong> en haut à gauche de la photo, puis lâchez-la sur la photo où vous voulez la déplacer. Les flèches restent disponibles pour un ajustement fin.
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
        {items.map((it) => {
          const pid = it.id;
          const isDragging = dragId === pid;
          const isOver = overId === pid && dragId !== null && dragId !== pid;
          return (
            <div
              key={pid}
              ref={(el) => { itemRefs.current[String(pid)] = el; }}
              className={`spg-item${isDragging ? " is-dragging" : ""}${isOver ? " is-over" : ""}`}
              style={{ order: orderIndex[String(pid)] }}
              onDragOver={(e) => {
                // Always preventDefault — without it, the drop event won't fire.
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                const from = dragIdRef.current;
                if (from !== null && from !== pid && overId !== pid) {
                  setOverId(pid);
                }
              }}
              onDragLeave={() => {
                if (overId === pid) setOverId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIdRef.current;
                setDragId(null);
                setOverId(null);
                if (from === null) return;
                commitReorder(from, pid);
              }}
            >
              <div
                role="button"
                tabIndex={0}
                aria-label="Glisser pour déplacer cette photo"
                title="Glisser pour déplacer"
                className="spg-handle"
                draggable
                onDragStart={(e) => {
                  setDragId(pid);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(pid));
                  const node = itemRefs.current[String(pid)];
                  if (node) {
                    e.dataTransfer.setDragImage(node, 40, 40);
                  }
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="9" cy="5" r="1.2" />
                  <circle cx="9" cy="12" r="1.2" />
                  <circle cx="9" cy="19" r="1.2" />
                  <circle cx="15" cy="5" r="1.2" />
                  <circle cx="15" cy="12" r="1.2" />
                  <circle cx="15" cy="19" r="1.2" />
                </svg>
              </div>

              {it.node}
            </div>
          );
        })}
      </div>

      <style>{`
        .spg-hint {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          color: var(--ink);
          padding: 14px 18px;
          background: linear-gradient(135deg, rgba(184, 151, 90, 0.14), rgba(184, 151, 90, 0.06));
          border: 1px solid rgba(184, 151, 90, 0.45);
          border-radius: 8px;
          margin: 22px 0 4px;
        }
        .spg-hint-icon {
          flex-shrink: 0;
          color: var(--gold);
          display: inline-flex;
          align-items: center;
          background: rgba(184, 151, 90, 0.15);
          padding: 6px;
          border-radius: 6px;
        }
        .spg-hint-text { flex: 1; line-height: 1.55; }
        .spg-hint-text strong { color: var(--gold-deep); font-weight: 600; }
        .spg-pill {
          flex-shrink: 0;
          padding: 5px 14px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.04em;
        }
        .spg-pill--saving { background: var(--cream-deep); color: var(--muted); }
        .spg-pill--ok { background: rgba(46, 61, 46, 0.12); color: var(--sage-deep); }
        .spg-pill--err { background: rgba(139, 46, 46, 0.12); color: #8B2E2E; }

        .spg-grid.is-pending { opacity: 0.9; }

        .spg-item {
          position: relative;
          transition: transform 160ms ease, opacity 160ms ease;
        }
        .spg-item.is-dragging {
          opacity: 0.35;
          transform: scale(0.97);
        }
        .spg-item.is-over::after {
          content: "";
          position: absolute;
          inset: -6px;
          border: 2px dashed var(--gold);
          border-radius: 8px;
          pointer-events: none;
          z-index: 5;
          animation: spgPulse 1.2s ease-in-out infinite;
        }
        @keyframes spgPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        .spg-handle {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 4;
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--gold);
          color: #FFFFFF;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          cursor: grab;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
          transition: background 120ms, transform 120ms, box-shadow 120ms;
          user-select: none;
          -webkit-user-drag: element;
        }
        .spg-handle:hover {
          background: var(--gold-deep);
          transform: scale(1.08);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
        }
        .spg-handle:active { cursor: grabbing; transform: scale(0.94); }
        .spg-handle:focus-visible {
          outline: 2px solid var(--forest);
          outline-offset: 3px;
        }
      `}</style>
    </>
  );
}
