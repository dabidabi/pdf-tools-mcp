import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const env = (globalThis as typeof globalThis & { process?: { env?: { PORT?: string } } }).process?.env;

export default defineConfig({
  plugins: [react()],
  server: env?.PORT
    ? { port: Number(env.PORT), strictPort: true }
    : undefined,
  build: {
    target: "es2022"
  }
});
