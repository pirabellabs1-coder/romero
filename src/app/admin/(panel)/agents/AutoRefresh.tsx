"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Rafraîchit la route côté serveur toutes les N secondes en appelant
 * `router.refresh()` — les composants serveur re-render avec des
 * données à jour (health, événements récents, pulse live).
 *
 * Utilisé en tête de /admin/agents et des onglets Overview. Léger :
 * pas de polling API séparé, juste un re-render Next.js.
 *
 * S'arrête si l'onglet passe en arrière-plan pour économiser les
 * requêtes DB (les métriques ne bougent pas quand personne ne regarde).
 */
type Props = { intervalMs?: number };

export default function AutoRefresh({ intervalMs = 30_000 }: Props) {
  const router = useRouter();
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (id !== null) return;
      id = setInterval(() => router.refresh(), intervalMs);
    }
    function stop() {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") stop();
      else start();
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router, intervalMs]);
  return null;
}
