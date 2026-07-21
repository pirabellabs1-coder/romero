/**
 * Middleware Next.js — deux couches :
 *  1) « Porte magique » — cache /admin/* derrière un chemin secret
 *     (ADMIN_UNLOCK_KEY). Une visite du chemin magique pose un cookie
 *     rp_admin_unlock 90 jours. Sans ce cookie, /admin/* redirige vers
 *     la home (comme si l'admin n'existait pas). Réduit le bruit des
 *     bots. Fail-open si l'ENV n'est pas définie.
 *  2) Gate session — /admin/* (hors login + oauth) exige la session
 *     rp_session sinon redirect vers /admin/login.
 */
import { NextResponse, type NextRequest } from "next/server";

const UNLOCK_COOKIE = "rp_admin_unlock";
const UNLOCK_MAX_AGE = 60 * 60 * 24 * 90; // 90 jours

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secret = process.env.ADMIN_UNLOCK_KEY;

  // ─── (1) Porte magique ─────────────────────────────────────────────
  // Visiter "/{ADMIN_UNLOCK_KEY}" pose le cookie et redirige vers login.
  if (secret && secret.length >= 8 && pathname === "/" + secret) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    const resp = NextResponse.redirect(url);
    resp.cookies.set(UNLOCK_COOKIE, secret, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: UNLOCK_MAX_AGE,
      path: "/",
    });
    return resp;
  }

  // Tout ce qui n'est pas /admin passe sans autre vérif.
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  // ─── (1 bis) Gate unlock ───────────────────────────────────────────
  // Si l'ENV est configurée, /admin/* exige le cookie d'unlock.
  // Sans cookie → redirect home (stealth).
  if (secret && secret.length >= 8) {
    const unlock = req.cookies.get(UNLOCK_COOKIE)?.value;
    if (unlock !== secret) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // ─── (2) Gate session ──────────────────────────────────────────────
  // Une fois passé l'unlock, on veut aussi être connecté (sauf pour la
  // page de login et les endpoints auth).
  if (pathname === "/admin/login") return NextResponse.next();
  if (pathname.startsWith("/api/auth/")) return NextResponse.next();

  const token = req.cookies.get("rp_session")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // On exclut /api (webhooks, OAuth callbacks, cron), /_next (assets)
  // et tout ce qui contient un point (fichiers statiques). Le reste
  // passe par la middleware pour détecter le chemin magique.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
