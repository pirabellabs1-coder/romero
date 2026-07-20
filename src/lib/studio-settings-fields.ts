/**
 * Constante partagée entre serveur et client (aucune dépendance).
 * Séparée de studio-settings.ts qui utilise `pg` (server-only).
 */
export const STUDIO_SETTINGS_FIELDS = [
  // ─── Clés IA (utilisées par plusieurs agents) ─────
  { key: "anthropic_api_key",     label: "Clé API Anthropic (Claude)",             type: "password", section: "ia", help: "Utilisée par les 4 agents (chatbot, whatsapp, marketing, admin)" },
  { key: "openai_api_key",        label: "Clé API OpenAI (Whisper)",               type: "password", section: "ia", help: "Utilisée par WhatsApp (vocaux) et Marketing (briefs vocaux)" },

  // ─── Meta / Instagram ─────────────────────────────
  { key: "meta_access_token",     label: "Meta Page Access Token (long-lived)",    type: "password", section: "meta", help: "Publication Instagram + éventuels tools cross-agent" },
  { key: "instagram_business_id", label: "Instagram Business Account ID",          type: "text",     section: "meta", help: "ID numérique du compte @romeromomentsphoto" },

  // ─── Google OAuth ─────────────────────────────────
  { key: "google_client_id",      label: "Google OAuth Client ID",                 type: "text",     section: "google", help: "Créé dans Google Cloud Console → APIs & Services → Credentials" },
  { key: "google_client_secret",  label: "Google OAuth Client Secret",             type: "password", section: "google", help: "Le refresh_token reste spécifique à chaque agent (lié au compte connecté)" },

  // ─── Identité entreprise ──────────────────────────
  { key: "legal_status",          label: "Statut juridique",                       type: "text",     section: "legal", help: "Micro-entrepreneur / EI / EURL / SASU / SAS" },
  { key: "legal_name",            label: "Nom légal complet",                      type: "text",     section: "legal", help: "Utilisé sur factures, contrats, mentions" },
  { key: "siret",                 label: "SIRET",                                  type: "text",     section: "legal", help: "14 chiffres" },
  { key: "rcs_city",              label: "Ville d'immatriculation RCS",            type: "text",     section: "legal", help: "Ex : Nice (si société — vide si micro)" },
  { key: "legal_address",         label: "Adresse professionnelle",                type: "textarea", section: "legal", help: "Apparaît en en-tête des documents" },
  { key: "vat_number",            label: "N° TVA intracommunautaire",              type: "text",     section: "legal", help: "Ex : FR12345678901 — laisser vide si franchise TVA (micro)" },
  { key: "vat_applicable",        label: "Assujetti à la TVA (yes/no)",            type: "text",     section: "legal", help: "yes = ajouter TVA sur factures, no = franchise art. 293 B" },

  // ─── Contact ──────────────────────────────────────
  { key: "notification_email",    label: "E-mail de notification global",          type: "text",     section: "contact", help: "Redirige les mails de leads / alertes ici (par défaut = MAIL_TO env)" },
  { key: "public_phone",          label: "Téléphone public",                       type: "text",     section: "contact", help: "Communiqué par le chatbot aux prospects sérieux" },
] as const;

export type StudioFieldKey = (typeof STUDIO_SETTINGS_FIELDS)[number]["key"];
