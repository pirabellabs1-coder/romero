import Link from "next/link";
import { listPosts } from "@/lib/content";
import { createPost } from "./actions";

export const dynamic = "force-dynamic";

export default function PostsAdmin({ searchParams }: { searchParams: { ok?: string } }) {
  const posts = listPosts({ includeDrafts: true });

  return (
    <>
      <h1 className="admin-h1">Journal</h1>
      <p className="admin-sub">Articles publiés sur le blog du site.</p>

      {searchParams.ok === "deleted" && <div className="admin-flash ok">Article supprimé.</div>}

      <div className="admin-card">
        <h2 className="serif" style={{ fontSize: 22, color: "var(--forest)", margin: "0 0 18px" }}>
          Nouvel article
        </h2>
        <form action={createPost}>
          <div className="admin-grid cols-2">
            <div>
              <label className="admin-label">Titre (FR)</label>
              <input className="admin-input" name="title_fr" required />
            </div>
            <div>
              <label className="admin-label">Catégorie</label>
              <select className="admin-select" name="category" defaultValue="MARIAGES">
                <option>MARIAGES</option>
                <option>LIEUX</option>
                <option>CONSEILS</option>
              </select>
            </div>
            <div>
              <label className="admin-label">Date de publication</label>
              <input className="admin-input" name="published_at" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <label className="admin-label">Temps de lecture (min)</label>
              <input className="admin-input" name="read_minutes" type="number" min={1} defaultValue={5} />
            </div>
          </div>
          <button type="submit" className="admin-btn" style={{ marginTop: 22 }}>
            CRÉER &amp; MODIFIER
          </button>
        </form>
      </div>

      <div className="admin-card">
        <h2 className="serif" style={{ fontSize: 22, color: "var(--forest)", margin: "0 0 14px" }}>
          Articles
        </h2>
        {posts.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Aucun article.</p>
        ) : (
          <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Titre</th>
                <th>Catégorie</th>
                <th>Date</th>
                <th>Statut</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/posts/${p.id}`}>{p.title_fr}</Link>
                  </td>
                  <td style={{ color: "var(--muted)" }}>{p.category}</td>
                  <td style={{ color: "var(--muted)" }}>{p.published_at}</td>
                  <td>{p.published ? "Publié" : "Brouillon"}</td>
                  <td>
                    <Link href={`/admin/posts/${p.id}`} className="cap-tracked-sm gold">
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
