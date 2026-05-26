import { test, expect } from "@playwright/test";

/**
 * Public-site smoke tests. Verifies the pages real visitors hit
 * actually render correct content, don't crash, and respect basic
 * accessibility (title, single h1, etc.).
 */

const PUBLIC_PAGES = [
  { path: "/", title: /Romero Photography/, eyebrowKeyword: "PHOTOGRAPHE DE MARIAGE" },
  { path: "/a-propos", title: /À propos/, eyebrowKeyword: "MICKAEL ROMERO" },
  { path: "/prestations", title: /Prestations/, eyebrowKeyword: "PRESTATIONS" },
  { path: "/portfolio", title: /Portfolio/, eyebrowKeyword: "PORTFOLIO" },
  { path: "/avis", title: /Avis/, eyebrowKeyword: "AVIS" },
  { path: "/blog", title: /Journal/, eyebrowKeyword: "JOURNAL" },
  { path: "/contact", title: /Contact/, eyebrowKeyword: "CONTACT" },
  { path: "/mentions-legales", title: /Mentions/, eyebrowKeyword: "MENTIONS LÉGALES" },
  { path: "/politique-confidentialite", title: /Politique/, eyebrowKeyword: "CONFIDENTIALITÉ" },
];

for (const page of PUBLIC_PAGES) {
  test(`public page ${page.path} renders with correct title`, async ({ page: pw }) => {
    const resp = await pw.goto(page.path);
    expect(resp?.status(), `${page.path} HTTP`).toBeLessThan(400);
    await expect(pw).toHaveTitle(page.title);
    // Exactly one <h1> per page is good SEO hygiene and a11y.
    const h1Count = await pw.locator("h1").count();
    expect(h1Count, `${page.path} h1 count`).toBe(1);
  });
}

test("portfolio gallery detail page renders with photos", async ({ page }) => {
  await page.goto("/portfolio/manon-kevin");
  // The gallery hero shows the couple's names
  await expect(page.locator("h1")).toContainText(/Manon/i);
  // At least some photos in the masonry
  const imgs = await page.locator("img").count();
  expect(imgs, "masonry has images").toBeGreaterThanOrEqual(3);
});

test("blog article renders without 500", async ({ page }) => {
  // This was a real regression we caught — DOMPurify broke all blog
  // posts. Lock it in with a smoke test so it never happens again.
  const resp = await page.goto("/blog/heure-doree");
  expect(resp?.status()).toBe(200);
  await expect(page.locator("h1")).toBeVisible();
});

test("contact form is present and responsive", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.locator('input[name="firstName"], input').first()).toBeVisible();
  // The submit button shouldn't be overflowing on mobile (regression
  // protection for the form-grid bug we fixed).
  const btn = page.locator('button[type="submit"]');
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  expect(box?.width, "submit button fits viewport").toBeLessThanOrEqual(viewportWidth);
});

test("sitemap.xml lists at least the home page", async ({ page }) => {
  const resp = await page.goto("/sitemap.xml");
  expect(resp?.status()).toBe(200);
  const body = await resp?.text();
  expect(body).toContain("<loc>");
  expect(body).toContain("/portfolio");
});

test("admin login redirects when no session", async ({ page }) => {
  // Should redirect to /admin/login (we follow the redirect automatically)
  await page.goto("/admin/galleries");
  await expect(page).toHaveURL(/\/admin\/login/);
  // The login form should be visible
  await expect(page.locator('input[name="password"]')).toBeVisible();
});
