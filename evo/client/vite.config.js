import { defineConfig } from "vite";

export default defineConfig({
  server: { proxy: { "/api": "http://localhost:80", "/ws": { target: "ws://localhost:80", ws: true } } },
});
