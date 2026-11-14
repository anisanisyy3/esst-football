import { defineConfig } from 'vite';

// Vite runs the app as a Single Page Application (SPA) by default.
// That means refreshing /matches or /admin still serves index.html
// (dev server + `vite preview`). On Netlify the redirect rule in
// netlify.toml does the same job.
export default defineConfig({
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  build: {
    target: 'es2020',
  },
});
