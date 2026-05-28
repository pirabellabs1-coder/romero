import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getStrings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { getSettings } from "@/lib/settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const lang = getLangFromCookies();
  const t = getStrings(lang);
  const settings = await getSettings();
  return (
    <>
      <Header t={t} lang={lang} />
      {children}
      <Footer t={t} lang={lang} settings={settings} />
    </>
  );
}
