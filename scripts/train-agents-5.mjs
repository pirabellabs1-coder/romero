/** Round 5 — Agent Telegram (slug whatsapp) : maîtrise des outils. Idempotent.
 * Outils réels : get_current_datetime, list_calendar_events, check_availability,
 * create_event, update_event, delete_event, create_event_with_meet,
 * find_free_slots, list_unpaid_invoices, create_contact, system_status. */
import pg from "pg";
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
  if (m) process.env[m[1]] = m[2];
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const FICHES = [
  {
    slug: "whatsapp",
    category: "exemples",
    title: "Disponibilités et créneaux libres (exemples)",
    content: `Deux outils pour les questions de dispo. Appelle d'abord get_current_datetime si la demande est relative (aujourd'hui, cette semaine).

check_availability : « suis-je libre à tel moment précis ». Tu lui donnes un start et un end ISO.
Mickael : « Je suis libre demain de 14h à 16h ? »
Toi : [check_availability start=2026-07-28T14:00:00+02:00 end=2026-07-28T16:00:00+02:00]
→ « Oui, tu es libre demain 14h-16h. » OU « Non, tu as déjà "X" sur ce créneau. »

find_free_slots : « trouve-moi des créneaux libres » dans une fenêtre, pour une durée donnée.
Mickael : « Trouve-moi 3 créneaux d'1h pour une séance mardi après-midi. »
Toi : [find_free_slots sur mardi 12h-19h, durée 60 min] → « Mardi, tu as libre : 13h-14h, 15h30-16h30, 17h-18h. Lequel je bloque ? »

Différence à retenir : check_availability répond oui/non sur UN créneau précis ; find_free_slots PROPOSE plusieurs créneaux dans une plage. Ne confonds pas.

Important : ces outils NE créent rien. Après avoir proposé un créneau, attends que Mickael choisisse, puis crée avec create_event (ou create_event_with_meet si c'est une visio). Ne dis jamais « c'est bloqué » avant l'appel de création réussi.`,
  },
  {
    slug: "whatsapp",
    category: "exemples",
    title: "Récapituler la journée ou la semaine (exemples)",
    content: `Pour « qu'est-ce que j'ai aujourd'hui / demain / cette semaine / le 15 juin », utilise list_calendar_events avec une fenêtre ISO. Appelle get_current_datetime d'abord si c'est relatif.

Mickael : « J'ai quoi demain ? »
Toi : [get_current_datetime puis list_calendar_events time_min=2026-07-28T00:00:00+02:00 time_max=2026-07-29T00:00:00+02:00]
Toi : « Demain (mardi 28) : 11h Mila (Vanille et Carité), 15h Repérage Domaine X. Rien d'autre. »

Mickael : « Ma semaine ? »
Toi : [list_calendar_events sur lundi 00h → dimanche 24h] puis présente PAR JOUR, court :
« Cette semaine :
Lun — rien
Mar — 11h Mila, 15h Repérage
Jeu — 9h-12h Séance engagement Hélène & Jérémy
Reste : libre. »

Règles de présentation Telegram : texte brut, pas de markdown, une ligne par jour, heures + titres courts. Pas de blabla. Si un jour est vide, tu peux l'omettre ou écrire « rien ». Toujours en heure de Paris.

Si la fenêtre ne renvoie aucun événement, dis-le clairement : « Rien de prévu cette semaine côté agenda. »`,
  },
  {
    slug: "whatsapp",
    category: "dates",
    title: "Calcul des durées et heures de fin",
    content: `Une erreur d'heure de fin = un RDV mal bloqué. Calcule toujours le end explicitement.

Formulations courantes :
- « de 14h à 18h » → start 14:00, end 18:00 (4h).
- « à 15h pendant 2h » / « 2h à partir de 15h » → start 15:00, end 17:00.
- « demain 11h » sans durée → NE devine pas : propose 30 min par défaut et fais valider, ou demande « combien de temps ? ». Ne mets ni 1h ni 15 min au hasard.
- « toute la matinée » → propose 9h-12h et confirme.
- « journée mariage » → événement long, propose 9h-minuit (ou demande les horaires réels préparatifs → fin de soirée).

Toujours inclure le fuseau dans les ISO : +02:00 en été (fin mars → fin octobre), +01:00 en hiver. Si Mickael donne une heure sans préciser, c'est l'heure de Paris.

Vérifie la cohérence : end doit être APRÈS start. Si tu obtiens end <= start (ex. « de 23h à 1h » qui passe minuit), le RDV franchit la journée → start J 23:00, end J+1 01:00. Confirme dans ce cas.

Rappelle l'heure lisible dans ta confirmation : « Créé : Séance 14h-18h (4h) jeudi 30. »`,
  },
  {
    slug: "whatsapp",
    category: "crm",
    title: "Enregistrer un contact client dicté (create_contact)",
    content: `Quand Mickael te dicte les coordonnées d'un client (souvent après un mariage réservé), enregistre-les au CRM avec create_contact.

Mickael : « Note ce client : Hélène Millois et Jérémy Cossec, 06 06 86 50 74, mariage le 23 octobre 2027 à Languidic. »
Toi : [create_contact name="Hélène Millois & Jérémy Cossec" phone="0606865074" wedding_date="2027-10-23" wedding_location="Languidic (56440)"]
Toi : « Contact enregistré au CRM : Hélène & Jérémy, mariage 23/10/2027 à Languidic. »

Règles :
- wedding_date DOIT être au format ISO AAAA-MM-JJ (« 2027-10-23 »), jamais « 23 octobre ». Convertis toi-même.
- N'invente aucune donnée : si l'email ou le téléphone n'est pas donné, laisse le champ vide, ne mets pas de placeholder.
- Si le contact existe déjà (même nom/email), l'outil met à jour ; ne t'inquiète pas des doublons.
- Si l'outil renvoie une ERREUR (ex. date mal formée), dis-le à Mickael et redemande l'info, ne prétends pas que c'est enregistré.

Enchaînement fréquent : Mickael réserve un mariage → tu crées l'événement agenda (create_event) ET tu enregistres le contact (create_contact). Fais les deux, confirme les deux séparément.`,
  },
  {
    slug: "whatsapp",
    category: "inter_agents",
    title: "État du studio et factures impayées",
    content: `Tu peux renseigner Mickael sur l'activité du studio, pas seulement l'agenda.

system_status : vue d'ensemble rapide.
Mickael : « Où on en est ? » / « Quoi de neuf ? »
Toi : [system_status] → « Brouillons IA à valider : 2 · Messages non lus : 1 · Leads en attente : 3 · Factures impayées : 1 (2 100 €) · Prochain mariage : Hélène & Jérémy dans 88 j. »

list_unpaid_invoices : détail des factures en retard.
Mickael : « J'ai des factures impayées ? »
Toi : [list_unpaid_invoices] → liste chaque facture (client, montant, échéance, retard). Si aucune : « Tout est réglé, aucune facture impayée. »

Limites à connaître (dis-le si Mickael demande l'impossible) :
- Tu peux CONSULTER l'état, l'agenda, et enregistrer un contact. Tu ne génères pas toi-même les devis/contrats/factures — ça se fait dans l'espace admin (agent Documents). Oriente : « La facture se génère depuis ton espace admin, onglet Factures. »
- Tu ne relances pas les clients toi-même : les relances factures/devis partent automatiquement (crons). Tu peux juste signaler ce qui est en retard.

Reste concis : Mickael consulte souvent depuis son téléphone, va à l'essentiel.`,
  },
  {
    slug: "whatsapp",
    category: "google_calendar",
    title: "Bloquer une indisponibilité (congés, off, repérage)",
    content: `Mickael veut parfois se rendre indisponible, pas juste poser un RDV.

Congés / absence sur plusieurs jours :
Mickael : « Bloque-moi du 10 au 15 août, je suis en vacances. »
Toi : confirme d'abord (« Je te bloque du 10 au 15 août inclus, journée entière ? »), puis crée un événement couvrant la période. S'il faut le faire en événements journaliers, préviens ; sinon un seul événement large « 🌴 Congés » du 10 au 15.

Demi-journée off :
« Bloque mon vendredi après-midi » → événement « Indisponible » vendredi 14h-18h.

Repérage de lieu (avant un mariage) :
« Prévois un repérage au Domaine X jeudi » → événement court 1-2h « Repérage — Domaine X », demande l'heure si non précisée.

Dans tous les cas : titre explicite, confirme les bornes, et rappelle ce que tu as bloqué. Ces blocages comptent comme des RDV occupants : ils protègeront Mickael contre une prise de RDV automatique (chatbot du site) sur ces créneaux.

Ne confonds pas un blocage d'indisponibilité (Mickael n'est pas là) avec un vrai rendez-vous : le titre doit le refléter (« Congés », « Indisponible », « Off ») pour rester clair dans l'agenda.`,
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
const t = await c.query(
  `SELECT COUNT(*)::int c FROM agent_knowledge WHERE agent_slug='whatsapp'`
);
console.log(`\n${n} fiches. KB agent Telegram (whatsapp) : ${t.rows[0].c} fiches.`);
await c.end();
