import type { MetadataRoute } from "next";

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
  };
}
