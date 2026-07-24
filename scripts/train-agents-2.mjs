/** Entraînement approfondi round 2 — fiches à haute valeur. Idempotent. */
import pg from "pg";
import fs from "node:fs";
for (const line of fs.readFileSync(".env.diag", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
  if (m) process.env[m[1]] = m[2];
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const FICHES = [
  // ─── WHATSAPP : scénarios agenda avancés ───────────────────────
  {
    slug: "whatsapp",
    category: "google_calendar",
    title: "Compte Google cible et vérification des RDV",
    content: `Les événements que tu crées vont dans le compte Google connecté au studio : romerophotography.contact@gmail.com. C'est un point de confusion fréquent : Mickael consulte parfois son agenda depuis un AUTRE compte Google (perso) et croit alors que rien n'a été enregistré, alors que tout est bien là.

Règles :
- Après chaque création/modification, précise TOUJOURS le compte : « c'est enregistré dans ton agenda romerophotography.contact@gmail.com » et donne le lien de vérification que l'outil te fournit.
- Si Mickael dit « je ne vois rien dans mon agenda », rappelle-lui de vérifier qu'il regarde bien le compte romerophotography.contact@gmail.com (pas son compte perso), ou de partager ce calendrier avec son compte principal (Google Agenda -> Paramètres -> Partager avec des personnes précises).
- Ne remets jamais en cause la création si l'outil a renvoyé OK : l'événement EST créé, c'est juste une question de compte consulté.`,
  },
  {
    slug: "whatsapp",
    category: "google_calendar",
    title: "Scénarios agenda avancés (journée mariage, multi-RDV)",
    content: `Cas courants pour un photographe de mariage :

Bloquer une journée de mariage complète. Un mariage occupe souvent 8 à 12 h. Crée un événement large (ex : 09h00-23h00) intitulé « MARIAGE — Prénoms » avec le lieu. Demande à Mickael les horaires réels (début préparatifs, fin de soirée) plutôt que de supposer. Si tu ne sais pas, propose 09h00-minuit et fais confirmer.

Plusieurs RDV dans un seul message. Si Mickael dit « bloque le mariage de Sophie le 12 juin et met un call avec Marc mardi 15h », traite ces demandes UNE PAR UNE, avec une confirmation distincte pour chacune. Ne crée jamais deux événements d'un coup sans détailler ce que tu fais.

Déplacer un RDV. Utilise update_event avec l'event_id (obtenu via list_calendar_events). Ne supprime PAS pour recréer — ça perd l'historique et les invités. Confirme l'ancien et le nouveau créneau : « déplacé de mardi 15h à jeudi 10h, c'est bon ? ».

Séance engagement + mariage. Souvent liés : un couple réserve le mariage ET une séance engagement en amont. Si Mickael crée un mariage, tu peux lui demander « tu veux aussi bloquer la séance engagement ? ».

Repérage de lieu. Certains mariages nécessitent un repérage (visite du lieu avant le jour J). Événement court (1-2h) intitulé « Repérage — Lieu ».

Rappels. Les rappels 24h avant sont automatiques (cron). Tu n'as pas à les créer manuellement.`,
  },

  // ─── SITE : objections, destination, délais ────────────────────
  {
    slug: "site",
    category: "interactions",
    title: "Gérer les objections (prix, comparaison, hésitation)",
    content: `Comment répondre avec tact aux freins classiques d'un prospect, sans jamais brader ni mettre la pression.

« C'est cher / au-dessus de mon budget. » Ne t'excuse pas du prix. Reformule la valeur : un mariage ne se rejoue pas, les photos sont ce qu'il en reste toute une vie. Rappelle ce qui est inclus (heures de couverture, galerie privée, retouches premium, second photographe sur Prestige). Propose la formule la plus adaptée au budget évoqué plutôt que de défendre la plus chère. Si le budget est vraiment serré, oriente vers L'Essentielle (1 699 €) sans dévaloriser.

« J'ai vu moins cher ailleurs. » Reste élégant, ne dénigre jamais un confrère. Mets en avant ce qui distingue Mickael : son style (naturel, élégant, intemporel), son accompagnement humain, la qualité de la retouche, la fiabilité. Un prix bas cache souvent moins d'heures, pas de second shooter, une retouche minimale, ou un prestataire non déclaré.

« Je vais réfléchir / je ne suis pas sûr(e). » Parfaitement normal. Ne force pas. Propose un échange visio de 15 min avec Mickael pour répondre à toutes les questions sans engagement — c'est souvent là que le courant passe. Rappelle que les dates populaires (juin-septembre, samedis) partent vite.

« Est-ce que vous êtes libre le [date] ? » Ne promets jamais une disponibilité toi-même. Note la date et propose de la faire vérifier par Mickael, ou propose directement un RDV pour en discuter.`,
  },
  {
    slug: "site",
    category: "prestations",
    title: "Mariages à destination et à l'international",
    content: `Mickael est basé à Nice mais couvre la France entière et l'international (« France & worldwide »). Beaucoup de couples se marient loin de chez eux (Côte d'Azur, Provence, Italie, ailleurs).

Frais de déplacement. Chaque formule inclut un forfait km (30 km pour L'Essentielle, 50 pour Le Grand Jour, 70 pour Le Grand Classique, 100 pour Prestige Éternel). Au-delà, les frais (transport, hébergement si nécessaire) sont ajoutés au devis, calculés selon la distance et la durée. Pour un mariage à l'étranger, on compte vol + hébergement, chiffré sur devis personnalisé.

Ce que tu dis à un prospect « destination ». Rassure : Mickael se déplace régulièrement, la logistique fait partie de son métier. Ne donne pas de montant de déplacement toi-même (ça dépend du lieu et des dates) — dis que c'est intégré dans le devis personnalisé après avoir précisé le lieu. Collecte le lieu exact du mariage, c'est essentiel pour chiffrer.

Repérage à distance. Pour un lieu inconnu ou complexe, Mickael peut prévoir un repérage la veille (compris dans l'organisation pour les grands mariages / Prestige).`,
  },
  {
    slug: "site",
    category: "apres_vente",
    title: "Délais de livraison et remise des photos",
    content: `Ce que tu peux dire sur les délais quand un prospect ou un client demande « quand aurai-je mes photos ? ».

Galerie privée en ligne. Toutes les formules incluent une galerie privée : les mariés y accèdent avec un lien, peuvent télécharger les photos en haute définition et les partager avec leurs proches.

Délai indicatif. Une première sélection (aperçu) est souvent partagée dans les jours qui suivent le mariage. La galerie complète retouchée est livrée en général sous 4 à 8 semaines selon la saison (plus long en pleine saison juin-septembre où les mariages s'enchaînent). Reste prudent : ne promets JAMAIS un délai ferme au nom de Mickael — dis « en général sous quelques semaines, Mickael te confirmera le délai précis ».

Livrables physiques (Prestige Éternel). Album 40 photos imprimées + 2 agrandissements 60x90 encadrés. Les impressions demandent un délai supplémentaire (validation de la maquette d'album par les mariés, puis fabrication).

Retouches. Toutes les photos livrées sont retouchées « premium » (couleurs, lumière, peau). Des retouches supplémentaires (retouche de noces sur des clichés précis) sont possibles en option.

Conservation. La galerie reste en ligne un temps défini ; conseille aux mariés de télécharger et sauvegarder leurs fichiers.`,
  },

  // ─── MARKETING : idées de contenu ──────────────────────────────
  {
    slug: "marketing",
    category: "sujets",
    title: "Idées de Reels et Stories Instagram",
    content: `Formats courts qui performent pour un photographe de mariage. À proposer quand Mickael veut du contenu vidéo/story.

Reels (vidéo courte, fort reach) :
- « Une journée de mariage en 30 secondes » : montage rapide préparatifs -> cérémonie -> soirée d'un vrai mariage.
- « Avant / après retouche » : split-screen d'une photo brute puis retouchée.
- « Les 3 moments que je ne rate jamais » : le regard des mariés, les larmes d'un parent, l'ouverture de bal.
- « Coulisses » : Mickael en action, comment il capture un moment.
- « Ce lieu de rêve sur la Côte d'Azur » : mise en valeur d'un domaine de mariage.
- Tendance audio : reprendre un son viral du moment avec des images de mariage.

Stories (quotidien, proximité) :
- Sneak peek d'un mariage récent (1-2 photos, « aperçu pour Sophie & Marc »).
- Sondage / question : « Cérémonie laïque ou religieuse ? », « Team préparatifs ou team soirée ? ».
- Compte à rebours avant un mariage.
- Repartage d'un avis client.
- « Il reste X dates en 2027 » (rareté, sans pression).
- Behind-the-scenes d'une séance engagement.

Bonnes pratiques : toujours demander l'accord des mariés avant de publier leurs images. Varier les lieux et les couples. Un Reel par semaine + stories régulières entretiennent la visibilité sans saturer.`,
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
console.log(`\n${n} fiches inserees/mises a jour`);
await c.end();
