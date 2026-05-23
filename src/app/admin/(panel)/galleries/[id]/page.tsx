import Link from "next/link";
import { notFound } from "next/navigation";
import { getGalleryById, listPhotosForGallery } from "@/lib/content";
import PhotoTile from "@/components/admin/PhotoTile";
import UploadDropzone from "@/components/admin/UploadDropzone";
import ConfirmDelete from "@/components/admin/ConfirmDelete";
import {
  updateGallery, deleteGallery, uploadPhoto,
  setCover, deletePhoto, updatePhotoSpan, updatePhotoAlt, movePhoto,
} from "../actions";

export const dynamic = "force-dynamic";

const FLASH: Record<string, { type: "ok" | "error"; text: string }> = {
  saved: { type: "ok", text: "Modifications enregistrées." },
  uploaded: { type: "ok", text: "Photos ajoutées avec succès." },
};

export default function GalleryEdit({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ok?: string };
}) {
  const id = Number(params.id);
  const g = getGalleryById(id);
  if (!g) notFound();
  const photos = listPhotosForGallery(id);

  const onUpdate = updateGallery.bind(null, id);
  const onDelete = deleteGallery.bind(null, id);
  const onUpload = uploadPhoto.bind(null, id);
  const flash = searchParams.ok ? FLASH[searchParams.ok] : null;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 14 }}>
        <div>
          <Link href="/admin/galleries" className="cap-tracked-sm gold">
            ← TOUTES LES GALERIES
          </Link>
          <h1 className="admin-h1" style={{ marginTop: 10 }}>{g.names}</h1>
          <p className="admin-sub">
            {g.place} · {g.date_label}
          </p>
        </div>
        <Link href={`/portfolio/${g.slug}`} target="_blank" className="admin-btn ghost">
          VOIR EN LIGNE ↗
        </Link>
      </div>

      {flash && <div className={`admin-flash ${flash.type}`}>{flash.text}</div>}

      <div className="admin-card">
        <h2 className="serif" style={{ fontSize: 22, color: "var(--forest)", margin: "0 0 18px" }}>
          Informations
        </h2>
        <form action={onUpdate}>
          <div className="admin-grid cols-2">
            <div>
              <label className="admin-label">Noms</label>
              <input className="admin-input" name="names" defaultValue={g.names} required />
            </div>
            <div>
              <label className="admin-label">Lieu</label>
              <input className="admin-input" name="place" defaultValue={g.place} required />
            </div>
            <div>
              <label className="admin-label">Date (libellé)</label>
              <input className="admin-input" name="date_label" defaultValue={g.date_label} />
            </div>
            <div>
              <label className="admin-label">Région</label>
              <select className="admin-select" name="region" defaultValue={g.region}>
                <option>FRANCE</option>
                <option>INTERNATIONAL</option>
              </select>
            </div>
            <div>
              <label className="admin-label">Type</label>
              <select className="admin-select" name="kind" defaultValue={g.kind}>
                <option>INTIMISTE</option>
                <option>INTERNATIONAL</option>
                <option>GRAND</option>
              </select>
            </div>
            <div>
              <label className="admin-label">Ordre d&apos;affichage</label>
              <input className="admin-input" type="number" name="sort_order" defaultValue={g.sort_order} />
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <label className="admin-label">Texte de présentation (FR)</label>
            <textarea className="admin-textarea" name="intro_fr" defaultValue={g.intro_fr} />
          </div>
          <div style={{ marginTop: 18 }}>
            <label className="admin-label">Texte de présentation (EN)</label>
            <textarea className="admin-textarea" name="intro_en" defaultValue={g.intro_en} />
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 18, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
              <input type="checkbox" name="featured" defaultChecked={!!g.featured} /> Mise en avant (accueil)
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
              <input type="checkbox" name="published" defaultChecked={!!g.published} /> Publiée
            </label>
          </div>
          <div style={{ marginTop: 24 }}>
            <button className="admin-btn" type="submit">
              ENREGISTRER
            </button>
          </div>
        </form>
      </div>

      <div className="admin-card">
        <h2 className="serif" style={{ fontSize: 22, color: "var(--forest)", margin: "0 0 18px" }}>
          Photos <span style={{ color: "var(--muted)", fontSize: 14 }}>· {photos.length}</span>
        </h2>

        <UploadDropzone action={onUpload} />

        {photos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14, marginTop: 26 }}>
            {photos.map((p, i) => (
              <PhotoTile
                key={p.id}
                id={p.id}
                filename={p.filename}
                alt={p.alt}
                span={p.span}
                isCover={g.cover_photo_id === p.id}
                isFirst={i === 0}
                isLast={i === photos.length - 1}
                onSetCover={setCover.bind(null, id, p.id)}
                onDelete={deletePhoto.bind(null, p.id)}
                onSpanChange={async (span: string) => {
                  "use server";
                  await updatePhotoSpan(p.id, span);
                }}
                onAltChange={async (alt: string) => {
                  "use server";
                  await updatePhotoAlt(p.id, alt);
                }}
                onMoveUp={async () => {
                  "use server";
                  await movePhoto(p.id, "up");
                }}
                onMoveDown={async () => {
                  "use server";
                  await movePhoto(p.id, "down");
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="admin-card" style={{ borderColor: "#E3C5C5" }}>
        <h2 className="serif" style={{ fontSize: 18, color: "#8B2E2E", margin: "0 0 10px" }}>
          Zone dangereuse
        </h2>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 14px" }}>
          Supprimer la galerie supprime également toutes ses photos. Cette action est irréversible.
        </p>
        <ConfirmDelete action={onDelete} label="SUPPRIMER LA GALERIE" confirmText={`Supprimer définitivement « ${g.names} » et ses ${photos.length} photo(s) ?`} />
      </div>
    </>
  );
}
