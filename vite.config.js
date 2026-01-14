import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
    host: true // Allow access from mobile devices on local network
  },
  build: {
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
