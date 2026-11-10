import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@asmr/schema": path.resolve(__dirname, "../../packages/schema/src"),
      "@asmr/sim-core": path.resolve(__dirname, "../../packages/sim-core/src"),
      "@asmr/audio-core": path.resolve(__dirname, "../../packages/audio-core/src"),
      "@asmr/render-core": path.resolve(__dirname, "../../packages/render-core/src")
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "zustand", "lucide-react"],
          muxer: ["mediabunny"]
        }
      }
    }
  },
  server: {
    port: 5173,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp"
    }
  }
});
