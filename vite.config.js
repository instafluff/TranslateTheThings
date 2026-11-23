import { defineConfig } from 'vite';

// Relative asset paths let the generated dist/ work from a subfolder.
export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist' },
});
