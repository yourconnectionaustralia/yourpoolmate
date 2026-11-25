// Tell IndexNow search engines (Bing, Yandex, Seznam, Naver; Bing feeds
// ChatGPT search and Copilot) that the marketing site's pages changed, so
// they recrawl within minutes instead of weeks.
//
// Reads every <loc> from marketing/sitemap.xml. The key file
// marketing/<key>.txt is public by design: it proves we own the domain.
// Run by .github/workflows/indexnow.yml after a marketing change lands.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'yourpoolmate.com.au';

const keyFile = readdirSync(join(root, 'marketing')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('No IndexNow key file in marketing/');
const key = keyFile.replace('.txt', '');

const sitemap = readFileSync(join(root, 'marketing', 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList }),
});
console.log(`IndexNow: ${res.status} for ${urlList.length} URLs`);
if (res.status >= 400) process.exit(1);
