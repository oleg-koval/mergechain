import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.config';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      // ponytail: settings page is an HTML entry; CRXJS picks up the rest from manifest.
      input: { settings: 'src/settings/settings.html' },
    },
  },
  // CRXJS needs a stable port for the HMR websocket in MV3 dev.
  server: { port: 5173, strictPort: true, hmr: { port: 5173 } },
});
