import { resolve } from "node:path";
import { defineConfig } from "vite";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  root: ".",
  define: {
    "process.env.SUPABASE_URL": JSON.stringify(process.env.SUPABASE_URL),
    "process.env.SUPABASE_KEY": JSON.stringify(process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY),
  },
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
          // The full video list is ONLY reached via a dynamic import() from
          // catalog.js. Give it its own chunk (not the catch-all 'shared' bucket
          // below, which also holds statically-imported modules and would drag
          // this 1.9 MB payload into the entry's eager modulepreload graph).
          // On its own it stays a lazy async chunk, fetched after first paint.
          if (id.includes('/shared/catalog-videos.js')) {
            return 'catalog-videos';
          }
          // Keep taxonomy in the same chunk as catalog.js — catalog's DATA
          // references taxonomy's CATEGORIES at module-init time, so splitting
          // them across chunks causes a cross-chunk temporal-dead-zone error.
          if (id.includes('/shared/catalog.js') || id.includes('/shared/taxonomy.js')) {
            return 'catalog-data';
          }
          if (id.includes('/shared/streamhub-api.js')) {
            return 'streamhub-api';
          }
          // legal.css is its own standalone <link> entry point for the four
          // legal/*.html pages only — it must NOT land in this bucket. Every
          // other /shared/ module funneled into 'shared' gets its CSS merged
          // into one shared-*.css file that index.html also loads (Vite merges
          // CSS per JS chunk name), which was leaking legal.css's body{padding:
          // 40px 20px} (meant to center the legal pages' narrow text column)
          // into the main app's global <body>, pushing the whole sidebar/topbar
          // down and right on every page.
          if (id.includes('/shared/') && !id.endsWith('.css')) {
            return 'shared';
          }
        },
      },
    },
  },
});
