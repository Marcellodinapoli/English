import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alinea — Learn English",
    short_name: "Alinea",
    description:
      "Adaptive English learning from ZERO to C1 — web, mobile and desktop.",
    start_url: "/home",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#eef1f4",
    theme_color: "#0f6e6a",
    categories: ["education", "productivity"],
    lang: "it",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}