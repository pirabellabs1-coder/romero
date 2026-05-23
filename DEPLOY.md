# Déploiement — Romero Photography

## ✅ Ce qui marche sur Vercel (lecture)
- Affichage de toutes les pages publiques avec les 92 photos seed
- Login admin (lecture de la table `users`)
- Visualisation de tous les contenus (galeries, articles, avis, messages)
- Envoi d'emails via Resend (no FS needed)
- SEO (sitemap.xml, robots.txt, JSON-LD)

## ❌ Limites Vercel serverless (écritures)
Le filesystem AWS Lambda est **read-only** sauf `/tmp`. Les actions suivantes
échouent silencieusement en prod sur Vercel :

| Action | Comportement |
|---|---|
| Formulaire de contact (sauvegarde) | DB write échoue → fallback : email envoyé via Resend (le photographe reçoit quand même la demande) |
| Upload de photo via admin | Écriture FS échoue → photo non persistée |
| Modification de galerie / article / avis | DB write échoue → modif perdue |
| Changement de couleurs/typo dans Design | DB write échoue → réversion immédiate |

## 🔧 Migration vers vraie prod (TODO)
Pour rendre TOUT fonctionnel sur Vercel, il faut migrer :

### 1. SQLite → Turso (libSQL cloud)
```bash
npm install @libsql/client
```
- Créer un compte sur [turso.tech](https://turso.tech) (gratuit jusqu'à 500 DB)
- `turso db create romero` + récupérer URL + token
- Remplacer `better-sqlite3` par `@libsql/client` dans `src/lib/db.ts`
- Toutes les requêtes deviennent async (≈ 30 min de refactor)
- Ajouter `TURSO_URL` et `TURSO_AUTH_TOKEN` aux env vars Vercel

### 2. Upload de photos → Vercel Blob
```bash
npm install @vercel/blob
```
- Dans le dashboard Vercel : Storage → Blob → Create
- Récupérer `BLOB_READ_WRITE_TOKEN`
- Modifier `uploadPhoto()` dans `src/app/admin/(panel)/galleries/actions.ts` :
  ```ts
  import { put } from '@vercel/blob';
  const blob = await put(filename, buf, { access: 'public' });
  // Save blob.url instead of local filename
  ```
- Modifier `<img src>` partout pour utiliser l'URL Blob

### 3. Hébergement alternatif (sans migration)
Si tu préfères garder SQLite + uploads locaux tels quels, héberge sur :
- **Railway** ($5/mois, filesystem persistant)
- **Render** (plan Starter $7/mois, persistent disk)
- **VPS** (Hetzner ~5€/mois, plein contrôle)

## Setup local

```bash
cp .env.example .env.local
# Remplir RESEND_API_KEY, AUTH_SECRET, etc.

npm install
npm run dev
```

## Push & redéploiement

```bash
git push origin main
# Auto-deploy via Vercel git integration (si connecté), sinon :
vercel --prod --scope=romero-s-projects1
```
