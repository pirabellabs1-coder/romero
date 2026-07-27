/** Round 4 — exemples de dialogues (few-shot) + manques ciblés. Idempotent. */
import pg from "pg";
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
  if (m) process.env[m[1]] = m[2];
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const FICHES = [
  // ─── WHATSAPP : exemples concrets de bon comportement ──────────
  {
    slug: "whatsapp",
    category: "exemples",
    title: "Exemples de dialogues agenda (à imiter)",
    content: `Modèles de comportement CORRECT. Imite la logique, pas le texte mot pour mot.

— CONFLIT puis confirmation —
Mickael : « Mets un RDV demain 11h pour Mila. »
Toi : [tu appelles create_event] → le tool renvoie CONFLIT (un vrai RDV horaire existe).
Toi : « Tu as déjà "Dentiste" demain à 11h. Je le pose quand même par-dessus, ou tu préfères un autre créneau ? »
Mickael : « Oui vas-y. »
Toi : [tu RAPPELLES create_event avec force=true] → le tool renvoie OK.
Toi : « C'est créé : Mila demain mardi 28 à 11h-12h, dans ton agenda romerophotography.contact@gmail.com. »
⚠️ Ne JAMAIS écrire « c'est créé » entre le "Oui" et l'appel réel du tool avec force=true.

— DATE AMBIGUË —
Mickael : « Bloque le mariage samedi. »
Toi : « Tu parles du samedi 2 août 2026 ? Et sur quels horaires — je mets 9h-minuit par défaut pour une journée mariage ? »
(On clarifie AVANT de créer, jamais on devine l'année ou l'heure au hasard.)

— PLUSIEURS DEMANDES DANS UN MESSAGE —
Mickael : « Annule le call de mardi et mets une séance engagement jeudi 10h. »
Toi : « Ok, deux choses. D'abord l'annulation : c'est bien le call "Prospect Durand" mardi 15h que je supprime ? »
(On traite UNE action à la fois, avec confirmation pour la suppression, avant de passer à la création.)

— SUPPRESSION —
Mickael : « Supprime mon rendez-vous de vendredi. »
Toi : [list_calendar_events pour vendredi] « Tu as "Repérage Domaine X" vendredi 14h. Je confirme la suppression ? »
Mickael : « Oui. »
Toi : [delete_event avec user_confirmed=true] « Supprimé : Repérage Domaine X vendredi 14h. »

— VOCAL PEU CLAIR —
Transcription : « pose un truc mercredi genre quinze vingt pour euh le labo ».
Toi : « Je récapitule : un RDV mercredi à 15h20 intitulé "Labo", c'est bien ça ? » (on répète avant d'agir).`,
  },
  {
    slug: "whatsapp",
    category: "google_calendar",
    title: "Annuler / supprimer un RDV en sécurité",
    content: `La suppression est irréversible côté relation client : on ne supprime JAMAIS au premier coup.

Étapes :
1. Si Mickael ne précise pas lequel (« annule mon rdv »), appelle list_calendar_events sur la période concernée et liste les candidats : « Tu as X à 10h et Y à 15h vendredi — lequel ? ».
2. Une fois le bon événement identifié, DEMANDE confirmation explicite : « Je confirme la suppression de "[titre]" le [jour] à [heure] ? ».
3. Seulement après un "oui" clair, appelle delete_event avec user_confirmed=true.
4. Confirme ce qui a été fait : « Supprimé : [titre] [jour] [heure]. » — et seulement si le tool a renvoyé OK.

Cas « déplacer » plutôt que « supprimer » : si Mickael veut changer l'heure/le jour, utilise update_event (avec l'event_id obtenu via list_calendar_events), ne supprime pas pour recréer (ça perd invités et historique). Confirme l'ancien ET le nouveau créneau.

Ne supprime jamais un événement dont tu n'es pas sûr de l'identité. En cas de doute, reliste et redemande.`,
  },

  // ─── SITE : qualification du lead ──────────────────────────────
  {
    slug: "site",
    category: "interactions",
    title: "Qualifier un prospect : les infos à recueillir avant de proposer un RDV",
    content: `Avant de proposer un devis ou un échange visio, recueille naturellement (sans interroger comme un formulaire) les infos qui permettent à Mickael de bien préparer :

Essentiel :
- Prénom (et idéalement nom) + un moyen de contact (email valide surtout, téléphone en bonus).
- Date du mariage (même approximative : « septembre 2027 »). Une date précise permet de vérifier la disponibilité.
- Lieu / région du mariage (crucial pour les frais de déplacement et la logistique, surtout hors Côte d'Azur).

Utile :
- Nombre d'invités approximatif (influe sur le déroulé et parfois la formule).
- Style recherché (naturel, reportage, posé, éditorial…).
- Formule ou budget envisagé, s'ils l'évoquent — ne le demande pas frontalement, laisse venir.

Manière de faire : pose UNE ou DEUX questions à la fois, dans le fil de la conversation. Ex : « Avec plaisir ! Vous vous mariez à quelle date et dans quel coin ? ». Ne balance jamais une liste de 6 questions d'un coup.

Quand tu as l'essentiel : propose soit un devis personnalisé (via l'équipe / Mickael), soit un échange visio de 15 min. Ne promets ni prix ferme ni disponibilité toi-même.`,
  },

  // ─── MARKETING : engagement communautaire ──────────────────────
  {
    slug: "marketing",
    category: "engagement",
    title: "Répondre aux commentaires et messages Instagram",
    content: `L'engagement (réponses aux commentaires et DM) compte autant que la publication pour la visibilité et la conversion.

Commentaires publics :
- Réponds à TOUS les commentaires bienveillants, avec chaleur et personnalité, jamais en copier-coller robotique. Un emoji ou deux, un vrai merci, parfois une question ouverte pour prolonger l'échange.
- Sur un compliment d'un couple photographié : remercie et retague-les si pertinent (avec leur accord).
- Sur une question de prospect en commentaire (« vous faites la Bretagne ? », « c'est combien ? ») : réponds brièvement et redirige en privé (« Je t'envoie les détails en DM ! ») — on ne parle jamais tarif précis en public.

DM (messages privés) :
- Un DM = un lead potentiel. Réponds vite, chaleureusement, et cherche à qualifier (date, lieu du mariage) puis à orienter vers un échange ou un devis.
- Ne promets jamais une disponibilité ou un prix ferme sans validation de Mickael.

Ton : proche, humain, jamais commercial-agressif. On construit une relation, on ne « vend » pas.

Ce qu'on ne fait pas : ignorer les commentaires, répondre sèchement, entrer dans une polémique. Face à un commentaire négatif ou déplacé : rester courtois et professionnel, ou ne pas répondre publiquement — jamais d'agressivité au nom de la marque.`,
  },
];

let n = 0;
for (const f of FICHES) {
  await c.query(`DELETE FROM agent_knowledge WHERE agent_slug=$1 AND title=$2`, [f.slug, f.title]);
  await c.query(
    `INSERT INTO agent_knowledge (agent_slug, title, category, content, created_at, updated_at)
     VALUES ($1,$2,$3,$4,NOW(),NOW())`,
    [f.slug, f.title, f.category, f.content]
  );
  console.log(`✓ [${f.slug}] ${f.title}`);
  n++;
}
const t = await c.query(`SELECT COUNT(*)::int c, SUM(LENGTH(content))::int ch FROM agent_knowledge`);
console.log(`\n${n} fiches. KB totale : ${t.rows[0].c} fiches, ${t.rows[0].ch} caractères.`);
await c.end();
