/**
 * GET /api/admin/sirene-lookup?siret=12345678900012
 * ─────────────────────────────────────────────────
 * Interroge l'API publique gratuite « Recherche d'Entreprises » de
 * data.gouv.fr (aucune clé requise) et renvoie les informations légales
 * prêtes à remplir Studio Settings.
 *
 * Réponse succès :
 *   { ok: true, data: { legal_name, legal_address, legal_status,
 *                       rcs_city, siret, siren, naf } }
 * Réponse échec :
 *   { ok: false, error: "…" }
 *
 * Doc API : https://recherche-entreprises.api.gouv.fr/docs
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SireneEtablissement = {
  siret?: string;
  activite_principale?: string;
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
};

type SireneResult = {
  siren?: string;
  nom_complet?: string;
  nom_raison_sociale?: string;
  nature_juridique?: string;
  siege?: SireneEtablissement;
  matching_etablissements?: SireneEtablissement[];
};

const LEGAL_STATUS_MAP: Record<string, string> = {
  "1000": "Entreprise individuelle",
  "1200": "Artisan-commerçant",
  "1500": "Profession libérale",
  "5498": "SASU",
  "5499": "SAS",
  "5710": "SAS",
  "5720": "SASU",
  "5498_alt": "SASU",
  "5410": "SARL",
  "5720_alt": "SASU",
  "5498b": "SASU",
  "5202": "SNC",
  "5307": "Société civile",
  "5202b": "SNC",
  "5498c": "SASU",
  "5498d": "SASU",
  "5203": "SNC",
  "5498e": "SASU",
  "5498f": "SASU",
  "5601": "SA",
  "5498g": "SASU",
  "5710b": "SAS",
};

function humanizeLegal(code?: string): string {
  if (!code) return "";
  const clean = code.trim();
  if (LEGAL_STATUS_MAP[clean]) return LEGAL_STATUS_MAP[clean];
  // Fallback : renvoyer le code brut si non mappé.
  // « 1000 » = auto-entrepreneur / EI. On peut affiner plus tard.
  if (clean.startsWith("1")) return "Entreprise individuelle";
  if (clean.startsWith("54")) return "SARL";
  if (clean.startsWith("55")) return "SA";
  if (clean.startsWith("57")) return "SAS / SASU";
  return `Code ${clean}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ ok: false, error: "Non authentifié." }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("siret") ?? "";
  const siret = raw.replace(/\s+/g, "");
  if (!/^\d{14}$/.test(siret)) {
    return NextResponse.json(
      { ok: false, error: "SIRET invalide : il doit contenir exactement 14 chiffres." },
      { status: 400 }
    );
  }

  try {
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // L'API est publique et cache friendly.
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `API Sirene indisponible (HTTP ${res.status}).` },
        { status: 502 }
      );
    }
    const json = (await res.json()) as { results?: SireneResult[]; total_results?: number };
    const first = json.results?.[0];
    if (!first) {
      return NextResponse.json(
        { ok: false, error: "Aucune entreprise trouvée pour ce SIRET." },
        { status: 404 }
      );
    }

    // On préfère l'établissement matching (le SIRET précis), sinon le siège.
    const etab =
      first.matching_etablissements?.find((e) => e.siret === siret) ??
      first.siege ??
      first.matching_etablissements?.[0];

    const addressParts = [
      etab?.adresse,
      [etab?.code_postal, etab?.libelle_commune].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join("\n");

    const data = {
      siret,
      siren: first.siren ?? siret.slice(0, 9),
      legal_name: first.nom_raison_sociale || first.nom_complet || "",
      legal_status: humanizeLegal(first.nature_juridique),
      legal_address: addressParts,
      rcs_city: etab?.libelle_commune ?? "",
      naf: etab?.activite_principale ?? "",
    };

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
