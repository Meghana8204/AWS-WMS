import { defineConfig } from "@lovable.dev/vite-tanstack-config";

<<<<<<< HEAD
export default (defineConfig as any)({
=======
export default defineConfig({
>>>>>>> main
  server: {
    port: 8080,
    strictPort: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
