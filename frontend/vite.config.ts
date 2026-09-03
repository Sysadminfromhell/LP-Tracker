import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

interface PackageJson {
  version?: unknown;
}

const packageJson = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as PackageJson;

const frontendVersion = typeof packageJson.version === 'string' ? packageJson.version : 'unknown';

export default defineConfig({
  plugins: [react()],

  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(frontendVersion),
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
