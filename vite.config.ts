import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt", bukan "autoUpdate": autoUpdate bisa me-reload saat panel
      // edit sedang terbuka dan isian hilang. UpdateBanner menawarkan muat ulang.
      registerType: "prompt",
      includeAssets: ["favicon.svg", "icon-180.png"],
      manifest: {
        name: "Dashboard freelance",
        short_name: "Freelance",
        description: "Lead, proyek, tagihan, dan aset freelance",
        lang: "id",
        theme_color: "#ffffff",
        background_color: "#f9fafb",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
      },
    }),
  ],
  build: {
    // Firebase (terutama Firestore) memang besar; dipisah supaya cache-nya awet antar deploy.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          if (/node_modules\/(@?firebase)\//.test(id)) return "firebase";
        },
      },
    },
  },
});
