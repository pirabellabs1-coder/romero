import Link from "next/link";
import type { Metadata } from "next";
import { getSharedConfig } from "@/lib/studio-settings";
import StudioSettingsForm from "./StudioSettingsForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Studio Settings — Romero Photography",
};

export default async function StudioSettingsPage() {
  const initial = await getSharedConfig().catch(() => ({} as Record<string, string>));

  return (
    <div>
      <Link href="/admin/agents" className="agent-back">
        ← Retour aux agents
      </Link>

      <section className="agents-hero" style={{ marginBottom: 26 }}>
        <div className="agents-hero__eyebrow">Paramètres partagés</div>
        <h1 className="agents-hero__title">
          Studio <em>Settings</em>
        </h1>
        <p className="agents-hero__lead">
          Un seul endroit pour vos clés API et informations d'entreprise. Les 4 agents en
          héritent automatiquement — pas besoin de coller la même clé Anthropic dans
          chacun. Un agent peut toujours override localement dans sa propre page
          Configuration si nécessaire.
        </p>
      </section>

      <StudioSettingsForm initial={initial} />
    </div>
  );
}
