/**
 * Injecte le catalogue tarifaire officiel de Mickael dans la KB admin.
 * Idempotent : delete-then-insert des fiches "Catalogue *".
 */
import pg from "pg";
import fs from "node:fs";
for (const line of fs.readFileSync(".env.diag", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?(.*?)"?$/);
  if (m) process.env[m[1]] = m[2];
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const fiches = [
  {
    title: "Catalogue 2026 — Formule 1 L'Essentielle",
    category: "tarifs",
    content: `Formule 1 — L'Essentielle
Tarif : 1 699 EUR TTC
Couverture : de la mairie au vin d'honneur

Prestations incluses :
- Cérémonie civile (mairie)
- Photos de couple et de groupe
- Cérémonie laïque ou religieuse
- Reportage du vin d'honneur
- Galerie privée en ligne
- Retouches premium
- Frais de déplacement : 30 km inclus

Positionnement : l'essentiel pour capturer les moments forts avec naturel et authenticité. Formule d'entrée de gamme pour mariages intimistes ou budgets serrés.`,
  },
  {
    title: "Catalogue 2026 — Formule 2 Le Grand Jour",
    category: "tarifs",
    content: `Formule 2 — Le Grand Jour
Tarif : 1 899 EUR TTC
Couverture : de la préparation des mariés au vin d'honneur

Prestations incluses :
- Préparation des mariés
- Cérémonie civile (mairie)
- Photos de couple et de groupe
- Cérémonie laïque ou religieuse
- Vin d'honneur
- Galerie privée en ligne
- Retouches premium
- Frais de déplacement : 50 km inclus

Positionnement : couverture fluide et élégante du début de la journée jusqu'au cocktail. Formule la plus demandée pour couples qui veulent tous les temps forts hors soirée.`,
  },
  {
    title: "Catalogue 2026 — Formule 3 Le Grand Classique",
    category: "tarifs",
    content: `Formule 3 — Le Grand Classique
Tarif : 2 499 EUR TTC
Couverture : de la préparation des mariés à l'ouverture de bal

Prestations incluses :
- Préparation des mariés
- Cérémonie civile (mairie)
- Photos de couple et de groupe
- Cérémonie laïque ou religieuse
- Vin d'honneur
- Ouverture de bal
- Galerie privée en ligne
- Retouches premium
- Frais de déplacement : 70 km inclus

Positionnement : l'histoire complète de votre mariage, jusqu'à la première danse. Formule signature de Romero Photography.`,
  },
  {
    title: "Catalogue 2026 — Formule 4 Prestige Éternel",
    category: "tarifs",
    content: `Formule 4 — Prestige Éternel
Tarif : 4 999 EUR TTC
Couverture : de la préparation des mariés à l'ouverture de bal, avec séance engagement

Deux photographes :
- Mickael avec les mariés
- Un second shooter dédié aux invités

Prestations incluses avant le mariage :
- Shooting couple avant le mariage (séance d'engagement)

Prestations le jour J :
- Préparation des mariés
- Cérémonies (civile, laïque et religieuse)
- Photos de couple et de groupe
- Vin d'honneur
- Ouverture de bal
- Galerie privée en ligne
- Retouches premium
- Frais de déplacement : 100 km inclus

Livrables physiques inclus :
- Album photo 40 photos imprimées
- Agrandissement 60 x 90 encadré (photo de couple)
- Agrandissement 60 x 90 encadré (photo de groupe)

Positionnement : la formule luxe pour vivre et revivre chaque instant. Recommandée pour mariages de plus de 100 invités, destinations wedding, ou couples exigeants sur la couverture.`,
  },
  {
    title: "Catalogue 2026 — Options disponibles",
    category: "tarifs",
    content: `Options disponibles avec toutes les formules

Second shooter (photographe supplémentaire) : 799 EUR TTC
Ajoute un deuxième photographe pour couvrir un autre angle ou les invités.

Album photo (40 photos imprimées) : 149 EUR TTC
Livre photo premium format standard.

Agrandissement 60 x 90 :
- 49 EUR TTC non encadré
- 99 EUR TTC encadré

Reportage partiel en argentique : sur devis
Films argentiques Portra 400 ou Ilford HP5, développement et scan haute résolution inclus. À chiffrer selon nombre de pellicules et complexité.

Retouche de noces (retouche avancée hors formule) :
- 180 EUR TTC par heure (formules 1, 2 et 3)
- 89 EUR TTC par heure (formule Prestige Éternel)

Ces prix sont TTC — Mickael est en franchise en base de TVA (art. 293 B du CGI). Aucune TVA à appliquer sur les devis et factures.`,
  },
  {
    title: "Règles de génération devis — précisions obligatoires",
    category: "process",
    content: `Règles à respecter pour générer un devis correct :

1. TOUJOURS utiliser les tarifs exacts du catalogue 2026 ci-dessus. Ne jamais inventer un prix.

2. Chaque formule = une ligne unique. Le prix affiché est le prix TTC (colonne "Total TTC"). Ne pas ajouter de TVA (franchise art. 293 B).

3. Si le client demande une option, l'ajouter comme ligne séparée avec son prix catalogue.

4. Acompte par défaut : 30 % à la signature du devis.

5. Validité du devis : 60 jours à compter de la date d'émission.

6. Numérotation : automatique, format DEV-YYYY-NNN. Ne jamais forcer un numéro.

7. Détail des lignes : rappeler brièvement ce que la formule couvre (préparation, cérémonie, vin d'honneur…) dans la colonne "Détail".

8. Si le budget du couple ne colle avec aucune formule, proposer la formule la plus proche + suggérer une option ou dire honnêtement "budget trop serré pour la formule souhaitée".

9. Ne pas mettre de placeholder [À compléter]. Si une info manque vraiment (email, téléphone), laisser le champ vide plutôt qu'un placeholder.`,
  },
];

// Delete existing catalog fiches
await c.query(
  `DELETE FROM agent_knowledge
   WHERE agent_slug = 'admin'
   AND (title LIKE 'Catalogue 2026 —%' OR title = 'Règles de génération devis — précisions obligatoires')`
);
console.log("Cleared old catalog fiches");

for (const f of fiches) {
  await c.query(
    `INSERT INTO agent_knowledge (agent_slug, title, category, content, created_at, updated_at)
     VALUES ('admin', $1, $2, $3, NOW(), NOW())`,
    [f.title, f.category, f.content]
  );
  console.log(`✓ ${f.title}`);
}

// Verify count
const { rows } = await c.query(
  `SELECT COUNT(*) as n FROM agent_knowledge WHERE agent_slug = 'admin' AND category IN ('tarifs', 'process')`
);
console.log(`\nTotal fiches admin (tarifs+process) : ${rows[0].n}`);
await c.end();
