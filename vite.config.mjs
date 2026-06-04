import { defineConfig } from "vite";

export default defineConfig({
  root: "examples",
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    conditions: ["import"],
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
