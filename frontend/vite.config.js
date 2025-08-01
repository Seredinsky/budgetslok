import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/static/react/",               // assets served under /static/react/
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // позволяет '@/…' в импортах
    },
  },
  server: {
    host: "127.0.0.1",   // единый хост для фронта и бэка
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
});