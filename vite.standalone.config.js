import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config.js';

// ============================================================================
// "PORTABLE" BUILD CONFIG - used only by scripts/make-standalone.mjs
// (npm.cmd run build:standalone).
//
// It produces the `esst-website/` folder: a version of the site you can open
// by double-clicking index.html, with no dev server, no installation and no
// internet needed (the site then runs in demo mode).
// ============================================================================

export default mergeConfig(
  baseConfig,
  defineConfig({
    // Relative URLs so the folder works from anywhere on any machine.
    base: './',
    build: {
      target: 'es2020',
      outDir: 'esst-website',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          // One single bundle: browsers refuse to fetch separate ES module
          // files from file:// (CORS), so nothing may stay a separate file.
          inlineDynamicImports: true,
        },
      },
    },
  })
);
