import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TOOL_MODULES } from '../../scripts/tool-modules.js';

const volumeHtml = readFileSync(new URL('../../marketing/tools/pool-volume-calculator/index.html', import.meta.url), 'utf8');
const chlorineHtml = readFileSync(new URL('../../marketing/tools/chlorine-dose-calculator/index.html', import.meta.url), 'utf8');
const homeHtml = readFileSync(new URL('../../marketing/index.html', import.meta.url), 'utf8');
const buildScript = readFileSync(new URL('../../scripts/build-marketing.mjs', import.meta.url), 'utf8');

function titleOf(html) {
  return html.match(/<title>([^<]*)<\/title>/)[1];
}

function descriptionOf(html) {
  return html.match(/<meta name="description" content="([^"]*)"/)[1];
}

test('each tool page has one h1, its own title and description, and the trial CTA', () => {
  for (const html of [volumeHtml, chlorineHtml]) {
    assert.equal(html.match(/<h1[\s>]/g).length, 1);
    assert.equal((html.match(/<h2[\s>]/g) || []).length >= 2, true);
    assert.match(html, /<h2>How it works<\/h2>/);
    assert.match(html, /Always follow the product label directions\./);
    assert.match(html, /function startFree\(\) \{ window\.location\.href = CONFIG\.APP_URL; \}/);
    assert.match(html, /APP_URL: "https:\/\/app\.yourpoolmate\.com\.au"/);
    assert.match(html, /onclick="startFree\(\)">Start free — 30-day trial/);
    assert.match(html, /lang="en-AU"/);
    assert.match(html, /Albert\+Sans/);
    assert.doesNotMatch(html, /Newsreader|fonts\.googleapis\.com\/css2\?family=Inter/);
    assert.doesNotMatch(html, /scan|OCR|test strip|photograph/i);
    assert.doesNotMatch(html, /\$79|\$49/);
  }

  assert.notEqual(titleOf(volumeHtml), titleOf(chlorineHtml));
  assert.notEqual(titleOf(volumeHtml), titleOf(homeHtml));
  assert.match(titleOf(volumeHtml), /Pool volume calculator/);
  assert.match(titleOf(chlorineHtml), /Chlorine dose calculator/);
  assert.notEqual(descriptionOf(volumeHtml), descriptionOf(chlorineHtml));
  assert.match(descriptionOf(volumeHtml), /litres/);
  assert.match(descriptionOf(chlorineHtml), /ppm/);
});

test('the pages call the shared modules and do not restate the formulas', () => {
  assert.match(volumeHtml, /from '\/tools\/lib\/poolVolume\.js'/);
  assert.match(volumeHtml, /poolVolumeLitres\(/);
  assert.match(volumeHtml, /trackToolUsed\(\s*TOOL_VOLUME/);
  assert.doesNotMatch(volumeHtml, /Math\.PI|0\.85|\* 1000|kl \* 8/);

  assert.match(chlorineHtml, /from '\/tools\/lib\/dosing\.js'/);
  assert.match(chlorineHtml, /chlorineRaiseDose\(/);
  assert.match(chlorineHtml, /CHLORINE_RAISE_PRODUCTS/);
  assert.match(chlorineHtml, /trackToolUsed\(\s*TOOL_CHLORINE/);
  assert.match(chlorineHtml, /href="\/tools\/pool-volume-calculator\/"/);
  assert.doesNotMatch(chlorineHtml, /kl \* 8|kl \* 1\.4|dichlor|trichlor/i);

  assert.match(volumeHtml, /addEventListener\(\s*'submit'/);
  assert.match(chlorineHtml, /addEventListener\(\s*'submit'/);
  assert.doesNotMatch(volumeHtml, /addEventListener\(\s*'input'[\s\S]{0,180}trackToolUsed/);
  assert.doesNotMatch(chlorineHtml, /addEventListener\(\s*'input'[\s\S]{0,180}trackToolUsed/);
});

test('the homepage footer links to both tools and the build copies every imported module', () => {
  assert.match(homeHtml, /href="\/tools\/pool-volume-calculator\/"/);
  assert.match(homeHtml, /href="\/tools\/chlorine-dose-calculator\/"/);
  assert.match(homeHtml, /\$79 once, lifetime/);
  assert.match(homeHtml, /\$49\/year/);
  assert.match(buildScript, /TOOL_MODULES/);
  assert.match(buildScript, /join\(root, 'src', 'lib', file\)/);
  for (const file of ['dosing.js', 'poolVolume.js', 'toolAnalytics.js', 'dosingSafety.js']) {
    assert.equal(TOOL_MODULES.includes(file), true);
    const imported = volumeHtml.includes(`/tools/lib/${file}`) || chlorineHtml.includes(`/tools/lib/${file}`);
    assert.equal(imported, true, file);
    const source = readFileSync(new URL(`../../src/lib/${file}`, import.meta.url));
    const mirror = readFileSync(new URL(`../../marketing/tools/lib/${file}`, import.meta.url));
    assert.deepEqual(mirror, source);
  }
});

test('sitemap and robots ship with the marketing folder', () => {
  const sitemap = readFileSync(new URL('../../marketing/sitemap.xml', import.meta.url), 'utf8');
  const robots = readFileSync(new URL('../../marketing/robots.txt', import.meta.url), 'utf8');
  for (const loc of [
    'https://yourpoolmate.com.au/',
    'https://yourpoolmate.com.au/privacy',
    'https://yourpoolmate.com.au/terms',
    'https://yourpoolmate.com.au/tools/pool-volume-calculator/',
    'https://yourpoolmate.com.au/tools/chlorine-dose-calculator/',
  ]) {
    assert.match(sitemap, new RegExp(`<loc>${loc.replace(/[/.]/g, '\\$&')}</loc>`));
  }
  assert.equal((sitemap.match(/<loc>/g) || []).length, 5);
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/yourpoolmate\.com\.au\/sitemap\.xml/);
  assert.match(buildScript, /copyTree\(source, dest\)/);
});
