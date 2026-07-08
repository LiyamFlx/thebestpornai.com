import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        choose: resolve(__dirname, "choose.html"),
        creator: resolve(__dirname, "creator/index.html"),
        manager: resolve(__dirname, "manager/index.html"),
        viewer: resolve(__dirname, "viewer/index.html"),
        legalTerms: resolve(__dirname, "legal/terms.html"),
        legalPrivacy: resolve(__dirname, "legal/privacy.html"),
        legalDmca: resolve(__dirname, "legal/dmca.html"),
        legal2257: resolve(__dirname, "legal/2257.html"),
      },
      output: {
        // Split the huge catalog data (500+ videos) into its own chunk.
        // This allows better caching, parallel loading, and keeps main app chunks smaller.
        manualChunks(id) {
          if (id.includes('/shared/catalog.js')) {
            return 'catalog-data';
          }
          if (id.includes('/shared/streamhub-api.js')) {
            return 'streamhub-api';
          }
          if (id.includes('/shared/')) {
            return 'shared';
          }
        },
      },
    },
  },
});
