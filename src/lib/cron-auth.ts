/**
 * Authentification des crons Vercel
 * ─────────────────────────────────
 * Tous les crons attendent l'en-tête `Authorization: Bearer <CRON_SECRET>`
 * envoyé par le planificateur Vercel. On refuse par défaut (fail-CLOSED) :
 *
 *   - Si CRON_SECRET n'est PAS défini → on refuse (config incomplète =
 *     endpoint public déclenchant des envois d'emails / notifs = danger).
 *   - Si le Bearer ne correspond pas → on refuse.
 *
 * L'ancien schéma « if (secret) { … } » laissait passer TOUTE requête quand
 * la variable manquait (fail-OPEN) : un endpoint de relance facture / rappel
 * agenda joignable sans secret pouvait être spammé.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // pas de secret configuré = on bloque
  const authHeader = req.headers.get("authorization") || "";
  return authHeader === `Bearer ${secret}`;
}
