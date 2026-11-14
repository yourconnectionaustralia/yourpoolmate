// Source-shape tests assert on the app's UI code as text. That code used to live
// entirely in App.jsx; it now spans App.jsx plus everything under src/app/, so
// tests read the combined source.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.jsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));
}

export function appSource() {
  const parts = [readFileSync(path.join(srcDir, 'App.jsx'), 'utf8')];
  for (const f of walk(path.join(srcDir, 'app'))) parts.push(readFileSync(f, 'utf8'));
  return parts.join('\n');
}
