"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveOnboardingCompanyAction, saveOnboardingContactAction } from "./actions";

type Status = { company: boolean; instagram: boolean; google: boolean };

type Props = {
  startStep: number;
  status: Status;
  initialCompany: {
    siret: string;
    legal_name: string;
    legal_status: string;
    legal_address: string;
    rcs_city: string;
  };
  initialContact: { notification_email: string; public_phone: string };
  instagramLabel?: string;
  googleLabel?: string;
  flash: { ok: boolean; msg: string } | null;
};

const STEPS = [
  { key: "welcome", title: "Bienvenue" },
  { key: "company", title: "Ton entreprise" },
  { key: "instagram", title: "Instagram" },
  { key: "google", title: "Google Agenda" },
  { key: "done", title: "C'est prêt" },
];

export default function OnboardingWizard({
  startStep,
  status,
  initialCompany,
  initialContact,
  instagramLabel,
  googleLabel,
  flash,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(startStep);

  const completedCount =
    (status.company ? 1 : 0) +
    (status.instagram ? 1 : 0) +
    (status.google ? 1 : 0);
  const progressPct = Math.round((completedCount / 3) * 100);

  // Marque chaque step comme "done" selon le status
  const isDone: Record<string, boolean> = {
    welcome: false, // toujours navigable
    company: status.company,
    instagram: status.instagram,
    google: status.google,
    done: completedCount === 3,
  };

  return (
    <div>
      <section className="agents-hero" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="agents-hero__eyebrow">Configuration initiale</div>
            <h1 className="agents-hero__title">
              Bienvenue <em>Mickael</em>
            </h1>
            <p className="agents-hero__lead">
              On configure ton studio ensemble en {STEPS.length - 1} étapes. Tu peux passer
              n'importe quelle étape et y revenir plus tard.
            </p>
          </div>
          <div style={{ textAlign: "right", minWidth: 140 }}>
            <div
              style={{
                fontSize: 42,
                fontWeight: 300,
                lineHeight: 1,
                color:
                  progressPct >= 100
                    ? "#9DCE9D"
                    : progressPct >= 50
                    ? "#B8975A"
                    : "rgba(184,151,90,0.6)",
              }}
            >
              {progressPct}%
            </div>
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                opacity: 0.55,
                marginTop: 2,
              }}
            >
              {completedCount}/3 configuré{completedCount > 1 ? "s" : ""}
            </div>
            <Link
              href="/admin"
              style={{
                display: "inline-block",
                marginTop: 10,
                fontSize: 11.5,
                opacity: 0.65,
                color: "inherit",
                textDecoration: "underline",
              }}
            >
              Ignorer tout →
            </Link>
          </div>
        </div>
      </section>

      {flash ? (
        <div
          className={`agent-flash agent-flash--${flash.ok ? "ok" : "err"}`}
          style={{ marginBottom: 18 }}
        >
          {flash.ok ? "✓" : "✗"} {flash.msg}
        </div>
      ) : null}

      {/* Progress bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 26,
          padding: "0 4px",
        }}
      >
        {STEPS.map((s, i) => {
          const done = isDone[s.key];
          const active = i === step;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(i)}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
              title={done ? "Étape déjà complétée" : `Aller à l'étape ${i + 1}`}
            >
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: done
                    ? "#9DCE9D"
                    : i < step
                    ? "rgba(157,206,157,0.5)"
                    : active
                    ? "#B8975A"
                    : "rgba(184,151,90,0.2)",
                  marginBottom: 6,
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  opacity: active ? 1 : 0.65,
                  color: done ? "#9DCE9D" : active ? "#B8975A" : "inherit",
                  fontWeight: done ? 600 : 400,
                }}
              >
                {done ? "✓ " : `${i + 1}. `}
                {s.title}
              </div>
            </button>
          );
        })}
      </div>

      {step === 0 ? (
        <StepWelcome
          status={status}
          onStart={() => setStep(1)}
          onSkip={() => router.push("/admin")}
        />
      ) : null}

      {step === 1 ? (
        <StepCompany
          initial={initialCompany}
          done={status.company}
          onDone={() => {
            router.refresh();
            setStep(2);
          }}
          onBack={() => setStep(0)}
          onSkip={() => setStep(2)}
        />
      ) : null}

      {step === 2 ? (
        <StepInstagram
          connected={status.instagram}
          label={instagramLabel}
          onBack={() => setStep(1)}
          onSkip={() => setStep(3)}
        />
      ) : null}

      {step === 3 ? (
        <StepGoogle
          connected={status.google}
          label={googleLabel}
          onBack={() => setStep(2)}
          onSkip={() => setStep(4)}
        />
      ) : null}

      {step === 4 ? (
        <StepDone
          status={status}
          initialContact={initialContact}
          onFinish={() => router.push("/admin/agents")}
        />
      ) : null}
    </div>
  );
}

// ─── Étape 0 : Bienvenue ─────────────────────────────────────────────
function StepWelcome({
  status,
  onStart,
  onSkip,
}: {
  status: Status;
  onStart: () => void;
  onSkip: () => void;
}) {
  const allDone = status.company && status.instagram && status.google;
  return (
    <div className="agent-panel">
      <h2>Ton assistant IA en 3 minutes</h2>
      <p style={{ opacity: 0.8, lineHeight: 1.6 }}>
        Tes 4 agents (Site, WhatsApp, Marketing, Admin) sont déjà installés et
        entraînés — ils attendent juste tes infos de studio pour se mettre en route.
      </p>
      <ul style={{ opacity: 0.85, lineHeight: 1.9, marginTop: 12, paddingLeft: 18 }}>
        <li>
          <strong>Ton entreprise</strong> — colle ton SIRET, tout se remplit tout seul.
        </li>
        <li>
          <strong>Instagram</strong> — 1 clic pour laisser l'agent Marketing publier.
        </li>
        <li>
          <strong>Google Agenda</strong> — 1 clic pour laisser l'agent WhatsApp gérer tes RDV.
        </li>
      </ul>
      <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
        <button className="agent-btn agent-btn--primary" type="button" onClick={onStart}>
          {allDone ? "Vérifier la config →" : "C'est parti →"}
        </button>
        <button className="agent-btn" type="button" onClick={onSkip}>
          Plus tard
        </button>
      </div>
    </div>
  );
}

// ─── Étape 1 : Entreprise ────────────────────────────────────────────
function StepCompany({
  initial,
  done,
  onDone,
  onBack,
  onSkip,
}: {
  initial: Props["initialCompany"];
  done: boolean;
  onDone: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [siret, setSiret] = useState(initial.siret);
  const [legalName, setLegalName] = useState(initial.legal_name);
  const [legalStatus, setLegalStatus] = useState(initial.legal_status);
  const [legalAddress, setLegalAddress] = useState(initial.legal_address);
  const [rcsCity, setRcsCity] = useState(initial.rcs_city);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  async function lookup() {
    setLookupMsg(null);
    const clean = siret.replace(/\s+/g, "");
    if (!/^\d{14}$/.test(clean)) {
      setLookupMsg({ ok: false, msg: "Le SIRET doit contenir exactement 14 chiffres." });
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
        setLookupMsg({ ok: true, msg: `Trouvé : ${json.data.legal_name}. Vérifie et sauvegarde.` });
      }
    } catch (e) {
      setLookupMsg({ ok: false, msg: e instanceof Error ? e.message : "Erreur réseau." });
    } finally {
      setLookupBusy(false);
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveMsg(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveOnboardingCompanyAction(fd);
      if (res.ok) {
        setSaveMsg({ ok: true, msg: "Entreprise enregistrée." });
        setTimeout(onDone, 400);
      } else {
        setSaveMsg({ ok: false, msg: res.error });
      }
    });
  }

  return (
    <form onSubmit={submit} className="agent-panel">
      <h2>Ton entreprise {done ? <span style={{ color: "#9DCE9D", fontSize: 13, marginLeft: 8 }}>✓</span> : null}</h2>
      <p style={{ opacity: 0.75, marginTop: -4, marginBottom: 18 }}>
        Colle ton SIRET (14 chiffres sur tes factures) et clique « Récupérer ». Tout se
        remplit depuis l'INSEE — tu vérifies et tu sauvegardes.
      </p>

      <div className="agent-form-field">
        <label htmlFor="ob-siret">SIRET</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="ob-siret"
            name="siret"
            type="text"
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
            placeholder="12345678900012"
            style={{ flex: 1 }}
            autoComplete="off"
          />
          <button
            type="button"
            className="agent-btn"
            onClick={lookup}
            disabled={lookupBusy}
            style={{ whiteSpace: "nowrap" }}
          >
            {lookupBusy ? "…" : "🔍 Récupérer"}
          </button>
        </div>
        {lookupMsg ? (
          <div
            className={`agent-flash agent-flash--${lookupMsg.ok ? "ok" : "err"}`}
            style={{ marginTop: 8, fontSize: 13 }}
          >
            {lookupMsg.ok ? "✓" : "✗"} {lookupMsg.msg}
          </div>
        ) : null}
      </div>

      <div className="agent-form-field">
        <label htmlFor="ob-legal_name">Nom légal</label>
        <input
          id="ob-legal_name"
          name="legal_name"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder="Ton nom complet officiel"
        />
      </div>

      <div className="agent-form-field">
        <label htmlFor="ob-legal_status">Statut juridique</label>
        <input
          id="ob-legal_status"
          name="legal_status"
          value={legalStatus}
          onChange={(e) => setLegalStatus(e.target.value)}
          placeholder="Micro-entrepreneur / EURL / SASU…"
        />
      </div>

      <div className="agent-form-field">
        <label htmlFor="ob-legal_address">Adresse pro</label>
        <textarea
          id="ob-legal_address"
          name="legal_address"
          rows={3}
          value={legalAddress}
          onChange={(e) => setLegalAddress(e.target.value)}
          placeholder="Rue, code postal, ville"
        />
      </div>

      <div className="agent-form-field">
        <label htmlFor="ob-rcs_city">Ville RCS (si société)</label>
        <input
          id="ob-rcs_city"
          name="rcs_city"
          value={rcsCity}
          onChange={(e) => setRcsCity(e.target.value)}
          placeholder="Ex : Nice (vide si micro)"
        />
      </div>

      {saveMsg ? (
        <div
          className={`agent-flash agent-flash--${saveMsg.ok ? "ok" : "err"}`}
          style={{ marginTop: 12 }}
        >
          {saveMsg.ok ? "✓" : "✗"} {saveMsg.msg}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
        <button type="button" className="agent-btn" onClick={onBack}>
          ← Retour
        </button>
        <button type="submit" className="agent-btn agent-btn--primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer et continuer →"}
        </button>
        <button type="button" className="agent-btn" onClick={onSkip}>
          Passer cette étape
        </button>
      </div>
    </form>
  );
}

// ─── Étape 2 : Instagram ─────────────────────────────────────────────
function StepInstagram({
  connected,
  label,
  onBack,
  onSkip,
}: {
  connected: boolean;
  label?: string;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="agent-panel">
      <h2>Instagram {connected ? <span style={{ color: "#9DCE9D", fontSize: 13, marginLeft: 8 }}>✓</span> : null}</h2>
      <p style={{ opacity: 0.8, lineHeight: 1.6 }}>
        Un clic pour laisser l'agent Marketing publier tes carrousels sans que tu
        touches aux tokens Meta. Tu dois avoir :
      </p>
      <ul style={{ opacity: 0.75, marginTop: 6, paddingLeft: 20, lineHeight: 1.8 }}>
        <li>Un compte Instagram en mode <strong>Professionnel / Business</strong></li>
        <li>Une <strong>Page Facebook</strong> liée à ce compte Instagram</li>
      </ul>

      {connected ? (
        <div
          className="agent-flash agent-flash--ok"
          style={{ marginTop: 16 }}
        >
          ✓ Instagram déjà connecté{label ? ` (${label})` : ""}. Reconnecte-toi si tu as changé de compte.
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
        <button type="button" className="agent-btn" onClick={onBack}>
          ← Retour
        </button>
        <a
          className="agent-btn agent-btn--primary"
          href={`/api/auth/instagram/start`}
          style={{ textDecoration: "none" }}
        >
          {connected ? "Reconnecter Instagram" : "Connecter Instagram"}
        </a>
        <button type="button" className="agent-btn" onClick={onSkip}>
          Passer
        </button>
      </div>
    </div>
  );
}

// ─── Étape 3 : Google Agenda ─────────────────────────────────────────
function StepGoogle({
  connected,
  label,
  onBack,
  onSkip,
}: {
  connected: boolean;
  label?: string;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="agent-panel">
      <h2>Google Agenda {connected ? <span style={{ color: "#9DCE9D", fontSize: 13, marginLeft: 8 }}>✓</span> : null}</h2>
      <p style={{ opacity: 0.8, lineHeight: 1.6 }}>
        Un clic pour laisser l'agent WhatsApp créer tes rendez-vous, proposer des
        créneaux libres et générer des liens Google Meet. Tu connectes ton propre
        compte Google — nous ne stockons aucun mot de passe.
      </p>

      {connected ? (
        <div
          className="agent-flash agent-flash--ok"
          style={{ marginTop: 16 }}
        >
          ✓ Google Agenda déjà connecté{label ? ` (${label})` : ""}. Reconnecte-toi pour changer de compte.
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
        <button type="button" className="agent-btn" onClick={onBack}>
          ← Retour
        </button>
        <a
          className="agent-btn agent-btn--primary"
          href={`/api/auth/google/start`}
          style={{ textDecoration: "none" }}
        >
          {connected ? "Reconnecter Google" : "Connecter Google Agenda"}
        </a>
        <button type="button" className="agent-btn" onClick={onSkip}>
          Passer
        </button>
      </div>
    </div>
  );
}

// ─── Étape 4 : Fini ──────────────────────────────────────────────────
function StepDone({
  status,
  initialContact,
  onFinish,
}: {
  status: Status;
  initialContact: Props["initialContact"];
  onFinish: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const allDone = status.company && status.instagram && status.google;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveOnboardingContactAction(fd);
      if (res.ok) {
        setMsg({ ok: true, msg: "Coordonnées enregistrées. Direction le studio !" });
        setTimeout(onFinish, 600);
      } else {
        setMsg({ ok: false, msg: res.error });
      }
    });
  }

  return (
    <form onSubmit={submit} className="agent-panel">
      <h2>
        Récap {allDone ? <span style={{ color: "#9DCE9D", fontSize: 13, marginLeft: 8 }}>tout est prêt</span> : <span style={{ color: "#B8975A", fontSize: 13, marginLeft: 8 }}>presque</span>}
      </h2>
      <ul style={{ listStyle: "none", padding: 0, marginTop: 16, marginBottom: 20 }}>
        <RecapRow ok={status.company} label="Entreprise renseignée" />
        <RecapRow ok={status.instagram} label="Instagram connecté" />
        <RecapRow ok={status.google} label="Google Agenda connecté" />
      </ul>

      <p style={{ opacity: 0.8, marginTop: 8 }}>
        Dernière chose : dis-nous où recevoir tes leads et quel numéro tu veux
        éventuellement communiquer.
      </p>

      <div className="agent-form-field" style={{ marginTop: 14 }}>
        <label htmlFor="ob-notification_email">E-mail où recevoir tes leads</label>
        <input
          id="ob-notification_email"
          name="notification_email"
          type="email"
          defaultValue={initialContact.notification_email}
          placeholder="ex : romerophotography.contact@gmail.com"
        />
      </div>

      <div className="agent-form-field">
        <label htmlFor="ob-public_phone">Téléphone (facultatif)</label>
        <input
          id="ob-public_phone"
          name="public_phone"
          type="tel"
          defaultValue={initialContact.public_phone}
          placeholder="ex : +33 6 xx xx xx xx"
        />
      </div>

      {msg ? (
        <div
          className={`agent-flash agent-flash--${msg.ok ? "ok" : "err"}`}
          style={{ marginTop: 12 }}
        >
          {msg.ok ? "✓" : "✗"} {msg.msg}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
        <button type="submit" className="agent-btn agent-btn--primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Terminer et ouvrir mes agents →"}
        </button>
        <Link href="/admin" className="agent-btn" style={{ textDecoration: "none" }}>
          Tableau de bord
        </Link>
      </div>
    </form>
  );
}

function RecapRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid rgba(184,151,90,0.12)",
        fontSize: 14,
        color: ok ? "rgba(244,239,227,0.92)" : "rgba(244,239,227,0.55)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          width: 22,
          height: 22,
          borderRadius: "50%",
          alignItems: "center",
          justifyContent: "center",
          background: ok ? "rgba(157,206,157,0.18)" : "rgba(184,151,90,0.1)",
          color: ok ? "#9DCE9D" : "rgba(184,151,90,0.65)",
          fontSize: 13,
        }}
      >
        {ok ? "✓" : "•"}
      </span>
      {label}
    </li>
  );
}
