import { cookies } from "next/headers";
import { isLang, type Lang } from "@/lib/i18n";

export const LANG_COOKIE = "lang";

export function getLangFromCookies(): Lang {
  const c = cookies().get(LANG_COOKIE)?.value;
  return isLang(c) ? c : "fr";
}
