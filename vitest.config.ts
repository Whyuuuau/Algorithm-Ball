import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@asmr/schema": path.resolve(__dirname, "packages/schema/src"),
      "@asmr/sim-core": path.resolve(__dirname, "packages/sim-core/src"),
      "@asmr/audio-core": path.resolve(__dirname, "packages/audio-core/src"),
      "@asmr/render-core": path.resolve(__dirname, "packages/render-core/src")
    }
  },
  test: {
    include: ["packages/**/*.test.ts"],
    environment: "node"
  }
});

