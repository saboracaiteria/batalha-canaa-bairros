import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // CRITICAL for GitHub Pages
  server: {
    port: 3000,
    open: true,
    host: true // Allow access from mobile devices on local network
  },
  build: {
    outDir: 'docs', // Build to docs folder for GitHub Pages
    target: 'es2015',
    minify: 'terser',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/database']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['three', 'firebase/app', 'firebase/auth', 'firebase/database']
  }
});
