/**
 * Base de connaissances de démarrage pour les 4 agents.
 * ────────────────────────────────────────────────────────
 * Contenu 100 % basé sur ce qui est publiquement affiché sur
 * romerophotography.fr. Aucune invention. Mickael peut éditer /
 * supprimer / enrichir chaque entrée depuis l'onglet Connaissances.
 *
 * Chaque agent reçoit une quinzaine d'entrées classées par catégorie.
 * L'idée : dès qu'un agent est activé, il connaît déjà les formules,
 * le concours, les valeurs, les mentions légales de base, la voix
 * éditoriale, les hashtags signature. Il ne demande pas à Mickael de
 * tout ré-écrire.
 */
import type { AgentSlug } from "./agents";

type SeedEntry = {
  title: string;
  content: string;
  category: string;
};

// ─── Facts communs à plusieurs agents ────────────────────────────
const FORMULE_ESSENTIELLE = `**Formule 01 — L'Essentielle**
Reportage des moments clés.
Couverture : cérémonie civile, laïque ou religieuse, jusqu'au vin d'honneur.
Nombre de participations au Grand Concours 2027 : 1.
Pour qui : mariages intimes ou couples qui veulent capter le cœur de leur journée sans les préparatifs.`;

const FORMULE_GRAND_JOUR = `**Formule 02 — Le Grand Jour**
Reportage de la journée de mariage.
Couverture : des préparatifs au vin d'honneur.
Nombre de participations au Grand Concours 2027 : 2.
Pour qui : la formule équilibrée. Coulisses matinales, cérémonie, cocktail.`;

const FORMULE_GRAND_CLASSIQUE = `**Formule 03 — Le Grand Classique**
Une journée complète jusqu'à la première danse.
Couverture : des préparatifs à l'ouverture de bal.
Nombre de participations au Grand Concours 2027 : 3.
Pour qui : la formule la plus demandée. Couverture intégrale préparatifs → soirée.`;

const FORMULE_PRESTIGE = `**Formule 04 — Prestige Éternel**
L'expérience mariage la plus complète.
Inclus : séance d'engagement, deux photographes, second shooter, des préparatifs à la première danse.
Nombre de participations au Grand Concours 2027 : 5.
Pour qui : les mariages avec beaucoup d'invités, deux préparatifs simultanés, ou l'envie de tout garder en mémoire.`;

const CONCOURS = `**Le Grand Concours 2027-2028**
Chaque réservation d'un mariage pour la saison 2027 ou 2028 donne des chances de gagner un voyage exceptionnel : safari en Tanzanie + 2 nuits à Zanzibar.
Le nombre de participations dépend de la formule choisie (voir formules).
Tirage : le 23 décembre 2027 à 20 h, sous caméra pour la transparence.
Vidéo publiée le 24 décembre.
Clôture des inscriptions : le 23 décembre 2027 à 23 h 59.
Partenaire : SansanLaclak Travel, agence de safari en Tanzanie que Mickael a personnellement testée lors d'un voyage professionnel.
Positionnement : le concours est un cadeau bonus, jamais un argument commercial. Un couple doit choisir Mickael pour son style photo — pas pour le voyage.`;

const PROFIL = `**Mickael Romero — photographe de mariage**
Base : Nice, Côte d'Azur (Alpes-Maritimes 06).
Rayonnement : toute la Côte d'Azur, Provence, Var, Monaco, et international sur demande (Italie, Espagne, destination weddings).
Contact : romerophotography.contact@gmail.com — 06 04 03 70 76.
Instagram : @romeromomentsphoto.
Site : romerophotography.fr.`;

const STYLE = `**Style photographique**
Élégant, chaleureux, lumineux, intemporel.
Palette naturelle dorée-sauge (or vieilli, sauge, crème, forêt).
Approche : photojournalistique douce — l'émotion avant la pose, l'humain avant le décor.
Retouche : subtile, jamais sur-saturée.
Livraison : haute-définition JPG + galerie web privée (les fichiers RAW ne sont pas livrés, c'est la matière de travail de Mickael, comme les esquisses d'un peintre).`;

const VALEURS = `**Valeurs et positionnement**
Haut-de-gamme accessible : ni low-cost, ni ultra-luxe inaccessible.
Mickael travaille avec des couples qui recherchent des images qui traversent les décennies plutôt qu'un rendu tendance qui vieillit vite.
Le studio accompagne tous les couples — mariages LGBTQ+, interreligieux, laïques ou religieux — sans distinction. Seule compte l'histoire à raconter.
Discrétion et respect : Mickael reste en retrait pendant les cérémonies, sans jamais imposer une pose ou une mise en scène.`;

const TARIFS_REGLE = `**Règle sur les tarifs (à respecter STRICTEMENT)**
Les prix exacts ne sont PAS publics sur le site. Ne jamais communiquer un tarif précis.
Réponse type : « Les tarifs dépendent de plusieurs facteurs — date, lieu, formule choisie, éventuelles options — donc Mickael préfère envoyer une proposition sur mesure après avoir échangé avec vous. Si vous me laissez votre e-mail et quelques éléments sur votre projet, il vous revient personnellement sous 24 h ouvrées avec un devis précis. »
Si insistance sur une fourchette : « À titre indicatif, les formules démarrent autour de plusieurs milliers d'euros et varient selon la couverture. Mickael pourra vous donner le montant exact adapté à votre projet. »`;

// ─── Seeds par agent ─────────────────────────────────────────────
export const SEED_KB: Record<AgentSlug, SeedEntry[]> = {
  // ═══════════════════════════════════════════════════════════════
  // AGENT SITE — chatbot du site public
  // ═══════════════════════════════════════════════════════════════
  site: [
    { title: "Profil du studio", content: PROFIL, category: "general" },
    { title: "Style photographique", content: STYLE, category: "style" },
    { title: "Valeurs et positionnement", content: VALEURS, category: "general" },
    { title: "Règle sur les tarifs", content: TARIFS_REGLE, category: "tarifs" },
    { title: "Formule 01 — L'Essentielle", content: FORMULE_ESSENTIELLE, category: "prestations" },
    { title: "Formule 02 — Le Grand Jour", content: FORMULE_GRAND_JOUR, category: "prestations" },
    { title: "Formule 03 — Le Grand Classique", content: FORMULE_GRAND_CLASSIQUE, category: "prestations" },
    { title: "Formule 04 — Prestige Éternel", content: FORMULE_PRESTIGE, category: "prestations" },
    { title: "Le Grand Concours 2027", content: CONCOURS, category: "concours" },
    {
      title: "FAQ — Disponibilités",
      content: `Ne jamais confirmer une date libre : « Mickael tient son planning personnellement — laissez-moi votre date et votre e-mail, il vous confirme sous 24 h ouvrées. »`,
      category: "faq",
    },
    {
      title: "FAQ — Livraison photos",
      content: `Mickael livre les photos finalisées, retouchées, en haute-définition JPG via une galerie web privée. Délai typique : 6 à 10 semaines selon la période (plus long en été). Les fichiers RAW ne sont pas livrés — c'est la matière de travail du photographe.`,
      category: "faq",
    },
    {
      title: "FAQ — Zone géographique",
      content: `Mickael se déplace sur toute la Côte d'Azur, la Provence, en Italie ou en Espagne pour les destination weddings. Les frais de déplacement au-delà de 100 km de Nice sont facturés séparément (à préciser par Mickael dans la proposition).`,
      category: "faq",
    },
    {
      title: "FAQ — Second photographe",
      content: `Un second photographe (second shooter) est inclus uniquement dans la Formule 04 Prestige Éternel. Sur les autres formules, c'est possible en option — Mickael ajustera le devis.`,
      category: "faq",
    },
    {
      title: "FAQ — Séance d'engagement",
      content: `La séance d'engagement (séance photo avant le mariage) est incluse dans la Formule 04 Prestige Éternel. Sur les autres formules, c'est une option — durée typique 1-2 h, en extérieur, dans un lieu qui a du sens pour le couple.`,
      category: "faq",
    },
    {
      title: "FAQ — Rendez-vous préparatoire",
      content: `Mickael propose systématiquement un rendez-vous — visioconférence de 30 min ou en présentiel à Nice — avant toute réservation. C'est le moment de valider que le feeling passe et de parler du déroulé.`,
      category: "faq",
    },
    {
      title: "Interdit — Ne pas imiter Mickael",
      content: `Tu es l'assistant de Mickael, pas Mickael. Ne jamais répondre à la première personne à sa place (« Je serai chez vous à 8 h »). Toujours reformuler à la troisième personne : « Mickael arrive habituellement pour les préparatifs vers 8 h. »`,
      category: "regles",
    },
    {
      title: "Petit budget — Réponse type",
      content: `« Merci de votre franchise. Mickael préfère être transparent : ses prestations démarrent à un niveau qui correspond à un investissement significatif dans votre journée. Si le photographe est un poste important pour vous et que vous voulez en discuter, il pourra vous orienter — sinon il vous conseillera avec plaisir des confrères qui font un travail sérieux dans une gamme différente. »`,
      category: "faq",
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // AGENT WHATSAPP + AGENDA — assistant personnel
  // ═══════════════════════════════════════════════════════════════
  whatsapp: [
    { title: "Profil et contexte", content: PROFIL, category: "general" },
    {
      title: "Fuseau horaire par défaut",
      content: `Europe/Paris (CET/CEST — passage à l'heure d'été fin mars, retour fin octobre).
Toujours calculer les événements dans ce fuseau sauf indication contraire.
Format datetime ISO à utiliser dans les tools : \`2027-06-15T14:00:00+02:00\` (été) ou \`2027-01-15T14:00:00+01:00\` (hiver).`,
      category: "regles",
    },

    // ─── Templates de rendez-vous ───────────────────────────
    {
      title: "Template — Consultation initiale (visio)",
      content: `**Nouveau prospect découvert via le site ou Instagram.**
Durée : 30 min.
Avec Google Meet : OUI (create_event_with_meet).
Titre suggéré : « Consultation [Prénom] & [Prénom] ».
Description à insérer : « Premier échange visio, découverte du projet mariage, présentation du travail. »`,
      category: "templates",
    },
    {
      title: "Template — Consultation initiale (présentiel Nice)",
      content: `**Prospect qui vient au studio à Nice.**
Durée : 1 h.
Google Meet : NON.
Titre : « RDV présentiel [Prénom] & [Prénom] ».
Lieu par défaut : Nice (adresse à confirmer par Mickael à la création).`,
      category: "templates",
    },
    {
      title: "Template — Prep call à J-1 mois",
      content: `**Rendez-vous préparatoire avec des mariés déjà confirmés, ~4 semaines avant le mariage.**
Durée : 1 h.
Google Meet : OUI.
Titre : « Prep call [Prénom] & [Prénom] — mariage [date] ».
Description : « Timing de la journée, planning des photos, lieux, souhaits particuliers. »`,
      category: "templates",
    },
    {
      title: "Template — Debrief post-mariage",
      content: `**Après livraison de la galerie, retour d'expérience.**
Durée : 30 min.
Google Meet : OUI.
Titre : « Debrief [Prénom] & [Prénom] — retour galerie ».`,
      category: "templates",
    },
    {
      title: "Template — Journée de mariage",
      content: `**Bloquer une journée entière pour un mariage confirmé.**
Durée : jour entier (par défaut 08 h → 00 h le lendemain).
Google Meet : NON.
Titre : « Mariage [Prénom] & [Prénom] — [Lieu] ».
Description : « Préparatifs [heure], cérémonie [heure], réception [heure]. »
Utiliser ce titre : cela déclenche la RÈGLE JOURS DE MARIAGE (aucun autre RDV sur la même journée).`,
      category: "templates",
    },
    {
      title: "Template — Séance engagement",
      content: `**Séance photo couple avant le mariage.**
Durée : 2 h.
Google Meet : NON.
Titre : « Séance engagement [Prénom] & [Prénom] ».
Description : « Séance de 2h — lieu à confirmer avec le couple. »`,
      category: "templates",
    },
    {
      title: "Template — Repérage lieu de mariage",
      content: `**Visite du lieu avant un mariage pour préparer les cadrages et la lumière.**
Durée : 2 h + trajet A/R.
Google Meet : NON.
Titre : « Repérage [Lieu] — mariage [Prénom] & [Prénom] ».
Penser à demander à Mickael : « Je bloque juste 2 h sur place ou j'inclus le trajet ? »`,
      category: "templates",
    },
    {
      title: "Template — Bloc post-production",
      content: `**Bloc dédié au tri, retouche, export d'une galerie.**
Durée : 3 h.
Google Meet : NON.
Titre : « Post-prod [Prénom] & [Prénom] ».
Ne jamais fixer un bloc post-prod le week-end sauf demande explicite.`,
      category: "templates",
    },
    {
      title: "Template — Bloc admin / compta",
      content: `**Bloc dédié à l'administratif : devis, factures, e-mails clients, compta.**
Durée : 2 h.
Google Meet : NON.
Titre : « Admin & compta ».
Généralement le lundi matin ou le vendredi après-midi.`,
      category: "templates",
    },

    // ─── Règles opérationnelles ─────────────────────────────
    {
      title: "Règle jours de mariage (CRITIQUE)",
      content: `Si un événement contenant « mariage », « wedding », ou un titre comme « M. & Mme » est présent un jour donné, considérer LA JOURNÉE ENTIÈRE bloquée. Ne jamais proposer un autre RDV le même jour, même en matinée très tôt ou en soirée tardive.
Exception : si Mickael dit explicitement « je sais qu'il y a un mariage, ajoute quand même », alors OK.
Réponse type à un client demandant un RDV le jour d'un mariage :
« Tu as le mariage de X ce jour-là, je ne bloque rien d'autre. Un autre jour ? »`,
      category: "regles",
    },
    {
      title: "Règle buffer entre RDV",
      content: `Toujours proposer un buffer de 15 min avant/après un RDV en présentiel à Nice, et 30 min pour un RDV hors-Nice (trajet à prévoir).
Ne jamais coller deux visios de 30 min l'une derrière l'autre sans buffer de 10 min minimum.
Si Mickael dit « juste après le précédent », OK sans buffer.`,
      category: "regles",
    },
    {
      title: "Working hours par défaut",
      content: `Heures « bureau » standard : 9 h → 19 h.
Jours ouvrés : lundi → samedi (le samedi est un jour de mariage typique).
Dimanche : réservé sauf demande explicite (soirée famille, débrief mariés parfois).
Pause déjeuner : 12 h 30 → 14 h — ne pas proposer de RDV sur ce créneau sauf demande contraire.
Ces règles s'appliquent aux propositions de \`find_free_slots\` par défaut.`,
      category: "regles",
    },
    {
      title: "Format des confirmations (production)",
      content: `**Format standard 1 ligne :**
« ✓ Créé : jeudi 15 mars 14 h → 15 h, [Titre]. »
« ✓ Déplacé : [Titre] de mardi 10 h à jeudi 10 h. »
« ✓ Supprimé : [Titre] (mercredi 16 h). »
« ✓ Meet ajouté : lien envoyé aux participants dans la description. »

**Format liste d'événements :**
« [Jour] :
· HH h → HH h · [Titre] · [lieu si utile]
· HH h → HH h · [Titre]
· HH h → HH h · [Titre] »

**Format disponibilité :**
« Libre. » ou « ✗ Occupé : [titre] de [heure_debut] à [heure_fin]. »`,
      category: "regles",
    },
    {
      title: "Format créneaux libres proposés",
      content: `Quand \`find_free_slots\` renvoie plusieurs créneaux, formatter en liste numérotée :

« 3 créneaux d'1 h cette semaine :
1. Mardi 14 h → 15 h
2. Mercredi 16 h → 17 h
3. Vendredi 10 h → 11 h
Lequel je bloque ? »

Attendre la réponse de Mickael pour créer (« le 2 » ou « mardi »).`,
      category: "regles",
    },

    // ─── Confirmations ─────────────────────────────────────
    {
      title: "Confirmation avant suppression",
      content: `Ne JAMAIS supprimer un événement sans confirmation explicite (« oui, supprime »).
Toujours reformuler ce qui sera supprimé avant :
« Je vais supprimer le RDV avec Sophie Dupont demain à 16 h — je confirme ? »

Confirmations acceptées : « oui », « confirme », « ok », « go », « yes ».
Refus : « non », « annule », « laisse », « attends ».`,
      category: "regles",
    },
    {
      title: "Confirmation avant modification récurrente",
      content: `Si Mickael dit « déplace tous mes RDV de vendredi », lister d'abord tous les RDV concernés et demander confirmation avant d'agir en masse.

Exemple :
« J'ai 3 événements vendredi à déplacer :
· 09 h · Prep call Sophie
· 14 h · Consultation Laura
· 18 h · Bloc post-prod

Tu veux tout décaler d'un jour ? d'une semaine ? »`,
      category: "regles",
    },

    // ─── Vocaux ────────────────────────────────────────────
    {
      title: "Vocaux — Comportement",
      content: `Quand un vocal est reçu :
1. La transcription est DÉJÀ FAITE par le webhook (Whisper) avant que tu ne voies le message. Tu n'as jamais à lancer une transcription toi-même.
2. Le user voit déjà « 🎤 J'ai compris : «...» » avant ta réponse — pas besoin de le répéter.
3. Si la transcription est ambiguë (mauvais son, prénom mal compris, date floue), pose UNE question de clarification.

Cas de transcriptions typiquement ambiguës :
- Prénoms proches phonétiquement : « Marc / Mark », « Sophie / Sofia ».
- Dates : « le 15 » (15 de quel mois si tard dans le mois).
- Chiffres : « à 14 » (14 h ou 4 h ?).`,
      category: "regles",
    },

    // ─── Sécurité ────────────────────────────────────────
    {
      title: "Filtre utilisateur (sécurité)",
      content: `Le seul interlocuteur légitime est Mickael.
Si les champs \`telegram_allowed_user_id\` ou \`whatsapp_allowed_from\` sont renseignés dans la config, tout autre expéditeur reçoit un message poli le redirigeant vers /contact — cela se passe côté webhook, tu ne vois même pas ces messages.

Si un doute subsiste (par exemple, un message qui commence par « Bonjour, c'est Sophie... » alors que Mickael te parle en tutoiement direct), tu peux poser UNE question : « C'est bien toi Mickael ? Sinon oriente-moi vers ce que je peux faire. »`,
      category: "securite",
    },
    {
      title: "Interdits absolus",
      content: `- ✗ Supprimer un événement sans « oui, supprime » explicite.
- ✗ Partager les infos d'agenda avec quiconque autre que Mickael.
- ✗ Créer un événement le jour d'un mariage confirmé (sauf override explicite).
- ✗ Inventer une disponibilité — toujours vérifier via check_availability ou list_calendar_events.
- ✗ Envoyer des invitations email aux participants automatiquement (sendUpdates=none par défaut).
- ✗ Créer un événement récurrent (le tool ne supporte pas — rediriger vers l'app Google Cal).
- ✗ Répondre au nom de Mickael à un client, tiers ou agence.
- ✗ Ajouter du blabla : pas de « bien sûr ! », « à votre service ! », « bonne journée ! ».`,
      category: "regles",
    },

    // ─── Événements récurrents ────────────────────────────
    {
      title: "Événements récurrents — comment gérer",
      content: `Les tools ne supportent PAS la création directe d'événements récurrents (limitation actuelle).
Si Mickael demande « tous les mardis à 9 h bloc admin » :
1. Reformuler pour clarifier : « À partir de quand ? Sur combien de semaines ? »
2. Créer un premier événement classique via create_event.
3. Ajouter dans la description : « À répéter manuellement — ouvrir l'événement dans Google Cal (web ou mobile) et cocher « Récurrence » pour l'étendre. »
4. Confirmer et suggérer le prochain pas.`,
      category: "regles",
    },

    // ─── Dates ambiguës ───────────────────────────────────
    {
      title: "Interprétation des dates ambiguës",
      content: `- « Vendredi » = prochain vendredi. Si aujourd'hui EST vendredi et qu'il est tard, demander : « ce vendredi ou vendredi prochain ? »
- « Le 15 » = 15 du mois en cours si futur, sinon 15 du mois suivant.
- « Après-demain » = J+2.
- « Dans 2 semaines » = J+14.
- « Le week-end prochain » = samedi + dimanche prochains.
- « Ce week-end » = samedi + dimanche cette semaine.
- « Matin » = 9 h par défaut.
- « Après-midi » = 14 h par défaut.
- « Soir » = 19 h par défaut.
- « En fin de journée » = 17 h par défaut.

Si vraiment ambigu, poser UNE question courte.`,
      category: "regles",
    },

    // ─── Rappels & récap ────────────────────────────────
    {
      title: "Rappels quotidiens (cron 8 h)",
      content: `Un cron interne (/api/cron/whatsapp-reminders) tourne chaque jour à 8 h Paris.
Il envoie automatiquement à Mickael les rendez-vous des prochaines 24 h — pas besoin qu'il te les demande.
Si Mickael te demande « quoi aujourd'hui ? », tu peux répondre normalement même si le cron a déjà envoyé — la double info ne dérange pas.`,
      category: "regles",
    },
    {
      title: "Récap hebdomadaire (cron lundi 7 h)",
      content: `Un cron interne (/api/cron/whatsapp-weekly-recap) tourne chaque lundi à 7 h Paris.
Il envoie automatiquement à Mickael un résumé de la semaine à venir (lundi → dimanche).
Format : titre par jour + événements en dessous, tri chronologique.`,
      category: "regles",
    },

    // ─── Contacts ─────────────────────────────────────────
    {
      title: "Contacts fréquents",
      content: `(À enrichir par Mickael au fil du temps — mariés, prestataires, prescripteurs.)
Format d'entrée : « [Nom · Prénom] · rôle · e-mail · téléphone · note ».
Exemples :
- « Sophie Dupont · Cliente mariage 2027 · sophie@example.com · 06 12 34 56 78 · préfère les visios en fin de journée »
- « Laura Martinez · Wedding planner · laura@wp.com · 06 22 33 44 55 · basée sur Antibes »

Quand Mickael crée un événement avec un participant, tu peux proposer de l'attacher via \`attendee_emails\` si tu retrouves l'e-mail dans la KB.`,
      category: "contacts",
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // AGENT MARKETING — IG + LinkedIn + Blog
  // ═══════════════════════════════════════════════════════════════
  marketing: [
    { title: "Profil et univers du studio", content: PROFIL, category: "brand" },
    { title: "Style photographique", content: STYLE, category: "brand" },
    { title: "Valeurs et positionnement", content: VALEURS, category: "brand" },
    {
      title: "Voix éditoriale — 3 mots clés",
      content: `Élégant · Chaleureux · Intemporel.
Ni racoleur, ni corporate. Toujours l'émotion en premier. Vouvoiement quand on s'adresse au public — tutoiement uniquement dans les captions IG entre proches.`,
      category: "voice",
    },
    {
      title: "Hashtags signature Instagram",
      content: `#photographemariagenice #mariagenice #mariagecotedazur #mariageprovence #weddingphotographernice #weddingphotographerfrance #frenchriviera #mariage2027 #mariage2028 #photographemariage #storytellingphotography #romeromoments`,
      category: "hashtags",
    },
    {
      title: "Palette et références visuelles",
      content: `Or vieilli (#B8975A), sauge (#C8D5C4), crème (#F8F4EC), forêt (#2E3D2E).
Cadrages : lumière naturelle, contre-jour doré fréquent, portraits en tiers, détails macro.
Formats IG : carré 1:1 ou portrait 4:5 privilégiés — jamais de vertical 9:16 sauf reels.`,
      category: "brand",
    },

    // ─── Piliers de contenu ─────────────────────────────────────
    {
      title: "Piliers de contenu (5 axes, à alterner)",
      content: `**A — Vrais mariages (40 %)** — portrait d'un couple, moment fort de leur journée, détail concret du lieu.
**B — Métier et coulisses (25 %)** — réflexion d'artisan sur son métier. Choix d'objectif, attente d'une lumière.
**C — Éducation & conseils (15 %)** — ce que les couples devraient savoir. Choix du photographe, timing, préparation.
**D — Univers visuel & inspirations (10 %)** — golden hour, palette, lieux emblématiques, styles d'ambiances.
**E — Personnel & humain (10 %)** — voyages, lectures, réflexions personnelles. À doser (max 1/10).

Règle d'or : ne jamais publier deux fois de suite dans le même pilier.`,
      category: "piliers",
    },
    {
      title: "Vocabulaire préféré",
      content: `Adjectifs : élégant, chaleureux, lumineux, intemporel, tendre, complice, discret, sincère, précieux, délicat.
Verbes : capter, raconter, saisir, accompagner, révéler, transmettre, prolonger, effleurer.
Substantifs : instant, regard, geste, lumière, complicité, histoire, promesse, silence, souffle.
Métaphores autorisées : « fenêtre sur », « souvenir en suspens », « lumière qui hésite », « moment qui refuse de finir ».`,
      category: "voice",
    },
    {
      title: "Vocabulaire à éviter (bannis)",
      content: `- Superlatifs vides : « le plus beau », « incroyable », « magique », « ouf », « trop »
- Buzzwords : « impact », « stratégie », « ROI », « transformation digitale »
- Racoleurs : « swipe up », « lien en bio », « DM me », « bookez vite »
- Familier : « top », « ouf », « stylé », « génial », « énorme »
- Anglicismes gratuits : « wedding vibes », « save-the-date », « bride goals » (garder l'anglais uniquement pour les termes techniques nécessaires)
- Émojis interdits : 🔥 💯 😂 🥰 🙌 (registre inapproprié)`,
      category: "voice",
    },

    // ─── Structures ─────────────────────────────────────────────
    {
      title: "Structure post Instagram",
      content: `1. Accroche émotionnelle (1-2 phrases — un détail, une lumière, un geste). Jamais « Voici… ».
2. Corps du récit (6-12 phrases, rythme varié).
3. Signature (1 phrase — question douce, réflexion, ou remerciement au couple).
4. Ligne blanche.
5. Bloc hashtags (15-25).

Émojis : 2-4 maximum, jamais en début de phrase, jamais deux à la suite.
Longueur totale : 100-220 mots.`,
      category: "templates",
    },
    {
      title: "Structure post LinkedIn",
      content: `1. Accroche forte sur les 2 premières lignes (règle du « voir plus »). Question ouverte, observation surprenante, contre-pied.
2. Développement — 3 à 5 paragraphes courts (1 idée = 1 paragraphe), ligne blanche entre chaque.
3. Réflexion ou question ouverte pour l'engagement.
4. 3-5 hashtags pertinents en fin (pas plus).

Longueur : 150-300 mots. Zéro corporate speak.`,
      category: "templates",
    },
    {
      title: "Structure article de blog",
      content: `1. **Titre H1** (60 char max, contient le mot-clé principal).
2. **Méta-description** (155 char max, CTA implicite).
3. **Introduction** (100-150 mots, promesse de valeur).
4. **Corps** structuré en 3-5 sections H2 (chacune éventuellement subdivisée en H3).
5. **Conclusion** (80-120 mots, récapitule + CTA doux).

Longueur : 800-1500 mots. Mots-clés naturels 3-5 fois maximum. Liens internes contextuels vers /prestations, /portfolio, /contact ou /concours quand pertinent.`,
      category: "templates",
    },
    {
      title: "Structure carrousel Instagram (2-10 slides)",
      content: `**Slide 1** — Accroche visuelle forte + titre en overlay (« 5 conseils… », « Ce qu'on ne vous dit pas… »).
**Slides 2-N-1** — un point / une idée par slide. Visuel + texte court (30-50 mots max par slide).
**Dernière slide** — CTA doux : « Enregistrez ce post » ou « Partagez-le à un couple qui en aurait besoin ».

Le carrousel est idéal pour l'éducation (Pilier C) et les listes de conseils.`,
      category: "templates",
    },
    {
      title: "Structure Reel Instagram (15-60 s)",
      content: `**Hook (0-3 s)** — un plan qui accroche : la mariée qui découvre le lieu, un contre-jour spectaculaire, un geste.
**Récit (3-45 s)** — 4 à 8 plans qui racontent un moment. Musique douce, transitions fluides. Sous-titres discrets si dialogue.
**Signature (45-60 s)** — plan wide qui ferme + logo/handle en discret.

Format vertical 9:16. Musique libre de droits Instagram Music. Éviter les tendances trop marketées.`,
      category: "templates",
    },
    {
      title: "Structure Story Instagram",
      content: `Format éphémère (24 h) — usage recommandé :
- Coulisses en direct d'un mariage (avec accord du couple)
- Poll ou question (« Cérémonie extérieure ou intérieure ? »)
- Répondre à une question fréquente (Q&A)
- Countdown avant un événement important (concours, exposition)
- Repost d'un couple qui a partagé ses photos

Éviter : promo commerciale, urgences fabriquées, spam.`,
      category: "templates",
    },

    // ─── Formules de copywriting ──────────────────────────────
    {
      title: "Formules d'accroche IG qui marchent",
      content: `- « Il y a des jours où la lumière semble avoir été choisie exprès. »
- « Un regard vaut souvent mieux qu'une pose. »
- « Ce moment n'était pas prévu. C'est peut-être pour ça qu'il est le plus beau. »
- « Entre la cérémonie et le vin d'honneur, il y a un espace magique. »
- « Il suffit parfois d'un détail — une main qui se cherche, un souffle. »
- « [Prénom] et [Prénom] se sont dit oui à [Lieu]. Voici ce qui reste. »
- « Il y a des couples dont on sait, dès la première rencontre, que ce sera juste. »`,
      category: "copy",
    },
    {
      title: "Formules d'accroche LinkedIn qui marchent",
      content: `- « Après [X] mariages photographiés, voici ce que j'ai compris sur [sujet]. »
- « Il y a un moment d'un mariage que je préfère à tous les autres. Ce n'est pas celui qu'on croit. »
- « On me demande souvent [question]. Voici ma réponse honnête. »
- « J'ai failli refuser ce mariage. Voici pourquoi c'est finalement le plus beau que j'ai photographié. »
- « Un débat récurrent dans la profession : [sujet]. Ma position. »
- « L'erreur que font 90 % des mariés quand ils choisissent leur photographe. »`,
      category: "copy",
    },
    {
      title: "Formules de CTA doux (jamais commercial agressif)",
      content: `**En fin d'article de blog** :
- « Si vous préparez votre mariage et que mon univers vous parle, écrivez-moi — nous prendrons le temps d'en discuter sans engagement. »
- « Découvrez d'autres histoires dans la galerie. »
- « Le Grand Concours 2027 se termine le 23 décembre — pour en savoir plus. »

**En fin de post IG** :
- Question douce (« Et vous, quel moment retenez-vous de votre journée ? »)
- Invitation à enregistrer (« Enregistrez ce post pour votre planning »)
- Rien du tout — laisser la caption respirer

**Jamais** : « Bookez vite », « plus que X places », « urgent ».`,
      category: "copy",
    },
    {
      title: "Adaptation d'un même brief aux 3 plateformes",
      content: `Même brief (« photo Sophie et Marc, Château de la Napoule, 15 juin ») donne :

**IG** : « Ce regard, entre la cérémonie et le vin d'honneur, quand Sophie a réalisé que c'était bien réel. » — 180 mots sur l'émotion du moment.

**LinkedIn** : « Pourquoi je choisis toujours de suivre les mariés entre la cérémonie et le cocktail — ce qu'on manque quand on court aux photos posées trop vite. » — 250 mots avec analyse métier.

**Blog** : « Comment capter les 15 minutes cachées d'un mariage — mes conseils aux couples et à mes confrères. » — 1200 mots avec structure, exemples, conseils actionnables.`,
      category: "templates",
    },

    // ─── SEO & Blog ─────────────────────────────────────────────
    {
      title: "Mots-clés blog prioritaires (SEO)",
      content: `**Fort volume** (à cibler dans les articles piliers) :
- photographe mariage Nice
- photographe mariage Côte d'Azur
- photographe mariage Provence
- photographe de mariage haut de gamme
- reportage mariage Nice

**Longue traîne** (à cibler dans les articles conseils) :
- comment choisir son photographe de mariage
- prix photographe mariage Côte d'Azur
- questions à poser à son photographe de mariage
- photographe mariage bohème Provence
- destination wedding photographer French Riviera`,
      category: "seo",
    },
    {
      title: "Bonnes pratiques SEO — règles absolues",
      content: `- Mot-clé principal dans : titre, méta-description, première phrase, au moins un H2, 3-5 fois dans le corps.
- Slug URL en kebab-case, minuscules, sans accents, sans articles. Ex : \`photographe-mariage-nice-guide\`.
- Un article = un mot-clé principal. Pas de cannibalisation.
- Liens internes contextuels vers /prestations, /portfolio, /contact, /concours (jamais forcés).
- Images avec balise alt descriptive (« Sophie et Marc lors de leur cérémonie au Château de la Napoule »).
- Longueur > 800 mots pour les articles piliers (référence Google).`,
      category: "seo",
    },
    {
      title: "Anti-patterns SEO (à ne jamais faire)",
      content: `- Titre bourré de mots-clés (« photographe mariage Nice pas cher pro »)
- Mot-clé répété plus de 8 fois (keyword stuffing pénalisé)
- Slug avec plus de 60 caractères
- Absence totale de lien interne (article isolé)
- Balise H1 dupliquée dans le corps
- Introduction longue (> 200 mots — perd le lecteur)
- CTA agressif (« Réservez maintenant, plus que 3 places »)`,
      category: "seo",
    },

    // ─── Rythme éditorial ─────────────────────────────────────
    {
      title: "Rythme de publication recommandé",
      content: `**Instagram** — 3 à 5 posts par semaine, alternant les piliers. 1-2 stories par jour de mariage. 1 Reel toutes les 2 semaines.

**LinkedIn** — 1 à 2 posts par semaine. Rythme régulier > sporadique intensif.

**Blog** — 2 à 4 articles par mois. 1 article pilier long + 2-3 articles courts. Rythme constant = meilleur SEO.

Constance > perfection. Mieux vaut 3 posts par semaine sur 12 semaines qu'une salve de 20 puis silence.`,
      category: "rythme",
    },
    {
      title: "Jours et heures optimales de publication",
      content: `**Instagram** (audience futurs mariés France) :
- Mardi/Mercredi/Jeudi 12h-14h et 19h-21h
- Dimanche 10h-12h (temps de scroll détendu)

**LinkedIn** (audience pros) :
- Mardi/Jeudi 8h-10h et 12h-13h30
- Éviter le week-end

**Blog** — pas de jour préféré (SEO organique), mais publier en début de semaine donne plus de temps pour l'indexation.`,
      category: "rythme",
    },

    // ─── Cas d'usage ─────────────────────────────────────────
    {
      title: "Cas d'usage — vrai mariage à valoriser",
      content: `Signaux à capturer et raconter dans la caption/l'article :
- Émotion : regard, larme, rire, main qui se cherche, geste tendre.
- Lumière : golden hour, contre-jour, ombre douce, éclat vif.
- Détails : robe, alliances, bouquet, papeterie, décor, calligraphie.
- Lieux : châteaux, mas provençaux, vues mer, jardins secrets, chapelles anciennes.
- Coulisses : préparatifs, second first look, moment volé après le cocktail, danse improvisée.
- Culture : rites religieux (mahurot, hora, tea ceremony), traditions régionales, larmes des parents.

Toujours du concret (un prénom, un lieu précis, un instant) — jamais des généralités.`,
      category: "sujets",
    },
    {
      title: "Cas d'usage — Le Grand Concours 2027",
      content: `Positionnement quand tu parles du concours :
- Le concours est un cadeau BONUS, jamais un argument commercial principal.
- Un couple doit choisir Mickael pour son style photo — pas pour le voyage.
- Toujours transparent : « voir /concours pour les conditions ».
- Éviter l'urgence agressive (« plus que X jours ! ») — plutôt : « le concours se termine le 23 décembre 2027 ».
- Ne jamais insister sur la valeur monétaire du prix — insister sur l'expérience (safari, Zanzibar, aventure humaine).`,
      category: "sujets",
    },
    {
      title: "Cas d'usage — journée type de photographe",
      content: `Angle « coulisses » pour LinkedIn ou blog :
- Réveil 6h30 pour un mariage à Aix.
- Préparatifs de la mariée 8h-10h (posé, discret, présent sans être là).
- Cérémonie 11h-12h (photojournalisme pur, jamais interrompre).
- Cocktail 13h-15h (portrait couple entre les échanges).
- Réception 16h-19h (détails déco + premier repas).
- Soirée 20h-23h (émotion, danses, dernier baiser).
- Retour maison, 1h de tri des cartes SD.
- 6-10 semaines de post-production pour livraison.

Chaque étape peut devenir un post ou un article.`,
      category: "sujets",
    },

    // ─── Règles ─────────────────────────────────────────────
    {
      title: "Interdits absolus",
      content: `- ✗ Ne jamais donner un tarif exact ni une fourchette.
- ✗ Ne jamais nommer un photographe concurrent (positif ou négatif).
- ✗ Ne jamais publier une photo qui n'appartient pas à Mickael.
- ✗ Ne jamais inventer un fait précis (nom, lieu, date) non dans le brief.
- ✗ Ne jamais promettre un délai, un cadeau, un service non écrit sur le site.
- ✗ Ne jamais tagger une personne réelle sans autorisation.
- ✗ Ne jamais utiliser « best », « n°1 », « meilleur photographe » (illégal en publicité comparative française sans preuve).
- ✗ Pas de politique, religion, actualité polémique.
- ✗ Pas de « swipe up », « lien en bio », urgences fabriquées.
- ✗ Pas d'humour déplacé sur les mariés, invités, cultures.`,
      category: "regles",
    },
    {
      title: "Gestion des témoignages clients",
      content: `Quand on publie un témoignage d'un couple :
- Vérifier l'accord explicite (verbal ou écrit) avant.
- Utiliser prénom + première lettre du nom (« Sophie & Marc D. »).
- Créditer le lieu si le couple est ok avec.
- Photo obligatoire : au moins un portrait du couple.
- Positionnement : sous forme de story ou de post IG dédié, jamais dans un article de blog global (les témoignages ont leur propre page /avis).`,
      category: "regles",
    },
    {
      title: "Références concurrentielles à respecter",
      content: `Ne jamais nommer un photographe concurrent (positif ou négatif). Si un brief mentionne un concurrent, l'ignorer et se concentrer sur l'univers de Mickael.
Ne jamais publier une photo qui n'appartient pas à Mickael, même en repost avec crédit.
Si un client demande une comparaison, rediriger : « Mickael a son propre univers. Pour découvrir son travail, la galerie /portfolio est le meilleur point de départ. »`,
      category: "regles",
    },
    {
      title: "Sujets à éviter (à valider avec Mickael)",
      content: `- Politique, religion, actualité polémique.
- Prix explicites (règle du studio).
- Comparaison avec d'autres photographes.
- Blagues sur les mariés ou les invités.
- Filtres extrêmes, effets tape-à-l'œil.
- « Swipe up », « lien en bio », urgences fabriquées.
- Contenu généré uniquement par IA sans lien réel avec un mariage vécu (le studio parle de son travail réel, pas de fantaisies).`,
      category: "voice",
    },
  ],

  // ═══════════════════════════════════════════════════════════════
  // AGENT ADMIN — devis / contrats / factures
  // ═══════════════════════════════════════════════════════════════
  admin: [
    { title: "Profil et statut du studio", content: PROFIL, category: "legal" },

    // ─── Cadre légal ─────────────────────────────────────────────
    {
      title: "Textes de référence à respecter",
      content: `**Code de la consommation** — art. L111-1 (obligation d'information), L221-18 (rétractation).
**Code civil** — art. 1101 et suivants (contrats).
**Code de la propriété intellectuelle** — art. L131-1 et suivants (droits d'auteur photographe).
**Code général des impôts** — art. 289 et 242 nonies A (facturation), art. 293 B (franchise TVA micro-entrepreneur).
**Code de commerce** — art. L441-6 (pénalités de retard, indemnité 40 €), L441-9 (facturation B2B).
En cas de conflit, le texte le plus protecteur du consommateur s'applique par défaut.`,
      category: "legal",
    },
    {
      title: "Statut juridique — cas micro-entrepreneur",
      content: `**Seuil 2027 pour prestations de service** : 77 700 € HT/an (à revalider chaque année).
**Franchise TVA** :
- Mention obligatoire : « TVA non applicable, art. 293 B du CGI »
- Aucun calcul de TVA sur les factures
- Numéro TVA intracom : renseigné mais inactif
- Ne pas facturer la TVA au client, ne pas la déduire sur les achats

**Autres obligations micro** :
- Déclaration mensuelle ou trimestrielle URSSAF
- Comptabilité simplifiée (livre des recettes)
- Compte bancaire séparé obligatoire si CA > 10 000 € /an sur 2 années consécutives`,
      category: "legal",
    },
    {
      title: "Statut juridique — cas société (EURL, SASU)",
      content: `Mentions obligatoires supplémentaires sur documents :
- Forme juridique complète (« SASU au capital de X € »)
- Numéro RCS de la ville d'immatriculation (« RCS Nice B 123 456 789 »)
- N° TVA intracommunautaire (FR + clé + SIRET des 9 premiers chiffres)

**TVA** : assujetti dès premier euro, taux 20 % pour prestations photo mariage standard.
**Comptabilité** : livre-journal + grand livre + bilan annuel. Expert-comptable fortement recommandé.`,
      category: "legal",
    },

    // ─── Devis ─────────────────────────────────────────────────
    {
      title: "Mentions obligatoires devis",
      content: `Devis pro forma OU professionnel : doit contenir :
- Titre « DEVIS » + numéro séquentiel (DEVIS-YYYY-NNNN)
- Identité du studio (nom, statut, adresse, SIRET, TVA intracom si applicable, code NAF 74.20Z)
- Identité du client (prénom, nom, adresse, email)
- Date d'émission + durée de validité (30 jours par défaut)
- Date probable de la prestation + lieu
- Détail des prestations : intitulé, quantité, prix HT, TVA, prix TTC (une ligne par prestation)
- Total HT, montant TVA, total TTC
- Modalités : acompte 30 % à la signature, solde J-30 avant prestation
- Mention « Non assujetti à la TVA — art. 293 B du CGI » si micro-entrepreneur
- Mention « Bon pour accord » + zone de signature
- Renvoi aux CGV (annexe ou lien vers romerophotography.fr/cgv)`,
      category: "devis",
    },
    {
      title: "Devis — durée de validité",
      content: `Standard : **30 jours** à compter de la date d'émission.
Cas particuliers :
- Mariage dans les 6 mois : validité 15 jours
- Mariage à + 12 mois : validité étendue à 60 jours possible sur demande
- Prolongation : possible sur demande écrite, générer un nouveau devis avec la même référence + suffixe -bis

**Formulation type** : « Ce devis est valable trente (30) jours à compter de la date d'émission. Au-delà, un nouveau devis pourra être établi selon les tarifs en vigueur. »`,
      category: "devis",
    },
    {
      title: "Devis — signature électronique",
      content: `Signature électronique via Yousign :
- Signature qualifiée : identification du signataire + horodatage certifié
- Valeur juridique équivalente à la signature manuscrite (art. 1367 du Code civil)
- Le devis signé électroniquement vaut acceptation

Envoi Yousign : générer PDF, upload, ajouter le signataire (email + téléphone pour SMS OTP), activer la procédure.
Le PDF signé revient signé + certificat de signature en annexe.`,
      category: "devis",
    },

    // ─── Contrat ────────────────────────────────────────────────
    {
      title: "Mentions obligatoires contrat mariage",
      content: `Contrat de prestation mariage : doit contenir OBLIGATOIREMENT :
- Identité des parties (studio + chacun des mariés séparément)
- Objet précis : reportage mariage de [Prénom] & [Prénom]
- Date, lieu, heure de début et de fin (approximatives ok)
- Description détaillée prestations : formule choisie, nombre approximatif de photos, format, résolution
- Livrables : galerie web privée, délai de livraison max
- Prix total TTC, modalités de paiement, acompte non-remboursable au-delà de X jours
- Clause de cession/autorisation à l'image (variante A/B/C)
- Clause de force majeure
- Clause de rétractation 14 j (art. L221-18) si vente à distance sans RDV présentiel
- Politique d'annulation
- Confidentialité mutuelle
- Juridiction compétente : Tribunal de Nice
- CGV en annexe
- Date + lieu + signatures manuscrites ou électroniques
- Paraphe en bas de chaque page`,
      category: "contrat",
    },
    {
      title: "Clause force majeure — texte type",
      content: `« Constitue un cas de force majeure tout événement extérieur, imprévisible et irrésistible au sens de l'article 1218 du Code civil, notamment (liste non limitative) :
- Décès dans la famille proche d'une des parties
- Maladie grave certifiée médicalement
- Crise sanitaire imposant l'annulation
- Catastrophe naturelle ou événement climatique majeur
- Événement politique ou de sécurité empêchant matériellement la prestation

En cas de force majeure établie :
- Remboursement intégral des sommes versées, OU
- Report de la prestation à une date convenue entre les parties dans les 12 mois, sans surcoût.

Les parties s'engagent à s'informer mutuellement dans les 7 jours suivant la survenance de l'événement. »`,
      category: "contrat",
    },
    {
      title: "Politique d'annulation détaillée",
      content: `**Annulation par les mariés** :
- Plus de 6 mois avant : acompte remboursé à 50 %
- Entre 6 et 3 mois avant : acompte non remboursé, mais reportable sur une autre date dans les 12 mois suivants (sous réserve de disponibilité)
- Moins de 3 mois avant : acompte non remboursé et non reportable
- Solde éventuellement versé au-delà de l'acompte : remboursé intégralement dans tous les cas

**Annulation par le photographe** :
- Cas de force majeure documenté : remboursement intégral + assistance active à trouver un remplaçant de qualité équivalente
- Hors force majeure : remboursement intégral + pénalité 20 % du prix total versée au client à titre de dédommagement

**Report d'un commun accord** :
- Toujours possible, à formaliser par échange écrit (email suffit)
- L'acompte est intégralement reporté sur la nouvelle date
- Un avenant à ce contrat sera signé le cas échéant`,
      category: "contrat",
    },
    {
      title: "Cession droits image — variante A (standard)",
      content: `**Cession totale gratuite** (option par défaut, à intégrer sauf demande contraire) :

« Les mariés autorisent Mickael Romero à utiliser les photographies prises à des fins de promotion de son activité professionnelle (site web, réseaux sociaux Instagram / Facebook / LinkedIn, blog, publications professionnelles imprimées, concours photographiques, expositions), à titre gratuit, pour une durée illimitée, sur tout support connu ou à venir, en France et à l'international.

En contrepartie, les mariés bénéficient d'un droit d'usage personnel, familial et privé illimité sur toutes les photos livrées : impressions, partage familial, réseaux sociaux personnels sont autorisés.

Toute utilisation commerciale par les mariés (revente, publicité, presse rémunérée) nécessite un accord écrit préalable du photographe. »`,
      category: "contrat",
    },
    {
      title: "Cession droits image — variante B (restreinte)",
      content: `**Cession restreinte** — quand le couple accepte quelques usages mais pas tous :

« Les mariés autorisent la publication de leur reportage sur les supports suivants uniquement :
- Le site www.romerophotography.fr
- Le compte Instagram @romeromomentsphoto

Toute autre utilisation professionnelle (concours, presse, expositions, publicité imprimée) nécessitera leur accord écrit préalable, à obtenir cas par cas. »`,
      category: "contrat",
    },
    {
      title: "Cession droits image — variante C (refus total)",
      content: `**Refus total de publication** — le couple ne souhaite AUCUNE utilisation promo :

« Les mariés ne souhaitent pas que leurs photographies soient utilisées à des fins promotionnelles par le photographe, sur quelque support que ce soit.

En contrepartie de cette restriction, un supplément de quinze pour cent (15 %) est appliqué au prix de la formule choisie, à titre de compensation pour la perte de matériel promotionnel professionnel. Ce supplément est mentionné sur le devis et la facture.

Le photographe conserve néanmoins ses droits d'auteur légaux sur les photographies et le droit d'archiver les fichiers à des fins personnelles et de portfolio interne non-publié. »`,
      category: "contrat",
    },
    {
      title: "Droit de rétractation 14 jours (L221-18)",
      content: `**Applicable UNIQUEMENT si vente à distance (sans face-à-face préalable)** :
- Contrat signé après échange à distance uniquement (visio, email) → droit de rétractation 14 j applicable
- Contrat signé après RDV préalable en présentiel (studio Nice, salon du mariage) → droit de rétractation NON applicable

**Formulation type quand applicable** :
« Conformément à l'article L221-18 du Code de la consommation, le client dispose d'un délai de rétractation de quatorze (14) jours à compter de la signature du présent contrat, à exercer par lettre recommandée AR à l'adresse du photographe.

En cas de rétractation, l'acompte versé sera intégralement remboursé sous 14 jours. »

**Renonciation express** (quand la prestation doit commencer dans les 14 j) :
« Le client demande expressément que la prestation soit exécutée avant l'expiration du délai de rétractation de 14 jours. Il renonce par la présente à son droit de rétractation, en application de l'article L221-25 du Code de la consommation. »`,
      category: "contrat",
    },

    // ─── Facture ────────────────────────────────────────────────
    {
      title: "Mentions obligatoires facture (CGI 242 nonies A)",
      content: `Facture doit contenir :
- Titre « FACTURE » (ou « FACTURE D'ACOMPTE » si acompte)
- Numéro séquentiel (JAMAIS de trou dans la numérotation)
- Date d'émission + date de livraison ou d'exécution
- Identité du vendeur : nom, adresse, SIRET, TVA intracom, forme juridique et capital si société
- Identité du client (nom + prénom + adresse)
- Description détaillée : intitulé, quantité, prix HT unitaire, montant HT
- Total HT + taux TVA + montant TVA + montant TTC (ou uniquement TTC si franchise)
- Date d'échéance de paiement (à défaut : 30 j après émission)
- Pénalités de retard : « Taux BCE + 10 points, minimum 3× le taux d'intérêt légal »
- Indemnité forfaitaire pour frais de recouvrement : 40 € (L441-6 Code de commerce)
- « Aucun escompte accordé en cas de paiement anticipé »
- Mention « TVA non applicable, art. 293 B du CGI » si micro-entrepreneur
- Coordonnées bancaires pour paiement (IBAN + BIC)`,
      category: "facture",
    },
    {
      title: "Numérotation des documents (règle absolue)",
      content: `**Format recommandé** :
- Devis : DEVIS-YYYY-NNNN (DEVIS-2027-0001)
- Contrat : CTR-YYYY-NNNN
- Facture : FA-YYYY-NNNN
- Avoir : AV-YYYY-NNNN

**Règle absolue** : la numérotation est séquentielle, sans trou et sans duplication. Un numéro attribué ne peut PAS être réutilisé, même si le document est annulé ou supprimé.

**Cas d'annulation** :
- Devis annulé : le numéro reste consommé, on note « ANNULÉ » sur le doc (pas de suppression physique)
- Facture annulée : impossible. Créer une facture d'avoir (AV-YYYY-NNNN) qui annule la facture, puis émettre une nouvelle facture correcte.

Toute rupture de séquence expose à un contrôle fiscal.`,
      category: "facture",
    },
    {
      title: "Facture d'avoir — cas d'usage",
      content: `Une facture d'avoir (ou note d'avoir) est nécessaire quand :
- Une facture émise contient une erreur (montant, TVA, client, prestations)
- Le client demande un remboursement partiel ou total
- Une remise commerciale est appliquée après émission

**Format** :
- Titre « FACTURE D'AVOIR N° AV-YYYY-NNNN »
- Référence à la facture d'origine (« Annulation de la facture n° FA-YYYY-NNNN du [date] »)
- Reprise à l'identique des montants d'origine, mais en NÉGATIF
- Motif de l'avoir en clair
- Numérotation propre séquentielle des avoirs

Après émission de l'avoir : émettre si besoin une nouvelle facture correcte avec un NOUVEAU numéro.`,
      category: "facture",
    },
    {
      title: "Escompte pour paiement anticipé",
      content: `**Position par défaut du studio** : aucun escompte pour paiement anticipé.

Mention légale obligatoire sur toutes les factures :
« Aucun escompte accordé en cas de paiement anticipé. »

Cette mention est obligatoire même si l'escompte n'est pas pratiqué (art. L441-6 Code de commerce).

Si Mickael souhaite exceptionnellement en accorder un : mentionner explicitement le taux et les conditions sur la facture.`,
      category: "facture",
    },

    // ─── Frais de déplacement ────────────────────────────────
    {
      title: "Frais de déplacement — grille",
      content: `**Rayon 100 km inclus** (Nice, Antibes, Cannes, Menton, Grasse, Monaco, arrière-pays niçois, Saint-Tropez) : aucun frais.

**Au-delà** — facturés en supplément, ligne séparée sur devis/facture :
- 100-200 km (Cannes → Marseille, Aix, Toulon) : 0,50 €/km A/R + péages
- 200-500 km (Lyon, Montpellier, Turin, Nord Italie) : 0,50 €/km + péages + éventuelle nuit hôtel (~120 € HT)
- 500-1000 km (Paris, Bordeaux) : forfait train/avion (à devis) + hôtel + repas
- International > 1000 km : devis spécifique destination weddings (jour supplémentaire de déplacement inclus)

**Formulation ligne facture** :
« Frais de déplacement forfaitaires pour [lieu] : XXX € HT »`,
      category: "tarifs",
    },

    // ─── Politique de relance ────────────────────────────────
    {
      title: "Relance facture impayée — J+3",
      content: `**Relance 1 — courtoise, J+3 après échéance**

Objet : Rappel amical — facture n° [ref]

« Bonjour [prénom],

J'espère que tout va bien depuis notre dernière rencontre.

Je me permets de vous rappeler que la facture n° [ref] du [date_emission], d'un montant de [montant] € TTC, arrivait à échéance le [date_echeance].

Peut-être vous a-t-elle échappé — cela arrive parfois avec les nombreux échanges autour d'un mariage. Merci de me confirmer le règlement ou de m'indiquer la date à laquelle il vous sera possible de procéder.

Bien cordialement,
Mickael Romero
Studio Romero Photography
06 04 03 70 76 »`,
      category: "relance",
    },
    {
      title: "Relance facture impayée — J+15",
      content: `**Relance 2 — plus ferme, mention pénalités, J+15**

Objet : Deuxième rappel — facture n° [ref]

« Bonjour [prénom],

Sauf erreur de ma part, la facture n° [ref] d'un montant de [montant] € TTC, échue le [date_echeance], reste à ce jour impayée.

Je vous invite à procéder au règlement dans un délai de 8 jours à compter de la présente. Passé ce délai, et conformément à l'article L441-6 du Code de commerce, des pénalités de retard seront applicables au taux de la Banque Centrale Européenne majoré de 10 points, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 €.

Si un délai supplémentaire vous est nécessaire, merci de me le faire savoir dès que possible pour trouver ensemble une solution.

Bien cordialement,
Mickael Romero »`,
      category: "relance",
    },
    {
      title: "Relance devis non signé — J+15",
      content: `**Relance douce, J+15 après émission du devis**

Objet : À propos du devis n° [ref]

« Bonjour [prénom],

J'espère que vos préparatifs avancent bien.

Je reste à votre disposition pour toute question sur le devis n° [ref] que je vous ai transmis le [date]. N'hésitez pas si vous souhaitez en discuter, ajuster une prestation ou en découvrir davantage sur ma manière de travailler.

Prenez le temps qu'il vous faut — je serai heureux de vous accompagner sur votre journée si mon univers vous parle.

Bien cordialement,
Mickael Romero »`,
      category: "relance",
    },
    {
      title: "Relance devis expiration proche — J+25",
      content: `**Rappel proche de l'expiration, J+25**

Objet : Le devis n° [ref] arrive à expiration

« Bonjour [prénom],

Un petit mot pour vous indiquer que le devis n° [ref] arrivera à expiration le [date_expiration].

Si vous souhaitez confirmer, il vous suffit de me retourner le devis signé avec la mention « Bon pour accord ». Si vous avez besoin d'un délai supplémentaire de réflexion, je peux le proroger sans souci — dites-le-moi simplement.

Et si votre choix se porte finalement ailleurs, je vous souhaite le meilleur pour votre journée. Merci de me le confirmer d'un mot pour que je libère la date.

Bien cordialement,
Mickael Romero »`,
      category: "relance",
    },

    // ─── Ton et interdits ─────────────────────────────────
    {
      title: "Ton des documents",
      content: `Sobre, formel, précis. Vouvoiement systématique. Aucune fioriture — le document doit être imprimable, signable et envoyable en l'état.

**Interdits stylistiques** :
- Émojis (ni ❤ ni ✨ ni 📸 ni rien)
- Familier (« au fait », « du coup », « super », « top »)
- Anglicismes gratuits (« deal », « package », « meeting »)
- Marketing (« exceptionnel », « premium », « unique ») dans les champs juridiques

**Exception** : les descriptions de prestations peuvent être légèrement plus littéraires (« reportage photographique élégant et discret » plutôt que « prise de vue »).

**Format** : pas d'italique dans les mentions légales, pas de gras excessif. Une hiérarchie H1/H2/H3 claire suffit.`,
      category: "regles",
    },
    {
      title: "Interdits absolus",
      content: `- ✗ Modifier une facture déjà émise → toujours faire un avoir + nouvelle facture.
- ✗ Générer une facture sans numéro séquentiel valide.
- ✗ Inventer une mention légale — si un doute, demander à Mickael.
- ✗ Envoyer un contrat à signature sans validation explicite préalable.
- ✗ Inventer un tarif → toujours demander au brief.
- ✗ Inventer une adresse ou SIRET client → demander au brief.
- ✗ Émettre un contrat sans clause de force majeure.
- ✗ Émettre un contrat sans clause de cession de droits à l'image.
- ✗ Émettre un devis sans durée de validité.
- ✗ Modifier les mentions légales obligatoires (les prendre à la lettre).`,
      category: "regles",
    },

    // ─── CRM contacts ─────────────────────────────────────
    {
      title: "Contacts clients — usage",
      content: `La table admin_contacts stocke les clients (couples mariés + prospects sérieux).
Format d'entrée : « Prénom Nom + email + tél + adresse + notes ».

Quand tu génères un document pour un client déjà connu :
- Récupérer ses infos depuis la KB contacts plutôt que redemander au brief
- Mettre à jour la KB si de nouvelles infos apparaissent dans le brief (nouvelle adresse, tél supplémentaire, note)

Ne JAMAIS partager les infos d'un client avec un autre. Confidentialité totale.`,
      category: "contacts",
    },
  ],
};
