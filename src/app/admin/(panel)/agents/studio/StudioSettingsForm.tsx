"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { STUDIO_SETTINGS_FIELDS } from "@/lib/studio-settings-fields";
import { saveStudioSettingsAction } from "./actions";

type Connections = {
  instagram: { connected: boolean; label?: string };
  google: { connected: boolean; label?: string };
};

type Props = {
  initial: Record<string, string>;
  connections: Connections;
};

const SECTIONS = [
  {
    key: "legal",
    title: "Ton entreprise",
    desc: "Colle ton SIRET et clique « Récupérer » — tout se remplit tout seul depuis l'INSEE.",
  },
  {
    key: "contact",
    title: "Tes coordonnées",
    desc: "Où joindre le studio, et où recevoir les nouveaux contacts.",
  },
] as const;

export default function StudioSettingsForm({ initial, connections }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  // Etat contrôlé UNIQUEMENT pour les champs auto-remplissables via
  // Sirene. Les autres restent uncontrolled (defaultValue) pour rester
  // rapides et simples.
  const [siret, setSiret] = useState(initial.siret ?? "");
  const [legalName, setLegalName] = useState(initial.legal_name ?? "");
  const [legalStatus, setLegalStatus] = useState(initial.legal_status ?? "");
  const [legalAddress, setLegalAddress] = useState(initial.legal_address ?? "");
  const [rcsCity, setRcsCity] = useState(initial.rcs_city ?? "");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  async function onLookup() {
    setLookupMsg(null);
    const clean = siret.replace(/\s+/g, "");
    if (!/^\d{14}$/.test(clean)) {
      setLookupMsg({ ok: false, msg: "SIRET invalide (14 chiffres attendus)." });
      return;
    }
    setLookupBusy(true);
    try {
      const res = await fetch(`/api/admin/sirene-lookup?siret=${clean}`);
      const json = (await res.json()) as
        | { ok: true; data: { legal_name: string; legal_status: string; legal_address: string; rcs_city: string; siret: string } }
        | { ok: false; error: string };
      if (!json.ok) {
        setLookupMsg({ ok: false, msg: json.error });
      } else {
        setSiret(json.data.siret);
        setLegalName(json.data.legal_name);
        setLegalStatus(json.data.legal_status);
        setLegalAddress(json.data.legal_address);
        setRcsCity(json.data.rcs_city);
        setLookupMsg({
          ok: true,
          msg: `Trouvé : ${json.data.legal_name}. Vérifie et enregistre.`,
        });
      }
    } catch (e) {
      setLookupMsg({
        ok: false,
        msg: e instanceof Error ? e.message : "Erreur réseau.",
      });
    } finally {
      setLookupBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveStudioSettingsAction(fd);
      if (res.ok) {
        setFlash({ ok: true, msg: "Enregistré. Tous tes agents utilisent maintenant ces infos." });
        router.refresh();
      } else {
        setFlash({ ok: false, msg: res.error });
      }
    });
  }

  return (
    <form onSubmit={onSubmit}>
      {flash ? (
        <div className={`agent-flash agent-flash--${flash.ok ? "ok" : "err"}`} style={{ marginBottom: 18 }}>
          {flash.ok ? "✓" : "✗"} {flash.msg}
        </div>
      ) : null}

      {/* ─── Connexions (Instagram + Google) en tête ─────────────────── */}
      <div className="agent-panel" style={{ marginBottom: 22 }}>
        <h2>Tes comptes connectés</h2>
        <p style={{ marginTop: -6, marginBottom: 18, opacity: 0.75 }}>
          Un simple clic — pas besoin de coller des tokens ou identifiants techniques.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <ConnectionCard
            title="Instagram"
            desc="Pour que l'agent Marketing publie tes carrousels et stories."
            connected={connections.instagram.connected}
            label={connections.instagram.label}
            connectHref="/api/auth/instagram/start"
          />
          <ConnectionCard
            title="Google Agenda"
            desc="Pour que l'agent WhatsApp crée tes RDV et vérifie tes créneaux libres."
            connected={connections.google.connected}
            label={connections.google.label}
            connectHref="/api/auth/google/start"
          />
        </div>
      </div>

      {/* ─── Ton entreprise (avec SIRET auto-lookup) ───────────────────── */}
      <div className="agent-panel" style={{ marginBottom: 22 }}>
        <h2>Ton entreprise</h2>
        <p style={{ marginTop: -6, marginBottom: 18, opacity: 0.75 }}>
          Utilisé sur tes factures, devis et contrats. Colle ton SIRET puis clique « Récupérer ».
        </p>

        {/* SIRET + bouton lookup */}
        <div className="agent-form-field">
          <label htmlFor="ss-siret">SIRET</label>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <input
              id="ss-siret"
              name="siret"
              type="text"
              value={siret}
              onChange={(e) => setSiret(e.target.value)}
              placeholder="14 chiffres — ex : 12345678900012"
              autoComplete="off"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="agent-btn"
              onClick={onLookup}
              disabled={lookupBusy}
              style={{ whiteSpace: "nowrap" }}
            >
              {lookupBusy ? "Recherche…" : "🔍 Récupérer"}
            </button>
          </div>
          <span className="agent-form-field__help">
            14 chiffres — sur tes factures et papiers URSSAF. Clique « Récupérer » pour tout auto-remplir.
          </span>
          {lookupMsg ? (
            <div
              className={`agent-flash agent-flash--${lookupMsg.ok ? "ok" : "err"}`}
              style={{ marginTop: 8, fontSize: 13 }}
            >
              {lookupMsg.ok ? "✓" : "✗"} {lookupMsg.msg}
            </div>
          ) : null}
        </div>

        {/* Champs auto-remplissables */}
        <div className="agent-form-field">
          <label htmlFor="ss-legal_status">Statut juridique</label>
          <input
            id="ss-legal_status"
            name="legal_status"
            type="text"
            value={legalStatus}
            onChange={(e) => setLegalStatus(e.target.value)}
            placeholder="Micro-entrepreneur / EURL / SASU…"
            autoComplete="off"
          />
        </div>

        <div className="agent-form-field">
          <label htmlFor="ss-legal_name">Nom légal complet</label>
          <input
            id="ss-legal_name"
            name="legal_name"
            type="text"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Ton nom officiel"
            autoComplete="off"
          />
        </div>

        <div className="agent-form-field">
          <label htmlFor="ss-legal_address">Adresse professionnelle</label>
          <textarea
            id="ss-legal_address"
            name="legal_address"
            rows={3}
            value={legalAddress}
            onChange={(e) => setLegalAddress(e.target.value)}
            placeholder="Rue, code postal, ville"
          />
        </div>

        <div className="agent-form-field">
          <label htmlFor="ss-rcs_city">Ville d'immatriculation RCS</label>
          <input
            id="ss-rcs_city"
            name="rcs_city"
            type="text"
            value={rcsCity}
            onChange={(e) => setRcsCity(e.target.value)}
            placeholder="Ex : Nice (vide si micro-entrepreneur)"
            autoComplete="off"
          />
        </div>

        {/* TVA — pas auto-rempli, dépend du régime */}
        {STUDIO_SETTINGS_FIELDS.filter((f) => f.key === "vat_applicable" || f.key === "vat_number").map((f) => (
          <div key={f.key} className="agent-form-field">
            <label htmlFor={`ss-${f.key}`}>{f.label}</label>
            <input
              id={`ss-${f.key}`}
              name={f.key}
              type="text"
              defaultValue={initial[f.key] ?? ""}
              placeholder={initial[f.key] ? "" : "(non renseigné)"}
              autoComplete="off"
            />
            {f.help ? <span className="agent-form-field__help">{f.help}</span> : null}
          </div>
        ))}
      </div>

      {/* ─── Contact ──────────────────────────────────────────────────── */}
      <div className="agent-panel" style={{ marginBottom: 22 }}>
        <h2>{SECTIONS[1].title}</h2>
        <p style={{ marginTop: -6, marginBottom: 18, opacity: 0.75 }}>{SECTIONS[1].desc}</p>
        {STUDIO_SETTINGS_FIELDS.filter((f) => f.section === "contact").map((f) => (
          <div key={f.key} className="agent-form-field">
            <label htmlFor={`ss-${f.key}`}>{f.label}</label>
            <input
              id={`ss-${f.key}`}
              name={f.key}
              type="text"
              defaultValue={initial[f.key] ?? ""}
              placeholder={initial[f.key] ? "" : "(non renseigné)"}
              autoComplete="off"
            />
            {f.help ? <span className="agent-form-field__help">{f.help}</span> : null}
          </div>
        ))}
      </div>

      <div
        className="agent-actions"
        style={{
          position: "sticky",
          bottom: 0,
          background: "linear-gradient(0deg, rgba(46,61,46,0.95), rgba(46,61,46,0.6))",
          paddingBottom: 16,
          paddingTop: 20,
          marginTop: 30,
        }}
      >
        <button type="submit" className="agent-btn agent-btn--primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <span style={{ fontSize: 12, color: "rgba(244,239,227,0.55)", marginLeft: 8 }}>
          Les 4 agents utiliseront ces infos automatiquement.
        </span>
      </div>
    </form>
  );
}

// ─── Carte de connexion OAuth ────────────────────────────────────────
function ConnectionCard({
  title,
  desc,
  connected,
  label,
  connectHref,
}: {
  title: string;
  desc: string;
  connected: boolean;
  label?: string;
  connectHref: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${connected ? "rgba(157,206,157,0.4)" : "rgba(184,151,90,0.25)"}`,
        borderRadius: 6,
        padding: 16,
        background: connected ? "rgba(157,206,157,0.05)" : "rgba(184,151,90,0.03)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <strong style={{ fontSize: 15, letterSpacing: "0.02em" }}>{title}</strong>
        <span
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            padding: "3px 8px",
            border: `1px solid ${connected ? "#9DCE9D" : "rgba(184,151,90,0.35)"}`,
            color: connected ? "#9DCE9D" : "rgba(184,151,90,0.7)",
            borderRadius: 3,
          }}
        >
          {connected ? "✓ Connecté" : "Non connecté"}
        </span>
      </div>
      <span style={{ fontSize: 12.5, opacity: 0.75, lineHeight: 1.5 }}>{desc}</span>
      {connected && label ? (
        <span style={{ fontSize: 12, color: "rgba(157,206,157,0.85)" }}>{label}</span>
      ) : null}
      <a
        href={connectHref}
        className={connected ? "agent-btn" : "agent-btn agent-btn--primary"}
        style={{ marginTop: 4, textAlign: "center", textDecoration: "none" }}
      >
        {connected ? "Reconnecter" : "Connecter"}
      </a>
    </div>
  );
}
