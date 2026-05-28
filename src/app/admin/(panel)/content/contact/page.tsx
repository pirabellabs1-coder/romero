import Link from "next/link";
import { getPageContentBilingual } from "@/lib/page-content";
import { STRINGS } from "@/lib/i18n";
import PageContentEditor, { type SectionSpec } from "@/components/admin/PageContentEditor";
import { saveContentFields } from "../actions";
import { cmsPageGuard } from "../cms-guard";

export const dynamic = "force-dynamic";

const SECTIONS: SectionSpec[] = [
  {
    title: "En-tête de la page Contact",
    fields: [
      { key: "eyebrow", label: "Surtitre" },
      { key: "title", label: "Titre — partie principale" },
      { key: "titleAccent", label: "Titre — partie en italique doré" },
      { key: "lead", label: "Sous-titre", variant: "textarea" },
    ],
  },
  {
    title: "Libellés du formulaire",
    description: "Champs du formulaire de contact.",
    fields: [
      { key: "form_firstName", label: "Champ Prénom" },
      { key: "form_lastName",  label: "Champ Nom" },
      { key: "form_email",     label: "Champ Email" },
      { key: "form_phone",     label: "Champ Téléphone" },
      { key: "form_date",      label: "Champ Date du mariage" },
      { key: "form_place",     label: "Champ Lieu" },
      { key: "form_message",   label: "Champ Message" },
      { key: "form_messagePh", label: "Placeholder du message", variant: "textarea" },
      { key: "form_submit",    label: "Bouton d'envoi" },
      { key: "form_sent",      label: "Message de succès", variant: "textarea" },
      { key: "form_error",     label: "Message d'erreur", variant: "textarea" },
    ],
  },
  {
    title: "Bloc Coordonnées",
    fields: [
      { key: "coordsEyebrow", label: "Surtitre" },
      { key: "coordsTitle", label: "Titre du bloc" },
      { key: "coords_0_icon",  label: "Coordonnée 1 — emoji" },
      { key: "coords_0_main",  label: "Coordonnée 1 — info principale" },
      { key: "coords_0_sub",   label: "Coordonnée 1 — info complémentaire" },
      { key: "coords_1_icon",  label: "Coordonnée 2 — emoji" },
      { key: "coords_1_main",  label: "Coordonnée 2 — info principale" },
      { key: "coords_1_sub",   label: "Coordonnée 2 — info complémentaire" },
      { key: "coords_2_icon",  label: "Coordonnée 3 — emoji" },
      { key: "coords_2_main",  label: "Coordonnée 3 — info principale" },
      { key: "coords_2_sub",   label: "Coordonnée 3 — info complémentaire" },
    ],
  },
];

function flatDefaults(lang: "fr" | "en"): Record<string, string> {
  const p = STRINGS[lang].contact as unknown as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) if (typeof v === "string") out[k] = v;
  if (p.form && typeof p.form === "object") {
    for (const [fk, fv] of Object.entries(p.form as Record<string, unknown>)) {
      if (typeof fv === "string") out[`form_${fk}`] = fv;
    }
  }
  (p.coords as Array<[string, string, string]> | undefined)?.forEach(([icon, main, sub], i) => {
    out[`coords_${i}_icon`] = icon;
    out[`coords_${i}_main`] = main;
    out[`coords_${i}_sub`] = sub;
  });
  return out;
}

export default async function ContactContentPage() {
  cmsPageGuard("contact");
  const overrides = await getPageContentBilingual("contact");
  return (
    <>
      <Link href="/admin/content" className="cap-tracked-sm gold">← TOUS LES CONTENUS</Link>
      <h1 className="admin-h1" style={{ marginTop: 10 }}>Page Contact</h1>
      <p className="admin-sub">L&apos;email destinataire se règle dans <Link href="/admin/settings" className="gold">Paramètres</Link>.</p>
      <PageContentEditor
        page="contact"
        viewPath="/contact"
        sections={SECTIONS}
        initialFr={overrides.fr}
        initialEn={overrides.en}
        defaultsFr={flatDefaults("fr")}
        defaultsEn={flatDefaults("en")}
        saveAction={saveContentFields}
      />
    </>
  );
}
