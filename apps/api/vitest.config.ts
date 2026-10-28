import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 60000,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary"],
      include: [
        "src/services/**",
        "src/repositories/**",
        "src/mappers/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
