import { defineConfig } from "@lovable.dev/vite-tanstack-config";
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8080,
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
