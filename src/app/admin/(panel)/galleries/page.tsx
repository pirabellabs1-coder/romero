import Link from "next/link";
import { listGalleries } from "@/lib/content";
import { createGallery } from "./actions";

export const dynamic = "force-dynamic";

export default function GalleriesAdmin({ searchParams }: { searchParams: { ok?: string } }) {
  const galleries = listGalleries({ includeDrafts: true });

  return (
    <>
      <h1 className="admin-h1">Galeries</h1>
      <p className="admin-sub">Créez et gérez les galeries de mariages affichées sur le portfolio.</p>

      {searchParams.ok === "deleted" && <div className="admin-flash ok">Galerie supprimée.</div>}

      <div className="admin-card">
        <h2 className="serif" style={{ fontSize: 22, color: "var(--forest)", margin: "0 0 18px" }}>
          Nouvelle galerie
        </h2>
        <form action={createGallery}>
          <div className="admin-grid cols-2">
            <div>
              <label className="admin-label">Noms (ex : Anastasia &amp; Jordan)</label>
              <input className="admin-input" name="names" required />
            </div>
            <div>
              <label className="admin-label">Lieu</label>
              <input className="admin-input" name="place" placeholder="Èze, France" required />
            </div>
            <div>
              <label className="admin-label">Date</label>
              <input className="admin-input" name="date_label" placeholder="Septembre 2025" />
            </div>
            <div>
              <label className="admin-label">Région</label>
              <select className="admin-select" name="region" defaultValue="FRANCE">
                <option value="FRANCE">FRANCE</option>
                <option value="INTERNATIONAL">INTERNATIONAL</option>
              </select>
            </div>
            <div>
              <label className="admin-label">Type</label>
              <select className="admin-select" name="kind" defaultValue="INTIMISTE">
                <option value="INTIMISTE">INTIMISTE</option>
                <option value="INTERNATIONAL">INTERNATIONAL</option>
                <option value="GRAND">GRAND</option>
              </select>
            </div>
          </div>
          <button type="submit" className="admin-btn" style={{ marginTop: 22 }}>
            CRÉER &amp; AJOUTER DES PHOTOS
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2 className="serif" style={{ fontSize: 22, color: "var(--forest)", margin: "0 0 14px" }}>
          Toutes les galeries
        </h2>
        {galleries.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Aucune galerie pour le moment.</p>
        ) : (
          <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Couverture</th>
                <th>Noms</th>
                <th>Lieu</th>
                <th>Date</th>
                <th>Région</th>
                <th>Featured</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {galleries.map((g) => (
                <tr key={g.id}>
                  <td>
                    <div style={{ width: 56, height: 56, background: "var(--cream-deep)", overflow: "hidden", borderRadius: 4 }}>
                      {g.cover_filename ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/uploads/${g.cover_filename}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <Link href={`/admin/galleries/${g.id}`}>{g.names}</Link>
                  </td>
                  <td style={{ color: "var(--muted)" }}>{g.place}</td>
                  <td style={{ color: "var(--muted)" }}>{g.date_label}</td>
                  <td style={{ color: "var(--muted)" }}>{g.region}</td>
                  <td>{g.featured ? "⭐" : ""}</td>
                  <td style={{ color: g.published ? "var(--forest)" : "var(--muted)" }}>{g.published ? "Publiée" : "Brouillon"}</td>
                  <td>
                    <Link href={`/admin/galleries/${g.id}`} className="cap-tracked-sm gold">
                      MODIFIER →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
  );
}
