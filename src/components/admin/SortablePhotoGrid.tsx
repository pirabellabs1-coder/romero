"use client";
/**
 * Drag-and-drop wrapper for the gallery photo grid.
 *
 * Built on @dnd-kit/sortable so it works reliably across desktop
 * (mouse, trackpad) AND touch devices, with proper accessibility
 * (keyboard sortable via arrow keys), and without the HTML5 DnD
 * footguns (native image drag hijack, missing dataTransfer in
 * synthetic events, etc.).
 *
 * Each child is wrapped in <SortablePhotoItem id={photoId}>. The
 * grid extracts (id, children) from each, renders a SortableTile
 * around the original PhotoTile, and on drop commits the new
 * order via a bulk server action.
 */
import { Children, useState, useTransition, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ReorderAction = (
  galleryId: number,
  orderedIds: number[]
) => Promise<{ ok: true } | { ok: false; error: string }>;

/** Wraps each photo tile and carries the photo id used to compute order. */
export function SortablePhotoItem({
  id,
  children,
}: {
  id: number;
  children: ReactNode;
}) {
  // This is just a tagged carrier; the grid reads { id, children } from props
  // via React.Children, then renders a SortableTile around the children.
  return <>{children}</>;
}

type GridProps = {
  galleryId: number;
  reorderAction: ReorderAction;
  /** SortablePhotoItem elements — see above. */
  children: ReactNode;
};

type Item = { id: number; node: ReactNode };

export default function SortablePhotoGrid({
  galleryId,
  reorderAction,
  children,
}: GridProps) {
  // Extract { id, node } from every SortablePhotoItem child.
  const initial: Item[] = [];
  Children.forEach(children, (child) => {
    if (!child || typeof child !== "object" || !("props" in child)) return;
    const props = (child as React.ReactElement).props as { id?: number; children?: ReactNode };
    if (typeof props.id === "number") initial.push({ id: props.id, node: props.children });
  });

  const [items, setItems] = useState<Item[]>(initial);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "ok" }
    | { kind: "err"; msg: string }
  >({ kind: "idle" });

  const sensors = useSensors(
    // PointerSensor — mouse + trackpad on desktop. activationConstraint
    // ensures small click jitters don't trigger a drag (so the buttons
    // inside the tile still work normally).
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch — for tablets / phones. 200ms long-press to start.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    // Keyboard accessibility — Tab to focus a tile, Space/Enter then arrows.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function persist(next: Item[]) {
    setStatus({ kind: "saving" });
    start(async () => {
      const res = await reorderAction(galleryId, next.map((i) => i.id));
      if (res.ok) {
        setStatus({ kind: "ok" });
        setTimeout(() => setStatus({ kind: "idle" }), 2200);
      } else {
        setStatus({ kind: "err", msg: res.error });
      }
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === Number(active.id));
    const to = items.findIndex((i) => i.id === Number(over.id));
    if (from === -1 || to === -1) return;
    const next = arrayMove(items, from, to);
    setItems(next);
    persist(next);
  }

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
          <strong>Glisser-déposer&nbsp;:</strong> saisissez une photo par sa <strong>poignée dorée</strong> en haut à gauche, puis lâchez-la à la position voulue. Les flèches restent disponibles pour un ajustement fin.
        </span>
        {status.kind === "saving" && <span className="spg-pill spg-pill--saving">Enregistrement…</span>}
        {status.kind === "ok" && <span className="spg-pill spg-pill--ok">✓ Ordre enregistré</span>}
        {status.kind === "err" && <span className="spg-pill spg-pill--err">❌ {status.msg}</span>}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div
            className={`spg-grid${pending ? " is-pending" : ""}`}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 20,
              marginTop: 16,
            }}
          >
            {items.map((it) => (
              <SortableTile key={it.id} id={it.id}>
                {it.node}
              </SortableTile>
            ))}
          </div>
        </SortableContext>
      </DndContext>

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

        .spg-grid.is-pending { opacity: 0.92; }

        .spg-tile {
          position: relative;
          transition: transform 180ms cubic-bezier(0.2, 0, 0, 1), box-shadow 180ms;
          touch-action: manipulation;
        }
        .spg-tile.is-dragging {
          z-index: 50;
          box-shadow: 0 14px 38px rgba(0, 0, 0, 0.35);
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
          touch-action: none;
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

/**
 * Internal tile renderer: applies the @dnd-kit transform/transition + binds
 * the listeners to the gold handle only, so buttons/inputs inside PhotoTile
 * keep working normally.
 */
function SortableTile({ id, children }: { id: number; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={`spg-tile${isDragging ? " is-dragging" : ""}`}>
      <div
        className="spg-handle"
        role="button"
        tabIndex={0}
        aria-label="Glisser pour déplacer cette photo"
        title="Glisser pour déplacer"
        {...attributes}
        {...listeners}
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
      {children}
    </div>
  );
}
