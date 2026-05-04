import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    // Don't accidentally run Next/Prisma generated output as tests.
    exclude: ["node_modules", ".next", "dist"],
  },
});
