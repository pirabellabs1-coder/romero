import { getCurrentUser } from "@/lib/auth";
import { changeEmailAction, changePasswordAction } from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, { type: "ok" | "error"; text: string }> = {
  email: { type: "ok", text: "Email mis à jour avec succès." },
  password: { type: "ok", text: "Mot de passe mis à jour avec succès." },
  invalid_email: { type: "error", text: "L'adresse email est invalide." },
  bad_email: { type: "error", text: "Mot de passe incorrect ou email déjà utilisé." },
  short: { type: "error", text: "Le nouveau mot de passe doit faire au moins 6 caractères." },
  mismatch: { type: "error", text: "Les deux mots de passe ne correspondent pas." },
  bad_password: { type: "error", text: "Mot de passe actuel incorrect." },
};

export default function AccountPage({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const u = getCurrentUser()!;
  const flashKey = searchParams.ok || searchParams.error;
  const flash = flashKey ? MESSAGES[flashKey] : null;

  return (
    <>
      <h1 className="admin-h1">Compte</h1>
      <p className="admin-sub">Modifiez votre email ou votre mot de passe.</p>

      {flash && <div className={`admin-flash ${flash.type}`}>{flash.text}</div>}

      <div className="admin-card">
        <h2 className="serif" style={{ fontSize: 22, color: "var(--forest)", margin: "0 0 18px" }}>Email</h2>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 16px" }}>Email actuel : <b>{u.email}</b></p>
        <form action={changeEmailAction}>
          <div className="admin-grid cols-2">
            <div>
              <label className="admin-label">Nouvel email</label>
              <input className="admin-input" type="email" name="new_email" required />
            </div>
            <div>
              <label className="admin-label">Mot de passe (pour confirmer)</label>
              <input className="admin-input" type="password" name="password" required />
            </div>
          </div>
          <button className="admin-btn" type="submit" style={{ marginTop: 18 }}>METTRE À JOUR L&apos;EMAIL</button>
        </form>
      </div>

      <div className="admin-card">
        <h2 className="serif" style={{ fontSize: 22, color: "var(--forest)", margin: "0 0 18px" }}>Mot de passe</h2>
        <form action={changePasswordAction}>
          <div className="admin-grid cols-3">
            <div>
              <label className="admin-label">Mot de passe actuel</label>
              <input className="admin-input" type="password" name="old_password" required />
            </div>
            <div>
              <label className="admin-label">Nouveau mot de passe</label>
              <input className="admin-input" type="password" name="new_password" minLength={6} required />
            </div>
            <div>
              <label className="admin-label">Confirmer</label>
              <input className="admin-input" type="password" name="confirm_password" minLength={6} required />
            </div>
          </div>
          <button className="admin-btn" type="submit" style={{ marginTop: 18 }}>METTRE À JOUR LE MOT DE PASSE</button>
        </form>
      </div>
    </>
  );
}
