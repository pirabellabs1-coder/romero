import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { updatePost, deletePost } from "../actions";
import ConfirmDelete from "@/components/admin/ConfirmDelete";
import RichEditor from "@/components/admin/RichEditor";
import CoverPicker from "@/components/admin/CoverPicker";
import type { PostRow } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function PostEdit({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string } }) {
  const id = Number(params.id);
  const p = await queryOne<PostRow>("SELECT * FROM posts WHERE id = $1", [id]);
  if (!p) notFound();

  // Fetch every photo from every published gallery so the CoverPicker can
  // offer them in a single modal. Reasonable volume (~100s of photos) for an
  // admin-only screen — no pagination needed.
  const photoRows = await query<{
    id: number; gallery_id: number; filename: string;
    gallery_names: string; gallery_place: string;
  }>(
    `SELECT p.id, p.gallery_id, p.filename, g.names AS gallery_names, g.place AS gallery_place
     FROM photos p
     JOIN galleries g ON g.id = p.gallery_id
     WHERE g.published = 1 AND p.filename != 'hero.jpg'
     ORDER BY g.sort_order ASC, p.sort_order ASC, p.id ASC`
  );
  // Group by gallery for the picker UI.
  const galleryMap = new Map<number, { id: number; names: string; place: string; photos: Array<{ id: number; gallery_id: number; filename: string }> }>();
  for (const r of photoRows) {
    if (!galleryMap.has(r.gallery_id)) {
      galleryMap.set(r.gallery_id, { id: r.gallery_id, names: r.gallery_names, place: r.gallery_place, photos: [] });
    }
    galleryMap.get(r.gallery_id)!.photos.push({ id: r.id, gallery_id: r.gallery_id, filename: r.filename });
  }
  const galleriesWithPhotos = Array.from(galleryMap.values());

  const onUpdate = updatePost.bind(null, id);
  const onDelete = deletePost.bind(null, id);

  return (
    <>
      <Link href="/admin/posts" className="cap-tracked-sm gold">← TOUS LES ARTICLES</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>{p.title_fr}</h1>
      <p className="admin-sub">/{p.slug}</p>

      {searchParams.ok === "saved" && <div className="admin-flash ok">Article enregistré.</div>}

      <div className="admin-card">
        <form action={onUpdate}>
          <div className="admin-grid cols-2">
            <div>
              <label className="admin-label">Titre (FR)</label>
              <input className="admin-input" name="title_fr" defaultValue={p.title_fr} required />
            </div>
            <div>
              <label className="admin-label">Titre (EN)</label>
              <input className="admin-input" name="title_en" defaultValue={p.title_en} />
            </div>
            <div>
              <label className="admin-label">Catégorie</label>
              <select className="admin-select" name="category" defaultValue={p.category}>
                <option>MARIAGES</option>
                <option>LIEUX</option>
                <option>CONSEILS</option>
              </select>
            </div>
            <div>
              <label className="admin-label">Date</label>
              <input className="admin-input" type="date" name="published_at" defaultValue={p.published_at} />
            </div>
            <div>
              <label className="admin-label">Temps de lecture (min)</label>
              <input className="admin-input" type="number" min={1} name="read_minutes" defaultValue={p.read_minutes} />
            </div>
            <div>
              <label className="admin-label">Ordre</label>
              <input className="admin-input" type="number" name="sort_order" defaultValue={p.sort_order} />
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <label className="admin-label">Extrait (FR)</label>
            <textarea className="admin-textarea" name="excerpt_fr" defaultValue={p.excerpt_fr} />
          </div>
          <div style={{ marginTop: 18 }}>
            <label className="admin-label">Extrait (EN)</label>
            <textarea className="admin-textarea" name="excerpt_en" defaultValue={p.excerpt_en} />
          </div>
          <div style={{ marginTop: 18 }}>
            <label className="admin-label">Corps (FR)</label>
            <RichEditor name="body_fr" defaultValue={p.body_fr} placeholder="Écrivez votre article…" />
          </div>
          <div style={{ marginTop: 18 }}>
            <label className="admin-label">Corps (EN)</label>
            <RichEditor name="body_en" defaultValue={p.body_en} placeholder="Write your article…" />
          </div>

          <div style={{ marginTop: 28 }}>
            <label className="admin-label" style={{ marginBottom: 12, display: "block" }}>
              Image de couverture
            </label>
            <CoverPicker
              postId={id}
              currentCover={p.cover_filename}
              currentPosition={p.cover_position || "center center"}
              galleries={galleriesWithPhotos}
            />
          </div>

          <div style={{ marginTop: 22 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
              <input type="checkbox" name="published" defaultChecked={!!p.published} /> Publié
            </label>
          </div>

          <div style={{ marginTop: 24 }}>
            <button className="admin-btn" type="submit">ENREGISTRER</button>
          </div>
        </form>
      </div>

      <div className="admin-card" style={{ borderColor: "#E3C5C5" }}>
        <h2 className="serif" style={{ fontSize: 18, color: "#8B2E2E", margin: "0 0 10px" }}>Zone dangereuse</h2>
        <ConfirmDelete action={onDelete} label="SUPPRIMER L'ARTICLE" confirmText={`Supprimer définitivement « ${p.title_fr} » ?`} />
      </div>
    </>
  );
}
