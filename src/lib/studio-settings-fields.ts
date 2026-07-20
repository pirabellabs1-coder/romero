/**
 * Constante partagée entre serveur et client (aucune dépendance).
 * Séparée de studio-settings.ts qui utilise `pg` (server-only).
 *
 * ⚠️ Design : ce formulaire est destiné à un utilisateur NON-technique
 * (photographe). On ne demande QUE des infos qu'il peut renseigner seul :
 *   • SIRET + adresse pro (auto-remplis via API Sirene)
 *   • Contact
 *
 * Les clés techniques (ANTHROPIC_API_KEY, OPENAI_API_KEY, META_APP_ID,
 * GOOGLE_CLIENT_ID/SECRET) sont configurées côté Vercel ENV par l'équipe
 * dev — le user ne les voit jamais. Les tokens obtenus par OAuth
 * (google_refresh_token, meta_access_token, instagram_business_id) sont
 * remplis automatiquement par les routes /api/auth/*.
 */
export const STUDIO_SETTINGS_FIELDS = [
  // ─── Identité entreprise (auto-remplissable via SIRET) ─────
  { key: "siret",                 label: "SIRET",                                  type: "text",     section: "legal", help: "14 chiffres — sur tes factures et papiers URSSAF. Clique « Récupérer » pour tout auto-remplir." },
  { key: "legal_status",          label: "Statut juridique",                       type: "text",     section: "legal", help: "Micro-entrepreneur / EI / EURL / SASU (auto-rempli depuis Sirene)" },
  { key: "legal_name",            label: "Nom légal complet",                      type: "text",     section: "legal", help: "Ton nom officiel sur les documents fiscaux" },
  { key: "legal_address",         label: "Adresse professionnelle",                type: "textarea", section: "legal", help: "Apparaît en en-tête des factures et contrats" },
  { key: "rcs_city",              label: "Ville d'immatriculation RCS",            type: "text",     section: "legal", help: "Uniquement si société — vide si micro-entrepreneur" },
  { key: "vat_number",            label: "N° TVA intracommunautaire",              type: "text",     section: "legal", help: "Ex : FR12345678901 — laisse vide si franchise TVA (micro)" },
  { key: "vat_applicable",        label: "Assujetti à la TVA (yes/no)",            type: "text",     section: "legal", help: "yes = TVA ajoutée sur factures — no = franchise art. 293 B (défaut micro)" },

  // ─── Contact ──────────────────────────────────────
  { key: "notification_email",    label: "E-mail où recevoir tes leads",           type: "text",     section: "contact", help: "Chaque nouveau contact via ton site arrivera ici" },
  { key: "public_phone",          label: "Téléphone que tu communiques",           type: "text",     section: "contact", help: "Le chatbot peut le donner aux prospects sérieux (facultatif)" },
] as const;

export type StudioFieldKey = (typeof STUDIO_SETTINGS_FIELDS)[number]["key"];
