import Link from "next/link";
import type { Metadata } from "next";
import { getSharedConfig } from "@/lib/studio-settings";
import { getAgent } from "@/lib/agents";
import OnboardingWizard from "./OnboardingWizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bienvenue — Configuration initiale",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: { step?: string; ok?: string; err?: string };
}) {
  const [shared, marketing, whatsapp] = await Promise.all([
    getSharedConfig().catch(() => ({} as Record<string, string>)),
    getAgent("marketing").catch(() => null),
    getAgent("whatsapp").catch(() => null),
  ]);

  const mktCfg = (marketing?.config ?? {}) as Record<string, string>;
  const waCfg = (whatsapp?.config ?? {}) as Record<string, string>;

  const status = {
    company: !!(shared.siret && shared.legal_name),
    instagram: !!(mktCfg.meta_access_token && mktCfg.instagram_business_id),
    google: !!waCfg.google_refresh_token,
  };
  const igLabel = mktCfg.meta_page_name;
  const gLabel = waCfg.google_account_email;

  const stepParam = Number(searchParams?.step);
  const startStep = Number.isFinite(stepParam) && stepParam >= 0 && stepParam <= 4 ? stepParam : 0;
  const flash =
    searchParams?.ok
      ? { ok: true, msg: decodeURIComponent(searchParams.ok) }
      : searchParams?.err
      ? { ok: false, msg: decodeURIComponent(searchParams.err) }
      : null;

  return (
    <div>
      <Link href="/admin" className="agent-back">
        ← Retour au tableau de bord
      </Link>

      <OnboardingWizard
        startStep={startStep}
        status={status}
        initialCompany={{
          siret: shared.siret ?? "",
          legal_name: shared.legal_name ?? "",
          legal_status: shared.legal_status ?? "",
          legal_address: shared.legal_address ?? "",
          rcs_city: shared.rcs_city ?? "",
        }}
        initialContact={{
          notification_email: shared.notification_email ?? "",
          public_phone: shared.public_phone ?? "",
        }}
        instagramLabel={igLabel}
        googleLabel={gLabel}
        flash={flash}
      />
    </div>
  );
}
