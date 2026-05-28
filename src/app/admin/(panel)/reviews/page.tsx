import { listReviews } from "@/lib/content";
import { createReview, updateReview, deleteReview } from "./actions";

export const dynamic = "force-dynamic";

export default async function ReviewsAdmin() {
  const reviews = await listReviews({ includeHidden: true });

  return (
    <>
      <h1 className="admin-h1">Avis</h1>
      <p className="admin-sub">Témoignages affichés sur la page Avis.</p>

      <div className="admin-card">
        <h2 className="serif" style={{ fontSize: 22, color: "var(--forest)", margin: "0 0 18px" }}>Nouvel avis</h2>
        <form action={createReview}>
          <div className="admin-grid cols-2">
            <div>
              <label className="admin-label">Nom</label>
              <input className="admin-input" name="name" required />
            </div>
            <div>
              <label className="admin-label">Date (libellé)</label>
              <input className="admin-input" name="date_label" placeholder="il y a 2 mois" />
            </div>
            <div>
              <label className="admin-label">Note (1-5)</label>
              <input className="admin-input" type="number" min={1} max={5} name="rating" defaultValue={5} />
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <label className="admin-label">Texte (FR)</label>
            <textarea className="admin-textarea" name="text_fr" required />
          </div>
          <div style={{ marginTop: 18 }}>
            <label className="admin-label">Texte (EN)</label>
            <textarea className="admin-textarea" name="text_en" />
          </div>
          <button type="submit" className="admin-btn" style={{ marginTop: 22 }}>AJOUTER</button>
        </form>
      </div>

      {reviews.map((r) => {
        const onUpdate = updateReview.bind(null, r.id);
        const onDelete = deleteReview.bind(null, r.id);
        return (
          <div className="admin-card" key={r.id}>
            <form action={onUpdate}>
              <div className="admin-grid cols-3">
                <div>
                  <label className="admin-label">Nom</label>
                  <input className="admin-input" name="name" defaultValue={r.name} />
                </div>
                <div>
                  <label className="admin-label">Date</label>
                  <input className="admin-input" name="date_label" defaultValue={r.date_label} />
                </div>
                <div>
                  <label className="admin-label">Note</label>
                  <input className="admin-input" type="number" min={1} max={5} name="rating" defaultValue={r.rating} />
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <label className="admin-label">Texte (FR)</label>
                <textarea className="admin-textarea" name="text_fr" defaultValue={r.text_fr} />
              </div>
              <div style={{ marginTop: 14 }}>
                <label className="admin-label">Texte (EN)</label>
                <textarea className="admin-textarea" name="text_en" defaultValue={r.text_en} />
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 16, alignItems: "center" }}>
                <label style={{ fontSize: 12.5 }}>
                  <span className="admin-label" style={{ display: "inline" }}>Ordre</span>
                  <input className="admin-input" type="number" name="sort_order" defaultValue={r.sort_order} style={{ width: 80, marginLeft: 8 }} />
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
                  <input type="checkbox" name="published" defaultChecked={!!r.published} /> Publié
                </label>
              </div>
              <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
                <button className="admin-btn" type="submit">ENREGISTRER</button>
              </div>
            </form>
            <form action={onDelete} style={{ marginTop: 14 }}>
              <button className="admin-btn danger" type="submit">Supprimer</button>
            </form>
          </div>
        );
      })}
    </>
  );
}
