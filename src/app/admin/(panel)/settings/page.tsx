import { getSettings } from "@/lib/settings";
import { updateContactSettings } from "./actions";

export const dynamic = "force-dynamic";

export default function SettingsAdmin({ searchParams }: { searchParams: { ok?: string } }) {
  const s = getSettings();
  return (
    <>
      <h1 className="admin-h1">Paramètres</h1>
      <p className="admin-sub">Informations de contact affichées sur le site et dans le footer.</p>

      {searchParams.ok && <div className="admin-flash ok">Paramètres enregistrés.</div>}

      <div className="admin-card">
        <form action={updateContactSettings}>
          <div className="admin-grid cols-2">
            <div>
              <label className="admin-label">Ville</label>
              <input className="admin-input" name="contact_city" defaultValue={s.contact_city} />
            </div>
            <div>
              <label className="admin-label">Téléphone</label>
              <input className="admin-input" name="contact_phone" defaultValue={s.contact_phone} />
            </div>
            <div>
              <label className="admin-label">Email</label>
              <input className="admin-input" name="contact_email" defaultValue={s.contact_email} />
            </div>
            <div>
              <label className="admin-label">Instagram (handle)</label>
              <input
                className="admin-input"
                name="instagram_handle"
                defaultValue={s.instagram_handle}
                placeholder="@romeromomentsphoto"
              />
            </div>
            <div>
              <label className="admin-label">Instagram (URL complète)</label>
              <input
                className="admin-input"
                name="instagram_url"
                defaultValue={s.instagram_url}
                placeholder="https://www.instagram.com/romeromomentsphoto"
              />
            </div>
            <div>
              <label className="admin-label">Lien Google (fiche avis)</label>
              <input
                className="admin-input"
                name="google_reviews_url"
                defaultValue={s.google_reviews_url}
                placeholder="https://share.google/..."
              />
            </div>
          </div>
          <button className="admin-btn" type="submit" style={{ marginTop: 22 }}>
            ENREGISTRER
          </button>
        </form>
      </div>
    </>
  );
}
