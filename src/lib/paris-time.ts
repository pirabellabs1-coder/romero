/**
 * Helpers d'heure française (Europe/Paris) — corrects, sans double
 * conversion de fuseau.
 *
 * Le piège classique : `new Date(now.toLocaleString("en-US", {timeZone})}`
 * crée une Date dont la valeur UTC est deja l'heure de Paris, puis
 * ré-appliquer un timeZone la décale une 2e fois. On utilise Intl
 * directement sur l'instant réel, une seule fois.
 */

const TZ = "Europe/Paris";

/** Date du jour à Paris au format ISO YYYY-MM-DD. */
export function parisYMD(instant: Date = new Date()): string {
  // en-CA formate en YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Ajoute n jours à une date ISO YYYY-MM-DD (robuste aux changements d'heure). */
export function addDaysYMD(ymd: string, n: number): string {
  const d = new Date(ymd + "T12:00:00Z"); // midi UTC : jamais d'ambiguïté DST
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Décalage courant de Paris sous forme "+02:00" (été) ou "+01:00" (hiver). */
export function parisOffset(instant: Date = new Date()): string {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "shortOffset",
  })
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName")?.value; // ex "GMT+2"
  const m = part?.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return "+01:00";
  const sign = m[1];
  const hh = m[2].padStart(2, "0");
  const mm = (m[3] || "00").padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

/** Chaîne humaine lisible : "mercredi 23 juillet 2026 à 15:20". */
export function parisHuman(instant: Date = new Date()): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

/** Bloc de contexte temporel à injecter dans un prompt système. */
export function parisTimeContext(): string {
  const now = new Date();
  const today = parisYMD(now);
  const off = parisOffset(now);
  return `\n\n# CONTEXTE TEMPOREL (heure française — Europe/Paris)
- Il est actuellement : ${parisHuman(now)} (fuseau Europe/Paris).
- Aujourd'hui (ISO) : ${today}
- Demain : ${addDaysYMD(today, 1)}
- Après-demain : ${addDaysYMD(today, 2)}
- Dans une semaine : ${addDaysYMD(today, 7)}
- Décalage horaire actuel : ${off} (UTC${off}).

Toutes les dates et heures que tu manipules sont en heure française. Quand quelqu'un dit « demain », « lundi prochain », « la semaine prochaine », « dans 10 jours », tu DOIS calculer la date toi-même à partir de ce contexte — ne demande JAMAIS de réécrire la date en toutes lettres. Confirme simplement : « donc mardi 23 juillet à 15 h 20, c'est bien ça ? ».
Pour un créneau, construis toujours l'ISO complet avec le décalage courant : YYYY-MM-DDTHH:MM:00${off}.`;
}
