// The /guides/ pages on the marketing site: every guide is indexable,
// carries valid structured data, the site's one GA tag and the CTA
// tracker, is listed in the sitemap and llms.txt, and links only to
// pages that exist.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const marketing = new URL('../../marketing/', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, marketing), 'utf8');
const SITE = 'https://yourpoolmate.com.au';

const slugs = readdirSync(new URL('guides/', marketing), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();
const pages = [{ rel: 'guides/index.html', path: '/guides/' }, ...slugs.map((s) => ({ rel: `guides/${s}/index.html`, path: `/guides/${s}/` }))];

test('there is a hub and at least six guides', () => {
  assert.equal(existsSync(new URL('guides/index.html', marketing)), true);
  assert.ok(slugs.length >= 6, `only ${slugs.length} guides`);
});

test('each guide page is indexable with one h1, a canonical and parseable JSON-LD', () => {
  for (const { rel, path } of pages) {
    const html = read(rel);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, rel);
    assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}${path}" />`), rel);
    assert.match(html, /<meta name="description" content="[^"]{70,170}" \/>/, rel);
    assert.equal(/name="robots" content="noindex/.test(html), false, rel);
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.ok(ld.length >= 1, rel);
    for (const [, json] of ld) JSON.parse(json);
    if (path !== '/guides/') {
      const types = JSON.parse(ld[0][1])['@graph'].map((n) => n['@type']);
      for (const t of ['Article', 'BreadcrumbList', 'FAQPage']) assert.ok(types.includes(t), `${rel} missing ${t}`);
    }
  }
});

test('guides carry the one GA tag and the start-free tracker', () => {
  for (const { rel } of pages) {
    const html = read(rel);
    assert.deepEqual(html.match(/G-[A-Z0-9]+/g), ['G-ETWSG20K0R', 'G-ETWSG20K0R'], rel);
    assert.match(html, /<script src="\/site-analytics\.js" defer><\/script>/, rel);
  }
  for (const rel of ['index.html', 'privacy.html', 'terms.html', 'tools/pool-volume-calculator/index.html', 'tools/chlorine-dose-calculator/index.html']) {
    assert.match(read(rel), /\/site-analytics\.js/, rel);
  }
});

test('every guide is in the sitemap and llms.txt', () => {
  const sitemap = read('sitemap.xml');
  const llms = read('llms.txt');
  for (const { path } of pages) {
    assert.ok(sitemap.includes(`<loc>${SITE}${path}</loc>`), path);
    assert.ok(llms.includes(`${SITE}${path}`), path);
  }
});

test('internal links on guide pages point at files that exist', () => {
  for (const { rel } of pages) {
    const html = read(rel);
    for (const [, href] of html.matchAll(/href="(\/[^"#?]*)/g)) {
      if (href.startsWith('//')) continue;
      const file = href.endsWith('/') ? `${href.slice(1)}index.html` : href.slice(1);
      assert.equal(existsSync(new URL(file || 'index.html', marketing)), true, `${rel} → ${href}`);
    }
  }
});

test('robots.txt lets AI answer engines read the site', () => {
  const robots = read('robots.txt');
  for (const bot of ['OAI-SearchBot', 'GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
    assert.match(robots, new RegExp(`User-agent: ${bot}\\nAllow: /`));
  }
  assert.equal(/Disallow: \/\s*$/m.test(robots), false);
});
