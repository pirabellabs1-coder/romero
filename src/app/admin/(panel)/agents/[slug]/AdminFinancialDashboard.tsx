import type { FinancialSnapshot } from "../admin-crm-actions";

type Props = { snapshot: FinancialSnapshot };

/**
 * Encart financier au-dessus des sous-onglets de l'agent admin.
 * Affiche : CA du mois, CA de l'année, factures en attente, retards,
 * contrats/devis en attente de signature, activité 30 j.
 *
 * Volontairement compact : c'est un rappel de gestion, pas un rapport
 * comptable complet.
 */
export default function AdminFinancialDashboard({ snapshot }: Props) {
  const eur = (cents: number) =>
    (cents / 100).toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

  const overdue = snapshot.invoices_overdue_cents;
  const pending = snapshot.invoices_pending_cents;

  return (
    <section
      className="agent-panel"
      style={{
        marginBottom: 22,
        background: "linear-gradient(180deg, #26332A 0%, #1F2A22 100%)",
        border: "1px solid rgba(184, 151, 90, 0.28)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Dashboard financier</h2>
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--gold-light, #D4B57A)",
          }}
        >
          Rafraîchi à l'ouverture
        </span>
      </div>

      {/* Chiffre d'affaires */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            background: "rgba(157, 206, 157, 0.10)",
            border: "1px solid rgba(157, 206, 157, 0.28)",
            borderRadius: 6,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              color: "rgba(244,239,227,0.6)",
              marginBottom: 6,
            }}
          >
            CA du mois en cours
          </div>
          <div
            style={{
              fontFamily: "var(--serif, Georgia, serif)",
              fontStyle: "italic",
              fontSize: 34,
              color: "#9DCE9D",
              lineHeight: 1,
            }}
          >
            {eur(snapshot.ca_month_cents)} <span style={{ fontSize: 18 }}>€</span>
          </div>
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
            Uniquement les factures marquées payées
          </div>
        </div>

        <div
          style={{
            padding: "18px 20px",
            background: "rgba(184, 151, 90, 0.10)",
            border: "1px solid rgba(184, 151, 90, 0.32)",
            borderRadius: 6,
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              color: "rgba(244,239,227,0.6)",
              marginBottom: 6,
            }}
          >
            CA cumulé année
          </div>
          <div
            style={{
              fontFamily: "var(--serif, Georgia, serif)",
              fontStyle: "italic",
              fontSize: 34,
              color: "var(--gold-light, #D4B57A)",
              lineHeight: 1,
            }}
          >
            {eur(snapshot.ca_year_cents)} <span style={{ fontSize: 18 }}>€</span>
          </div>
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
            Depuis le 1er janvier
          </div>
        </div>
      </div>

      {/* En attente / retards / activité */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        <StatCell
          label="Factures en attente"
          value={`${eur(pending)} €`}
          accent="default"
        />
        <StatCell
          label="Retards de paiement"
          value={`${eur(overdue)} €`}
          accent={overdue > 0 ? "err" : "muted"}
          alert={overdue > 0}
        />
        <StatCell
          label="Contrats à signer"
          value={String(snapshot.contracts_pending_signature)}
          accent={snapshot.contracts_pending_signature > 0 ? "warn" : "muted"}
        />
        <StatCell
          label="Devis en attente"
          value={String(snapshot.quotes_pending)}
          accent="default"
        />
        <StatCell
          label="Devis expirés (30j)"
          value={String(snapshot.quotes_expired_last_30d)}
          accent="muted"
        />
        <StatCell
          label="Payées (30j)"
          value={String(snapshot.invoices_paid_last_30d)}
          accent="ok"
        />
      </div>
    </section>
  );
}

function StatCell({
  label,
  value,
  accent,
  alert,
}: {
  label: string;
  value: string;
  accent: "ok" | "warn" | "err" | "muted" | "default";
  alert?: boolean;
}) {
  const color =
    accent === "ok"
      ? "#9DCE9D"
      : accent === "warn"
      ? "#E0B96A"
      : accent === "err"
      ? "#E48A8A"
      : accent === "muted"
      ? "rgba(244,239,227,0.55)"
      : "var(--gold-light, #D4B57A)";
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "rgba(0,0,0,0.20)",
        border: `1px solid ${alert ? "rgba(228,138,138,0.5)" : "rgba(184,151,90,0.20)"}`,
        borderRadius: 4,
      }}
    >
      <div
        style={{
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(244,239,227,0.55)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--serif, Georgia, serif)",
          fontStyle: "italic",
          fontSize: 20,
          color,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}
