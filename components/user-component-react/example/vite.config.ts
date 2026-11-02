import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const exampleDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'user-component-react': path.resolve(exampleDir, '../src/index.ts'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 3000,
    open: true,
  },
});

