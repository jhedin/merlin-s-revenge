import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// Single-file build: inline the dynamic-import chunk (assets.json) into one JS bundle so the
// packaging step (tools/pack_singlefile.ts) can inline it directly into one self-contained HTML.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    target: "es2020",
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined,
        entryFileNames: "game.js",
      },
    },
  },
});
