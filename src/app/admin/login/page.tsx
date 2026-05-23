export const dynamic = "force-dynamic";

import Monogram from "@/components/Monogram";

export default function LoginPage({ searchParams }: { searchParams: { error?: string; from?: string } }) {
  const error = searchParams.error === "1";
  const from = searchParams.from ?? "/admin";
  return (
    <div className="login-shell">
      <div className="login-card">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <Monogram size={56} />
        </div>
        <h1
          className="serif"
          style={{
            textAlign: "center",
            fontSize: 22,
            color: "var(--forest)",
            margin: "8px 0 6px",
            fontWeight: 400,
            fontStyle: "italic",
          }}
        >
          Espace administrateur
        </h1>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12.5, margin: "0 0 30px" }}>
          Connectez-vous pour gérer le site.
        </p>
        {error && (
          <div className="admin-flash error" style={{ marginBottom: 14 }}>
            Identifiants invalides.
          </div>
        )}
        <form method="post" action="/api/auth/login">
          <input type="hidden" name="from" value={from} />
          <label className="admin-label" style={{ marginTop: 6 }}>EMAIL</label>
          <input className="admin-input" name="email" type="email" required autoFocus defaultValue="admin@romero.local" />
          <label className="admin-label" style={{ marginTop: 18 }}>MOT DE PASSE</label>
          <input className="admin-input" name="password" type="password" required />
          <button type="submit" className="admin-btn" style={{ marginTop: 26, width: "100%" }}>
            SE CONNECTER
          </button>
        </form>
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 11.5, marginTop: 24 }}>
          Identifiants par défaut : <b>admin@romero.local</b> / <b>admin</b> — à changer dans les paramètres.
        </p>
      </div>
    </div>
  );
}
