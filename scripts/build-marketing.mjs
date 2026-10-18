// Copy the static marketing site, then place the shared app modules
// where the tool pages import them (/tools/lib/*.js).
//
// marketing/tools/lib/ is a committed mirror of those modules so a Pages
// project that publishes the marketing folder as-is still has them.
// This step overwrites that mirror in marketing-dist from src/lib, so the
// built output stays on the app source. sitemap.xml and robots.txt are
// copied with the rest of the tree. The app build (npm run build → dist)
// is not involved.

import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOL_MODULES } from './tool-modules.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'marketing');
const dest = join(root, 'marketing-dist');

async function copyTree(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const src = join(from, entry.name);
    const out = join(to, entry.name);
    if (entry.isDirectory()) await copyTree(src, out);
    else if (entry.isFile()) await cp(src, out);
  }
}

await rm(dest, { recursive: true, force: true });
await copyTree(source, dest);
const libDir = join(dest, 'tools', 'lib');
await mkdir(libDir, { recursive: true });
for (const file of TOOL_MODULES) {
  await cp(join(root, 'src', 'lib', file), join(libDir, file));
}
