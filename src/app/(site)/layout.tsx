import Script from "next/script";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getStrings } from "@/lib/i18n";
import { getLangFromCookies } from "@/lib/lang";
import { getSettings } from "@/lib/settings";
import { getPageContent } from "@/lib/page-content";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const lang = getLangFromCookies();
  const tRaw = getStrings(lang);
  const [settings, navOv, footerOv] = await Promise.all([
    getSettings(),
    getPageContent("nav", lang),
    getPageContent("footer", lang),
  ]);

  // CMS overrides for nav + footer applied here so the header/footer
  // never need to know the CMS exists.
  const t = {
    ...tRaw,
    nav: {
      home:      navOv.home      || tRaw.nav.home,
      about:     navOv.about     || tRaw.nav.about,
      services:  navOv.services  || tRaw.nav.services,
      portfolio: navOv.portfolio || tRaw.nav.portfolio,
      blog:      navOv.blog      || tRaw.nav.blog,
      reviews:   navOv.reviews   || tRaw.nav.reviews,
      contact:   navOv.contact   || tRaw.nav.contact,
    },
    book: navOv.book || tRaw.book,
    footer: {
      ...tRaw.footer,
      tagline:    footerOv.tagline    || tRaw.footer.tagline,
      explore:    footerOv.explore    || tRaw.footer.explore,
      contactCol: footerOv.contactCol || tRaw.footer.contactCol,
      legal:      footerOv.legal      || tRaw.footer.legal,
      privacy:    footerOv.privacy    || tRaw.footer.privacy,
      copy:       footerOv.copy       || tRaw.footer.copy,
    },
  };

  return (
    <>
      <Header t={t} lang={lang} />
      {children}
      <Footer t={t} lang={lang} settings={settings} />
      {/* Limova chatbot — public site only (admin pages have their own layout
          and never include this script). Strategy "lazyOnload" defers the
          fetch to after the page is interactive, so it never blocks the
          initial paint or the LCP image. */}
      <Script
        src="https://limova-web-sltj.onrender.com/scripts/chatbot-loader.js"
        data-connection-id="75e59a0a-2736-48d8-8cdd-d308a9343775"
        strategy="lazyOnload"
      />

      {/* Meta Pixel (Facebook) — public site only. Marked afterInteractive so
          the loader is queued right after hydration, giving accurate PageView
          fires without blocking the LCP. The <noscript> fallback fires a 1x1
          pixel image for visitors with JavaScript disabled. */}
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '960576553681106');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src="https://www.facebook.com/tr?id=960576553681106&ev=PageView&noscript=1"
          alt=""
        />
      </noscript>
    </>
  );
}
