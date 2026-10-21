import { fileURLToPath } from 'node:url';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const shared = fileURLToPath(new URL('../../packages/shared', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  // basicSsl gives the dev server a self-signed HTTPS certificate: phones only allow the camera on HTTPS.
  plugins: [react(), basicSsl()],
  resolve: { alias: { '@shared': shared } },
  server: { host: true, port: 5173, fs: { allow: [repoRoot] } },
  preview: { host: true, port: 4173 },
  build: { target: 'es2020' },
});
