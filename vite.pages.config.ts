import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/Apartment4Bella/" : "/",
  plugins: [react()],
  publicDir: "public",
  build: {
    outDir: "pages-dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
