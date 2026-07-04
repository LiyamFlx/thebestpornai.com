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
      },
    },
  },
});
