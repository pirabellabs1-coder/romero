export const dynamic = "force-dynamic";

import Monogram from "@/components/Monogram";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; from?: string };
}) {
  const rawError = searchParams.error ?? "";
  const legacyError = rawError === "1";
  const ratelimited = rawError === "ratelimit";
  // Erreurs textuelles renvoyées par le flow SSO (Google, etc.)
  const ssoError =
    rawError && rawError !== "1" && rawError !== "ratelimit"
      ? decodeURIComponent(rawError)
      : null;
  const from = searchParams.from ?? "/admin";
  const googleSigninHref = `/api/auth/google/signin/start?from=${encodeURIComponent(
    from
  )}`;

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
        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12.5, margin: "0 0 24px" }}>
          Connectez-vous pour gérer le site.
        </p>

        {legacyError && (
          <div className="admin-flash error" style={{ marginBottom: 14 }}>
            Identifiants invalides.
          </div>
        )}
        {ratelimited && (
          <div className="admin-flash error" style={{ marginBottom: 14 }}>
            Trop de tentatives. Réessayez dans quelques minutes.
          </div>
        )}
        {ssoError && (
          <div className="admin-flash error" style={{ marginBottom: 14 }}>
            {ssoError}
          </div>
        )}

        {/* SSO Google — méthode recommandée */}
        <a
          href={googleSigninHref}
          className="admin-btn"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            textDecoration: "none",
            background: "#fff",
            color: "#3c4043",
            border: "1px solid #dadce0",
            fontWeight: 500,
            letterSpacing: "0.01em",
            padding: "12px 20px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
          Se connecter avec Google
        </a>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: "22px 0 18px",
            color: "var(--muted)",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
          <span>ou avec mot de passe</span>
          <span style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.08)" }} />
        </div>

        <form method="post" action="/api/auth/login">
          <input type="hidden" name="from" value={from} />
          <label className="admin-label" style={{ marginTop: 6 }}>EMAIL</label>
          <input className="admin-input" name="email" type="email" required defaultValue="admin@romero.local" />
          <label className="admin-label" style={{ marginTop: 18 }}>MOT DE PASSE</label>
          <input className="admin-input" name="password" type="password" required />
          <button type="submit" className="admin-btn" style={{ marginTop: 22, width: "100%" }}>
            SE CONNECTER
          </button>
        </form>

        <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 11.5, marginTop: 22 }}>
          Recommandé : <b>Se connecter avec Google</b> — pas de mot de passe à retenir.
        </p>
      </div>
    </div>
  );
}
