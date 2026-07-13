"use client";
/**
 * Charge le chatbot Limova sur toutes les pages publiques SAUF les routes
 * listées dans EXCLUDED_PATHS. Le composant tourne côté client uniquement
 * (usePathname), ce qui permet de faire ce filtre sans devoir dupliquer
 * la logique dans le layout serveur.
 *
 * Choix de rendre le composant conditionnel plutôt que masquer en CSS :
 *   - Aucun octet n'est téléchargé sur /concours (le loader Limova pèse
 *     ~130 KB une fois initialisé).
 *   - Rien à cacher, rien à nettoyer si le CSS du bot évolue côté Limova.
 */
import Script from "next/script";
import { usePathname } from "next/navigation";

const EXCLUDED_PATHS = ["/concours"];

export default function LimovaChat() {
  const pathname = usePathname() ?? "/";
  const excluded = EXCLUDED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (excluded) return null;
  return (
    <Script
      src="https://limova-web-sltj.onrender.com/scripts/chatbot-loader.js"
      data-connection-id="75e59a0a-2736-48d8-8cdd-d308a9343775"
      strategy="lazyOnload"
    />
  );
}
