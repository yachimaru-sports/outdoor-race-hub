import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BUILD_TIME = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'emit-version-json',
      writeBundle(options) {
        const outDir = options?.dir || 'dist';
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(
          path.join(outDir, 'version.json'),
          JSON.stringify({ buildTime: BUILD_TIME }, null, 2) + '\n',
          'utf-8'
        );
      },
    },
  ],
  base: '/outdoor-race-hub/',
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
