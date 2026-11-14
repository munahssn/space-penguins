import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Aladin Lite (sky map) is one ~2.4 MB chunk, loaded lazily on the viewer page only.
  build: { chunkSizeWarningLimit: 2500 },
});
