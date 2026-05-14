import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { createServer } from './server/index';

export default defineConfig({
  plugins: [react(), tailwindcss(), expressPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
  server: {
    host: '::',
    port: 5173,
    hmr: process.env.DISABLE_HMR !== 'true',
    fs: {
      allow: ['.', './shared', './server'],
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**'],
    },
  },
  build: {
    outDir: 'dist/spa',
  },
});

function expressPlugin(): Plugin {
  return {
    name: 'express-plugin',
    apply: 'serve',
    configureServer(server) {
      const app = createServer();
      server.middlewares.use(app);
    },
  };
}
