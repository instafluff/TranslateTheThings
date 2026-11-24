import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [{
    name: 'use-source-in-dev',
    apply: 'serve',
    transformIndexHtml: { order: 'pre', handler: html => html.replace('./assets/app.js', './src/main.js') },
  }],
  build: {
    target: 'es2022',
    rollupOptions: { input: 'src/main.js', output: { entryFileNames: 'assets/app.js' } },
  },
});
