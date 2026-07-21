import Link from "next/link";
import type { Metadata } from "next";
import { getSharedConfig } from "@/lib/studio-settings";
import { getAgent } from "@/lib/agents";
import StudioSettingsForm from "./StudioSettingsForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Réglages du studio — Romero Photography",
};

export default async function StudioSettingsPage() {
  const [initial, marketing, whatsapp] = await Promise.all([
    getSharedConfig().catch(() => ({} as Record<string, string>)),
    getAgent("marketing").catch(() => null),
    getAgent("whatsapp").catch(() => null),
  ]);

  // Statut Instagram : on considère connecté si un access token + IG business id existent
  const mktCfg = (marketing?.config ?? {}) as Record<string, string>;
  const igConnected =
    !!mktCfg.meta_access_token && !!mktCfg.instagram_business_id;
  const igLabel = mktCfg.meta_page_name
    ? `Page « ${mktCfg.meta_page_name} »`
    : mktCfg.instagram_business_id
    ? `IG #${mktCfg.instagram_business_id}`
    : undefined;

  // Statut Google : on considère connecté si un refresh_token existe
  const waCfg = (whatsapp?.config ?? {}) as Record<string, string>;
  const gConnected = !!waCfg.google_refresh_token;
  const gLabel = waCfg.google_account_email;

  // Statut Telegram : token présent (config plateforme) + user_id autorisé capturé
  const tgTokenPresent = !!initial.telegram_bot_token;
  const tgOwnerCaptured = !!initial.telegram_allowed_user_id;
  const tgConnected = tgTokenPresent && tgOwnerCaptured;
  const tgLabel = tgTokenPresent
    ? tgOwnerCaptured
      ? `User ID ${initial.telegram_allowed_user_id}`
      : "Bot prêt — attend le /start du propriétaire"
    : undefined;

  // Statut WhatsApp Business : access_token + phone_number_id présents
  const waConnected =
    !!initial.whatsapp_access_token && !!initial.whatsapp_phone_number_id;
  const waLabel = waConnected
    ? initial.whatsapp_business_name
      ? `${initial.whatsapp_display_number ?? "numéro business"} · ${initial.whatsapp_business_name}`
      : initial.whatsapp_display_number ?? `Phone #${initial.whatsapp_phone_number_id}`
    : undefined;

  return (
    <div>
      <Link href="/admin/agents" className="agent-back">
        ← Retour aux agents
      </Link>

      <section className="agents-hero" style={{ marginBottom: 26 }}>
        <div className="agents-hero__eyebrow">Configuration</div>
        <h1 className="agents-hero__title">
          Réglages du <em>studio</em>
        </h1>
        <p className="agents-hero__lead">
          Tout ce dont tes 4 agents ont besoin pour travailler : ton entreprise, tes
          coordonnées, tes comptes Instagram et Google. Aucune connaissance technique
          nécessaire — colle ton SIRET, clique deux boutons, c'est prêt.
        </p>
      </section>

      <StudioSettingsForm
        initial={initial}
        connections={{
          instagram: { connected: igConnected, label: igLabel },
          google: { connected: gConnected, label: gLabel },
          telegram: {
            connected: tgConnected,
            ready: tgTokenPresent,
            label: tgLabel,
          },
          whatsapp: {
            connected: waConnected,
            label: waLabel,
            verifyToken: initial.whatsapp_verify_token,
          },
        }}
      />
    </div>
  );
}
