import { defineConfig } from "vite";

// The site works from the root of a domain by default. When it is served from a
// sub-folder (GitHub Pages: https://user.github.io/repo-name/) the deploy
// workflow sets BASE_PATH=/repo-name/ so every asset URL gets that prefix.
export default defineConfig({
  base: process.env.BASE_PATH || "/",
});
