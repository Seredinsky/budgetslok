import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: "/static/react/",               // assets served under /static/react/
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Бюджет Службы обеспечения качества',
        short_name: 'Бюджет СлОК',
        start_url: '/static/react/',
        scope: '/static/react/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#42b883',
        lang: 'ru',
        icons: [
          { src: '/static/react/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/static/react/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
          },
          {
            urlPattern: ({ request }) =>
              ['script', 'style', 'image', 'font'].includes(request.destination),
            handler: 'StaleWhileRevalidate',
          },
          {
            urlPattern: /\/api\//,
            handler: 'NetworkFirst',
          },
        ],
      },
    }),
  ],
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