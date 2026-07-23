// ──────────────────────────────────────────────────────────────────────
// Admin brain — génération de devis / contrats / factures depuis brief
// ──────────────────────────────────────────────────────────────────────
//
// Prend un brief court (« devis Sophie & Marc 12 juin 2027 Antibes,
// formule Grand Classique, 130 invités, budget serré ») et renvoie une
// structure prête à valider dans l'UI :
//   - Client (nom, e-mail, tél, adresse)
//   - Contexte mariage
//   - Lignes de prestation avec prix (basé sur la formule inférée)
//   - Notes et modalités
//
// Utilise Claude Haiku avec un tool structured output (comme marketing).

import { effectivePrompt, getAgent, listKnowledge } from "@/lib/agents";
import { getClaudeEndpoint, cachedSystem } from "@/lib/claude-endpoint";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

// ─── Types de sortie ──────────────────────────────────────────────
export type ExtractedClient = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export type ExtractedWedding = {
  date: string; // ISO YYYY-MM-DD ou vide si inconnu
  location: string;
  guest_count: number;
  formula_name: string;
};

export type ExtractedLine = {
  label: string;
  detail: string;
  quantity: number;
  unit_price_cents: number;
};

export type QuoteExtraction = {
  client: ExtractedClient;
  wedding: ExtractedWedding;
  lines: ExtractedLine[];
  deposit_pct: number;
  validity_days: number;
  notes: string;
};

export type ContractExtraction = {
  client: ExtractedClient;
  wedding: {
    date: string;
    location: string;
    guest_count: number;
    ceremony_time: string;
    end_time: string;
  };
  formula_name: string;
  formula_description: string;
  price_cents: number;
  deposit_pct: number;
};

export type InvoiceExtraction = QuoteExtraction & {
  already_paid_cents: number;
  due_date: string;
  payment_terms: string;
};

// ─── Tools structurés ─────────────────────────────────────────────
const QUOTE_TOOL = {
  name: "return_quote",
  description:
    "Renvoie la structure complète du devis extraite du brief. Toutes les valeurs numériques sont en centimes d'euro. Ne rien inventer sur le client : si l'e-mail n'est pas fourni, laisser vide.",
  input_schema: {
    type: "object" as const,
    required: ["client", "wedding", "lines", "deposit_pct", "validity_days"],
    properties: {
      client: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
        },
      },
      wedding: {
        type: "object",
        properties: {
          date: { type: "string", description: "ISO YYYY-MM-DD si mentionné" },
          location: { type: "string" },
          guest_count: { type: "integer" },
          formula_name: {
            type: "string",
            description: "Essentielle | Grand Jour | Grand Classique | Prestige Éternel",
          },
        },
      },
      lines: {
        type: "array",
        items: {
          type: "object",
          required: ["label", "quantity", "unit_price_cents"],
          properties: {
            label: { type: "string" },
            detail: { type: "string" },
            quantity: { type: "integer" },
            unit_price_cents: {
              type: "integer",
              description: "Prix unitaire HT en centimes d'euro (ex : 250000 = 2500 €)",
            },
          },
        },
      },
      deposit_pct: {
        type: "integer",
        description: "Pourcentage d'acompte demandé (typiquement 30)",
      },
      validity_days: {
        type: "integer",
        description: "Durée de validité du devis en jours (typiquement 30)",
      },
      notes: {
        type: "string",
        description: "Notes libres à inclure sur le devis",
      },
    },
  },
};

const CONTRACT_TOOL = {
  name: "return_contract",
  description:
    "Renvoie la structure complète du contrat de mariage. Le champ formula_description doit contenir un paragraphe précis reprenant tout ce qui est inclus dans la formule choisie (nombre de photos, délai de livraison, prestations, etc.).",
  input_schema: {
    type: "object" as const,
    required: ["client", "wedding", "formula_name", "formula_description", "price_cents", "deposit_pct"],
    properties: {
      client: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
        },
      },
      wedding: {
        type: "object",
        required: ["date", "location"],
        properties: {
          date: { type: "string" },
          location: { type: "string" },
          guest_count: { type: "integer" },
          ceremony_time: { type: "string" },
          end_time: { type: "string" },
        },
      },
      formula_name: { type: "string" },
      formula_description: { type: "string" },
      price_cents: { type: "integer" },
      deposit_pct: { type: "integer" },
    },
  },
};

const INVOICE_TOOL = {
  name: "return_invoice",
  description:
    "Renvoie la structure de la facture. Si un acompte a déjà été versé, indiquer le montant en centimes dans already_paid_cents.",
  input_schema: {
    type: "object" as const,
    required: ["client", "lines"],
    properties: {
      client: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
        },
      },
      wedding: {
        type: "object",
        properties: {
          date: { type: "string" },
          location: { type: "string" },
          guest_count: { type: "integer" },
          formula_name: { type: "string" },
        },
      },
      lines: {
        type: "array",
        items: {
          type: "object",
          required: ["label", "quantity", "unit_price_cents"],
          properties: {
            label: { type: "string" },
            detail: { type: "string" },
            quantity: { type: "integer" },
            unit_price_cents: { type: "integer" },
          },
        },
      },
      already_paid_cents: { type: "integer" },
      due_date: { type: "string", description: "ISO YYYY-MM-DD" },
      payment_terms: { type: "string" },
      notes: { type: "string" },
    },
  },
};

// ─── Point d'entrée générique ─────────────────────────────────────
type DocKind = "quote" | "contract" | "invoice";

export async function extractFromBrief(input: {
  kind: DocKind;
  brief: string;
}): Promise<
  | { ok: true; data: QuoteExtraction | ContractExtraction | InvoiceExtraction }
  | { ok: false; error: string }
> {
  try {
    const inst = await getAgent("admin");
    if (!inst) return { ok: false, error: "Agent admin indisponible" };
    const cfg = inst.config as {
      anthropic_api_key?: string;
      siret?: string;
      legal_name?: string;
      legal_status?: string;
      legal_address?: string;
      rcs_city?: string;
      notification_email?: string;
      public_phone?: string;
      website?: string;
      ape_code?: string;
    };
    const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
    if (!cfg.anthropic_api_key && !hasOpenRouter)
      return {
        ok: false,
        error:
          "Clé Claude manquante — configurez-la dans /admin/agents/admin ou passez par OpenRouter.",
      };

    const kb = await listKnowledge("admin");
    const kbBlock = kb.length
      ? "\n\n# BASE DE CONNAISSANCES\n" +
        kb.map((k) => `## ${k.title} [${k.category}]\n${k.content}`).join("\n\n")
      : "";

    // Injecte les infos prestataire (Studio Settings) pour que l'agent
    // ait des VALEURS CONCRÈTES, pas des placeholders « [À compléter] ».
    const prestataire = `
## PRESTATAIRE (à utiliser tel quel dans les documents, NE JAMAIS mettre de placeholder)
- Nom : ${cfg.legal_name || "Mickael Romero"}
- Statut : ${cfg.legal_status || "Micro-entrepreneur — Entreprise Individuelle"}
- SIRET : ${cfg.siret || "(non renseigné)"}
- APE : ${cfg.ape_code || "74.20Z (Activités photographiques)"}
- Adresse : ${cfg.legal_address || "(non renseignée)"}${cfg.rcs_city ? " · RCS " + cfg.rcs_city : ""}
- Téléphone : ${cfg.public_phone || "(non renseigné)"}
- Email : ${cfg.notification_email || "romerophotography.contact@gmail.com"}
- Web : ${cfg.website || "romerophotography.fr"}
- TVA : non applicable — art. 293 B du CGI (franchise en base)`;

    const systemPrompt =
      effectivePrompt(inst) +
      prestataire +
      kbBlock +
      "\n\n## RAPPEL\nTu DOIS toujours appeler le tool structuré fourni. Jamais de texte libre. Utilise les infos PRESTATAIRE ci-dessus telles quelles — ne mets JAMAIS de placeholder « [À compléter] » : si une info manque vraiment, laisse le champ vide." +
      `\n\n## QUALITÉ RÉDACTIONNELLE (français impeccable, vocabulaire mariage)
- Accents obligatoires partout : é, è, à, ô, ç, ê… (préparatifs, cérémonie, séance, réservation).
- Vocabulaire métier correct : dis « préparatifs des mariés » (pas « préparation »), « séance d'engagement » (pas « séance engagement »), « vin d'honneur », « ouverture de bal », « cérémonie laïque ou religieuse ».
- Dans le champ "detail" de chaque ligne, rédige des puces courtes séparées par des retours à la ligne, chacune commençant par une majuscule, sans point final, formulées de façon homogène. Exemple :
  Préparatifs des mariés
  Cérémonie civile et cérémonie laïque ou religieuse
  Photos de couple et de groupe
  Vin d'honneur
  Ouverture de bal
  Galerie privée en ligne
  Retouches premium
- Les labels de ligne sont clairs et en toutes lettres (« Formule Prestige Éternel », « Séance d'engagement avant le mariage », « Second photographe »).`;

    const tool =
      input.kind === "quote"
        ? QUOTE_TOOL
        : input.kind === "contract"
        ? CONTRACT_TOOL
        : INVOICE_TOOL;

    const ep = getClaudeEndpoint({ userApiKey: cfg.anthropic_api_key || "", model: CLAUDE_MODEL });
    const resp = await fetch(ep.url, {
      method: "POST",
      headers: ep.headers,
      body: JSON.stringify({
        model: ep.model,
        max_tokens: 2048,
        system: cachedSystem(systemPrompt),
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
        messages: [
          {
            role: "user",
            content: `Voici le brief à structurer :\n\n"""\n${input.brief}\n"""`,
          },
        ],
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
        input?: Record<string, unknown>;
      }>;
    };
    const call = data.content?.find(
      (c) => c.type === "tool_use" && c.name === tool.name
    );
    if (!call?.input) {
      return { ok: false, error: "Claude n'a pas renvoyé la structure attendue" };
    }
    return { ok: true, data: call.input as unknown as QuoteExtraction | ContractExtraction | InvoiceExtraction };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
