// Dev server for the static marketing site. Tool pages import the app's
// dosing and volume modules from /tools/lib/, which the production build
// copies into marketing-dist. Here those URLs are served from src/lib.

import { createReadStream, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { TOOL_MODULES } from './scripts/tool-modules.js';

const root = dirname(fileURLToPath(import.meta.url));
const shared = new Map(
  TOOL_MODULES.map((file) => [`/tools/lib/${file}`, join(root, 'src', 'lib', file)]),
);

export default defineConfig({
  root: resolve(root, 'marketing'),
  server: {
    port: 5174,
    strictPort: true,
    fs: { allow: [resolve(root, 'marketing'), resolve(root, 'src/lib')] },
  },
  plugins: [
    {
      name: 'serve-shared-tool-modules',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = (req.url || '').split('?')[0];
          const file = shared.get(url);
          if (!file || !existsSync(file)) return next();
          res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
          createReadStream(file).pipe(res);
        });
      },
    },
  ],
});
