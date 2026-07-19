/**
 * GET /api/admin/kb-export?slug=site|whatsapp|marketing|admin
 * ──────────────────────────────────────────────────────────────
 * Exporte la KB + le prompt système d'un agent en JSON. Force le
 * navigateur à télécharger via Content-Disposition.
 * Protégé par la session admin (requireUser).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { AGENT_ORDER, getAgent, listKnowledge, type AgentSlug } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const slug = req.nextUrl.searchParams.get("slug") as AgentSlug | null;
  if (!slug || !AGENT_ORDER.includes(slug))
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });

  const inst = await getAgent(slug);
  const kb = await listKnowledge(slug);
  const payload = {
    exported_at: new Date().toISOString(),
    agent_slug: slug,
    system_prompt: inst?.system_prompt ?? "",
    knowledge: kb.map((k) => ({
      title: k.title,
      category: k.category,
      content: k.content,
    })),
  };

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="romero-${slug}-kb-${today}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
