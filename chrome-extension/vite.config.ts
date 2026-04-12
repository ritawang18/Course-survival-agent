import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-extension-manifest",
      async closeBundle() {
        const manifestPath = resolve(__dirname, "public/manifest.json");
        const outDir = resolve(__dirname, "dist");
        const outManifestPath = resolve(outDir, "manifest.json");
        const manifest = await readFile(manifestPath, "utf8");
        await mkdir(outDir, { recursive: true });
        await writeFile(outManifestPath, manifest, "utf8");
      }
    }
  ],
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, "sidepanel.html"),
        options: resolve(__dirname, "options.html"),
        background: resolve(__dirname, "src/background/service-worker.ts"),
        content: resolve(__dirname, "src/content/index.ts")
      },
      output: {
        entryFileNames(chunkInfo) {
          if (chunkInfo.name === "background") return "background.js";
          if (chunkInfo.name === "content") return "content.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
