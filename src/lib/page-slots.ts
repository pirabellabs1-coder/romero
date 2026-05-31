/**
 * Per-page slot configuration for the CMS sections editor.
 *
 * Each page in the site exposes its own set of insertion points where
 * the photographer can add custom modular sections. The home keeps its
 * original 6 slots (defined in page-sections-types). Other pages get a
 * subset that matches their structure.
 *
 * To add a new slot to a page:
 *   1. Add the slot to SectionSlot union in page-sections-types.ts
 *   2. Add it to the page's list here.
 *   3. Insert a <PageSections page="..." slot="..."> in the public page.
 */
import type { SectionSlot } from "@/lib/page-sections-types";

export type PageSlotConfig = {
  slots: SectionSlot[];
  labels: Partial<Record<SectionSlot, string>>;
};

export const PAGE_SLOTS: Record<string, PageSlotConfig> = {
  // Home keeps its original 6 slots (the type's full union).
  home: {
    slots: ["top", "after-hero", "after-values", "after-featured", "after-quote", "bottom"],
    labels: {}, // uses defaults from page-sections-types
  },
  // Other pages: 2 universal insertion points for now (top of page,
  // bottom of page). We can add page-specific slots later if needed.
  about: {
    slots: ["top", "bottom"],
    labels: { top: "Tout en haut de la page", bottom: "Tout en bas de la page" },
  },
  services: {
    slots: ["top", "bottom"],
    labels: { top: "Tout en haut de la page", bottom: "Tout en bas de la page" },
  },
  portfolio: {
    slots: ["top", "bottom"],
    labels: { top: "Tout en haut de la page", bottom: "Tout en bas de la page" },
  },
  blog: {
    slots: ["top", "bottom"],
    labels: { top: "Tout en haut de la page", bottom: "Tout en bas de la page" },
  },
  reviews: {
    slots: ["top", "bottom"],
    labels: { top: "Tout en haut de la page", bottom: "Tout en bas de la page" },
  },
  contact: {
    slots: ["top", "bottom"],
    labels: { top: "Tout en haut de la page", bottom: "Tout en bas de la page" },
  },
};
