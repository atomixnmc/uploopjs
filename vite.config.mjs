import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));
const pkg = (name) => resolve(rootDir, `packages/${name}/src/index.js`);

export default defineConfig({
  root: "examples",
  server: {
    port: 3000,
    open: true,
  },
  resolve: {
    conditions: ["import"],
    alias: {
      "@uploop/auth": pkg("auth"),
      "@uploop/core": pkg("core"),
      "@uploop/css": pkg("css"),
      "@uploop/devutils": pkg("devutils"),
      "@uploop/flows": pkg("flows"),
      "@uploop/html": pkg("html"),
      "@uploop/router": pkg("router"),
      "@uploop/schema": pkg("schema"),
      "@uploop/sst": pkg("sst"),
      "@uploop/state-machine": pkg("state-machine"),
      "@uploop/store": pkg("store"),
      "@uploop/stream": pkg("stream"),
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
