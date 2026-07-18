// ──────────────────────────────────────────────────────────────────────
// Marketing brain — génération 3 outputs depuis un brief
// ──────────────────────────────────────────────────────────────────────
//
// Reçoit :
//   - un brief libre (texte)
//   - éventuellement des URL de photos (uploadées ailleurs)
//   - le prompt système + la voix éditoriale + les hashtags signature
//
// Renvoie :
//   - un post Instagram (caption + hashtags séparés)
//   - un post LinkedIn (accroche + corps)
//   - un article de blog (titre, slug, méta-description, contenu markdown)
//
// Approche : un seul appel Claude, avec un JSON schema explicite
// (structured output via tool-use). Ça évite les erreurs de parsing
// courantes quand on demande à un LLM de renvoyer du JSON en freeform.

import { effectivePrompt, getAgent, listKnowledge } from "@/lib/agents";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

export type GenerationResult =
  | {
      ok: true;
      instagram: { caption: string; hashtags: string };
      linkedin: string;
      blog: {
        title: string;
        slug: string;
        meta_description: string;
        content_markdown: string;
      };
      duration_ms: number;
    }
  | { ok: false; error: string };

// Le tool devient l'output structuré. Claude est forcé à l'appeler,
// et on récupère les 3 drafts dans son input.
const DRAFT_TOOL = {
  name: "return_drafts",
  description:
    "Renvoie les 3 versions du contenu (Instagram, LinkedIn, blog) au format structuré. Toujours renseigner tous les champs.",
  input_schema: {
    type: "object" as const,
    required: [
      "instagram_caption",
      "instagram_hashtags",
      "linkedin_post",
      "blog_title",
      "blog_slug",
      "blog_meta_description",
      "blog_content_markdown",
    ],
    properties: {
      instagram_caption: {
        type: "string",
        description:
          "Légende Instagram (100-220 mots, story-telling, ton chaleureux, jamais racoleur). Émojis avec parcimonie (2-4 max). PAS de hashtags — ils vont dans le champ dédié.",
      },
      instagram_hashtags: {
        type: "string",
        description:
          "Entre 15 et 25 hashtags séparés par un espace, mixant volume et niche : mariage général, régional (Nice / Côte d'Azur / Provence), photographe, style. Inclure les hashtags signature fournis s'ils sont pertinents.",
      },
      linkedin_post: {
        type: "string",
        description:
          "Post LinkedIn 150-300 mots, ton pro mais humain, accroche forte sur les 2 premières lignes (règle du « voir plus »). Terminer par 3-5 hashtags pertinents en fin de post.",
      },
      blog_title: {
        type: "string",
        description:
          "Titre SEO optimisé (60 caractères max). Doit contenir un mot-clé principal.",
      },
      blog_slug: {
        type: "string",
        description:
          "Slug URL en kebab-case, minuscules, sans accents ni caractères spéciaux (a-z, 0-9, -). Généré à partir du titre.",
      },
      blog_meta_description: {
        type: "string",
        description: "Méta-description SEO (155 caractères max).",
      },
      blog_content_markdown: {
        type: "string",
        description:
          "Article de blog 800-1500 mots en markdown : ## et ### pour la structure, paragraphes courts, intro accrocheuse, conclusion avec CTA doux vers /contact ou /concours. Mots-clés intégrés naturellement.",
      },
    },
  },
};

export async function generateFromBrief(input: {
  briefText: string;
  photoUrls: string[];
}): Promise<GenerationResult> {
  const t0 = Date.now();
  try {
    if (!input.briefText.trim())
      return { ok: false, error: "Brief vide" };

    const inst = await getAgent("marketing");
    if (!inst) return { ok: false, error: "Agent marketing indisponible" };
    const cfg = inst.config as {
      anthropic_api_key?: string;
      brand_voice?: string;
      signature_hashtags?: string;
    };
    if (!cfg.anthropic_api_key)
      return {
        ok: false,
        error:
          "Clé API Anthropic manquante — configurez-la dans /admin/agents/marketing.",
      };

    // Enrichit le prompt système avec la voix + la KB + les hashtags signature.
    const kb = await listKnowledge("marketing");
    const kbBlock = kb.length
      ? "\n\n# BASE DE CONNAISSANCES\n" +
        kb
          .map((k) => `## ${k.title} [${k.category}]\n${k.content}`)
          .join("\n\n")
      : "";
    let systemPrompt = effectivePrompt(inst) + kbBlock;
    if (cfg.brand_voice) {
      systemPrompt += `\n\n## VOIX ÉDITORIALE (à respecter strictement)\n${cfg.brand_voice}`;
    }
    if (cfg.signature_hashtags) {
      systemPrompt += `\n\n## HASHTAGS SIGNATURE (à inclure dans instagram_hashtags s'ils sont pertinents)\n${cfg.signature_hashtags}`;
    }
    systemPrompt +=
      "\n\n## FORMAT DE RÉPONSE\nTu DOIS appeler l'outil `return_drafts` avec les 3 versions. N'écris jamais de texte libre en dehors du tool call.";

    // Construit le message utilisateur avec le brief + les photos.
    const userContent: Array<Record<string, unknown>> = [
      {
        type: "text",
        text:
          `Voici le brief du photographe pour ce contenu :\n\n"""\n${input.briefText}\n"""` +
          (input.photoUrls.length > 0
            ? "\n\nDes photos sont attachées ci-dessus — analyse-les pour t'inspirer (ambiance, palette, moment)."
            : ""),
      },
    ];
    // Attache les photos comme images pour Claude (via URL — Claude Haiku
    // supporte les images en input).
    for (const url of input.photoUrls.slice(0, 5)) {
      userContent.unshift({
        type: "image",
        source: { type: "url", url },
      });
    }

    // Appelle Claude en forçant l'utilisation du tool return_drafts.
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": cfg.anthropic_api_key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        tools: [DRAFT_TOOL],
        tool_choice: { type: "tool", name: "return_drafts" },
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return {
        ok: false,
        error: `Anthropic HTTP ${resp.status} · ${text.slice(0, 400)}`,
      };
    }

    const data = (await resp.json()) as {
      content?: Array<{
        type: string;
        name?: string;
        input?: Record<string, string>;
      }>;
    };

    const toolCall = data.content?.find(
      (c) => c.type === "tool_use" && c.name === "return_drafts"
    );
    if (!toolCall?.input) {
      return {
        ok: false,
        error: "Claude n'a pas renvoyé les drafts (pas d'appel à return_drafts)",
      };
    }

    const drafts = toolCall.input;

    return {
      ok: true,
      duration_ms: Date.now() - t0,
      instagram: {
        caption: drafts.instagram_caption ?? "",
        hashtags: drafts.instagram_hashtags ?? "",
      },
      linkedin: drafts.linkedin_post ?? "",
      blog: {
        title: drafts.blog_title ?? "",
        slug: slugify(drafts.blog_slug ?? drafts.blog_title ?? ""),
        meta_description: drafts.blog_meta_description ?? "",
        content_markdown: drafts.blog_content_markdown ?? "",
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// Slug URL propre — accents supprimés, uniquement [a-z0-9-].
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
