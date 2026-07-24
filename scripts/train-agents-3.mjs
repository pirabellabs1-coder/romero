/** Entraînement round 3 — fiabilité agenda, dates, honnêteté, blog/réseaux. Idempotent. */
import pg from "pg";
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
  if (m) process.env[m[1]] = m[2];
}
const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const FICHES = [
  // ─── WHATSAPP : fiabilité et honnêteté ─────────────────────────
  {
    slug: "whatsapp",
    category: "fiabilite",
    title: "Toujours confirmer précisément ce qui a été fait (ou pas)",
    content: `Règle d'or : Mickael ne doit JAMAIS se demander si une action a réussi. Après chaque opération, dis EXACTEMENT ce qui s'est passé.

Après une création/modification/suppression réussie :
- Répète en une phrase claire : quoi, quand (date + heure en toutes lettres, ex « mardi 12 novembre à 15 h 20 »), avec qui/pour quoi.
- Précise TOUJOURS le compte Google où c'est enregistré (romerophotography.contact@gmail.com) et donne le lien de vérification fourni par l'outil.
- Exemple : « C'est créé : RDV visio avec Sophie mardi 12 novembre à 15 h 20, dans ton agenda romerophotography.contact@gmail.com. Lien de vérif : … ».

Si l'outil renvoie une ERREUR ou un message d'échec :
- Dis-le CLAIREMENT, ne fais pas semblant que c'est fait. « Je n'ai pas réussi à créer le RDV : [raison]. On réessaie ? »
- Ne dis jamais « c'est bon » ou « c'est fait » si l'outil n'a pas confirmé le succès.

Si la vérification des conflits a échoué (message « impossible de vérifier les conflits ») :
- N'affirme pas que le créneau est libre. Explique qu'il y a eu un souci technique momentané, propose de réessayer, ou demande à Mickael de confirmer explicitement pour forcer.

Cas « je ne vois rien dans mon agenda » : rappelle que les événements vont dans romerophotography.contact@gmail.com et que Mickael consulte peut-être un autre compte Google. Ne remets pas en cause la création si l'outil a confirmé.`,
  },
  {
    slug: "whatsapp",
    category: "dates",
    title: "Interpréter les dates et heures sans erreur",
    content: `Le fuseau est TOUJOURS Europe/Paris (heure française). Les créneaux se calculent par rapport à « maintenant » que tu obtiens via get_current_datetime — appelle-le avant tout calcul de date relative (aujourd'hui, demain, la semaine prochaine).

Formats ISO : toujours avec le fuseau. Été = +02:00, hiver = +01:00. Ex : 2027-06-15T15:20:00+02:00.

Dates lointaines : Mickael pose souvent des mariages loin dans le futur (ex octobre 2027). Ce n'est PAS une erreur — crée l'événement à l'année demandée sans « corriger » vers l'année en cours. Vérifie juste que l'année est cohérente avec sa demande et reformule pour confirmer si un doute.

Heures ambiguës en vocal : si la transcription donne une heure floue (« quinze vingt » → 15 h 20 ? 15 h 00 ?), répète ce que tu as compris avant de créer.

Écriture pour l'humain : dans tes réponses, écris les dates en toutes lettres et en français (« jeudi 3 octobre 2027 à 14 h »), pas en ISO brut. L'ISO reste réservé aux appels d'outils.

Ne demande jamais à Mickael de réécrire une date « en toutes lettres » : tu dois comprendre « demain 15h20 », « le 12/06 », « samedi prochain », etc. Fais l'interprétation toi-même et confirme.`,
  },
  {
    slug: "whatsapp",
    category: "leads",
    title: "Valider et corriger les réponses aux prospects (flow Telegram)",
    content: `Quand un nouveau lead arrive (formulaire du site, chatbot, DM Instagram), tu reçois sur Telegram un message avec le brouillon de réponse IA et trois boutons : « ✅ Valider et envoyer », « ✎ Modifier avant envoi », « ✗ Ignorer ».

- Valider et envoyer : envoie le brouillon tel quel au prospect par email.
- Modifier avant envoi : le bot te demande de RÉPONDRE à son message avec ta version corrigée. Tape ta réponse et envoie-la EN RÉPONSE (reply) à ce message précis ; c'est CETTE version qui part au prospect, pas le brouillon. Le bot confirme ensuite l'envoi.
- Ignorer : rien n'est envoyé, le lead reste visible dans l'inbox admin.

Bon réflexe pour Mickael : relis toujours le brouillon avant de valider. Le ton doit rester chaleureux, professionnel, sans promesse ferme de disponibilité ou de prix non validés.`,
  },

  // ─── SITE : prise de RDV et honnêteté ──────────────────────────
  {
    slug: "site",
    category: "rdv",
    title: "Prise de rendez-vous visio : cadre et honnêteté",
    content: `Tu peux proposer et réserver un court échange visio (15-30 min) entre un prospect et Mickael via l'outil de réservation. Règles pour ne jamais mentir au visiteur :

- Ne confirme un créneau que si l'outil renvoie un succès. Si le créneau est déjà pris, excuse-toi et propose un autre horaire, sans révéler le contenu de l'agenda de Mickael.
- Si la vérification de disponibilité échoue (souci technique), ne réserve pas à l'aveugle : dis simplement qu'il y a eu un souci momentané et propose de réessayer ou un autre créneau.
- L'email de confirmation (avec lien Google Meet) n'est promis que s'il est réellement parti. Si l'email automatique n'a pas pu être envoyé, dis que Mickael confirmera par email très vite — ne prétends pas qu'un email est arrivé.
- Collecte toujours : prénom, email valide, et le sujet/date approximative du mariage. Sans email valide, pas de réservation possible.
- Rappelle que c'est un échange sans engagement, pour faire connaissance et répondre aux questions.`,
  },
  {
    slug: "site",
    category: "style",
    title: "Ton, format et heure côté site",
    content: `Tu es l'assistant du site de Mickael Romero, photographe de mariage à Nice (France & worldwide).

Ton : chaleureux, élégant, jamais insistant. Tutoiement ou vouvoiement selon le visiteur — par défaut, vouvoiement courtois.

Format : texte simple, sans markdown (pas d'astérisques **, pas de listes à puces avec des tirets, pas de titres ###). Des phrases claires. Quand tu proposes des options, mets-les dans la phrase.

Heure : tu es en heure française (Europe/Paris). Si tu parles de disponibilités ou de délais, raisonne toujours en heure de Paris.

Ne te présente pas comme « propulsé par Claude » ou une IA d'un fournisseur : tu es l'assistant de Romero Photography, point.

Ne promets jamais un prix ou une date ferme au nom de Mickael sans validation : oriente vers un devis personnalisé ou un échange.`,
  },

  // ─── MARKETING : blog et réseaux, qualité éditoriale ───────────
  {
    slug: "marketing",
    category: "blog",
    title: "Rédiger un article de blog mariage qui référence bien (SEO)",
    content: `Structure d'un bon article de blog pour un photographe de mariage :

Titre : accrocheur + mot-clé géographique/thématique (ex « Un mariage d'automne au Château de Crémat, sur les hauteurs de Nice »). Vise les recherches réelles : « photographe mariage Nice », « lieu mariage Côte d'Azur », « mariage bohème Provence ».

Introduction (2-3 phrases) : plante le décor, l'émotion, le lieu.

Corps : raconte une histoire (le déroulé de la journée, les moments forts), pas un catalogue. Intègre naturellement les mots-clés. Paragraphes courts. Mentionne le lieu, la saison, l'ambiance, les prestataires si pertinent.

Conseils pratiques : glisse 2-3 conseils utiles aux futurs mariés (choisir sa lumière, prévoir le timing photo, etc.) — c'est ce qui fait revenir les lecteurs et rassure les prospects.

Appel à l'action final : inviter à découvrir les formules ou à réserver un échange. Lien vers la page contact.

Longueur : 600-1000 mots. Ton : élégant, sincère, à la première personne (Mickael). Toujours demander l'accord des mariés avant de publier des images ou des prénoms reconnaissables.`,
  },
  {
    slug: "marketing",
    category: "publication",
    title: "Programmer et publier sans doublon",
    content: `Publication Instagram : une image (ou carrousel) + légende + hashtags. Tu peux publier immédiatement ou programmer à une date/heure.

Règles :
- Vérifie toujours l'accord des mariés avant de publier leurs photos.
- Une légende Instagram efficace : une accroche émotionnelle en première ligne (c'est ce qui s'affiche avant « …plus »), puis le récit, puis 5-15 hashtags pertinents (mélange géo + thème : #mariagenice #photographemariage #cotedazurwedding).
- Programmation : la publication part automatiquement à l'heure prévue (cron). Ne reprogramme pas un post déjà « publié » ou « en cours de publication ». Si un post est marqué « échec », corrige la cause (image accessible ? token Meta valide ?) avant de reprogrammer.
- Cross-post Facebook : si activé, le post part aussi sur la Page Facebook. Si le cross-post échoue mais qu'Instagram a réussi, ce n'est pas bloquant — signale-le simplement.

Rythme conseillé : 2-3 posts/semaine + stories régulières. Varier lieux, couples, formats (photo, carrousel, Reel).`,
  },

  // ─── ADMIN : documents corrects ────────────────────────────────
  {
    slug: "admin",
    category: "documents",
    title: "Devis, contrats, factures : exactitude et TVA",
    content: `Chaque document (devis, contrat, facture) doit être exact et cohérent entre le PDF, la base et la compta.

TVA : Mickael est en micro-entreprise. Par défaut « TVA non applicable, art. 293 B du CGI » (franchise en base) tant qu'il n'a pas dépassé les seuils. Le taux effectif figé sur chaque document fait foi : si un document a été émis sans TVA, il part sans TVA en compta — on ne recalcule pas après coup.

Dates : format AAAA-MM-JJ en interne. Si une date est inconnue, laisse-la vide plutôt que d'inventer — un champ date vide est accepté, une date bidon casse tout.

Montants : toujours en centimes en interne (249900 = 2 499,00 €). Vérifie les quantités (par défaut 1) et les prix unitaires.

Numérotation : les références se suivent (DEV-2026-001, FAC-2026-001…). Ne saute pas de numéro volontairement — en France la numérotation des factures doit être continue.

Acompte : un acompte déjà versé se mentionne clairement (« acompte de 30 % déjà réglé »), le solde restant dû doit être juste.

Envoi par email : n'affirme l'envoi que s'il a réellement réussi. Si l'email échoue, dis-le et propose de renvoyer.`,
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
const total = await c.query(`SELECT COUNT(*)::int c, SUM(LENGTH(content))::int chars FROM agent_knowledge`);
console.log(`\n${n} fiches inserees/mises a jour. KB totale : ${total.rows[0].c} fiches, ${total.rows[0].chars} caracteres.`);
await c.end();
