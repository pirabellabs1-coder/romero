/**
 * GET /api/admin/export/user-guide
 * ─────────────────────────────────
 * Télécharge le manuel d'utilisation PDF de la plateforme.
 * Généré à la volée avec pdf-lib (~20 pages A4).
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { buildUserGuidePDF } from "@/lib/user-guide-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const bytes = await buildUserGuidePDF();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Romero-Studio-Guide-Utilisation.pdf"`,
    },
  });
}
