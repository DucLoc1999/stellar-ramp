import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import { createServer } from './server/index';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), expressPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
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
  };
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
