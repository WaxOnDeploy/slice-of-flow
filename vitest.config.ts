import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Do not load the app's Vite config or its editor/runtime plugins in tests.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./client/src", import.meta.url)),
    },
  },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
  },
});
