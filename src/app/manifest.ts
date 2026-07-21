import type { MetadataRoute } from "next";

/**
 * Manifest PWA — installable sur mobile/desktop en « Ajouter à l'écran ».
 * Les shortcuts permettent d'accéder direct aux sections admin depuis
 * un long-press sur l'icône (iOS/Android/Chrome desktop).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Romero Photography",
    short_name: "Romero",
    description: "Photographe de mariage à Nice & sur la Côte d'Azur.",
    start_url: "/",
    display: "standalone",
    background_color: "#F8F4EC",
    theme_color: "#2E3D2E",
    orientation: "portrait-primary",
    lang: "fr-FR",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    categories: ["photography", "lifestyle", "business"],
    // Raccourcis admin (long-press sur l'icône installée)
    shortcuts: [
      {
        name: "Inbox",
        short_name: "Inbox",
        description: "Toutes les conversations et leads",
        url: "/admin/inbox",
      },
      {
        name: "Calendrier",
        short_name: "Calendrier",
        description: "Mariages à venir",
        url: "/admin/calendar",
      },
      {
        name: "Analytics",
        short_name: "Stats",
        description: "Vue d'ensemble",
        url: "/admin/analytics",
      },
      {
        name: "Réponses IA",
        short_name: "IA",
        description: "Brouillons à valider",
        url: "/admin/approvals",
      },
    ],
  };
}
