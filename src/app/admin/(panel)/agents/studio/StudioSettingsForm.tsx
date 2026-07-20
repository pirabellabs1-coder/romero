"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
// On importe depuis le fichier pur (aucune dépendance server) pour ne
// pas embarquer `pg` dans le bundle client.
import { STUDIO_SETTINGS_FIELDS } from "@/lib/studio-settings-fields";
import { saveStudioSettingsAction } from "./actions";

type Props = { initial: Record<string, string> };

const SECTIONS = [
  { key: "ia", title: "Intelligence artificielle", desc: "Clés utilisées par plusieurs agents pour appeler Claude, Whisper, etc." },
  { key: "meta", title: "Meta / Instagram", desc: "Publication IG + Insights. Une fois configuré, l'agent Marketing publie automatiquement." },
  { key: "google", title: "Google (OAuth)", desc: "Client OAuth. Le refresh_token reste par-agent (lié au compte connecté)." },
  { key: "legal", title: "Identité entreprise & mentions légales", desc: "Utilisées par l'agent Admin dans devis / contrats / factures." },
  { key: "contact", title: "Contact", desc: "Coordonnées communiquées par les agents aux prospects." },
] as const;

export default function StudioSettingsForm({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveStudioSettingsAction(fd);
      if (res.ok) {
        setFlash({ ok: true, msg: "Studio settings enregistrés. Les 4 agents héritent immédiatement." });
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

      {SECTIONS.map((section) => {
        const fields = STUDIO_SETTINGS_FIELDS.filter((f) => f.section === section.key);
        if (fields.length === 0) return null;
        return (
          <div key={section.key} className="agent-panel" style={{ marginBottom: 22 }}>
            <h2>{section.title}</h2>
            <p style={{ marginTop: -6, marginBottom: 18, opacity: 0.75 }}>{section.desc}</p>
            {fields.map((f) => (
              <div key={f.key} className="agent-form-field">
                <label htmlFor={`ss-${f.key}`}>{f.label}</label>
                {f.type === "textarea" ? (
                  <textarea
                    id={`ss-${f.key}`}
                    name={f.key}
                    defaultValue={initial[f.key] ?? ""}
                    rows={3}
                  />
                ) : (
                  <input
                    id={`ss-${f.key}`}
                    name={f.key}
                    type={f.type === "password" ? "password" : "text"}
                    defaultValue={initial[f.key] ?? ""}
                    autoComplete={f.type === "password" ? "new-password" : "off"}
                    placeholder={initial[f.key] ? "" : "(non renseigné)"}
                  />
                )}
                {f.help ? <span className="agent-form-field__help">{f.help}</span> : null}
              </div>
            ))}
          </div>
        );
      })}

      <div className="agent-actions" style={{ position: "sticky", bottom: 0, background: "linear-gradient(0deg, rgba(46,61,46,0.95), rgba(46,61,46,0.6))", paddingBottom: 16, paddingTop: 20, marginTop: 30 }}>
        <button type="submit" className="agent-btn agent-btn--primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer tout"}
        </button>
        <span style={{ fontSize: 12, color: "rgba(244,239,227,0.55)", marginLeft: 8 }}>
          Les 4 agents prendront ces valeurs par défaut. Un agent peut toujours override localement dans sa page Configuration.
        </span>
      </div>
    </form>
  );
}
