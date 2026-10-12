import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

process.loadEnvFile?.();

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
