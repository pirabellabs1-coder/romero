import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { updatePost, deletePost } from "../actions";
import ConfirmDelete from "@/components/admin/ConfirmDelete";
import RichEditor from "@/components/admin/RichEditor";
import type { PostRow } from "@/lib/content";

export const dynamic = "force-dynamic";

export default function PostEdit({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string } }) {
  const id = Number(params.id);
  const p = getDb().prepare("SELECT * FROM posts WHERE id = ?").get(id) as PostRow | undefined;
  if (!p) notFound();

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

          <div style={{ marginTop: 22, display: "flex", gap: 30, alignItems: "center" }}>
            <div>
              <label className="admin-label">Image de couverture</label>
              {p.cover_filename && (
                <div style={{ width: 160, height: 100, marginBottom: 8, background: "var(--cream-deep)", overflow: "hidden", borderRadius: 4 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.cover_filename!.startsWith("http") ? p.cover_filename! : `/uploads/${p.cover_filename}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
              <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" />
            </div>
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
