import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TOOL_CHLORINE,
  TOOL_VOLUME,
  createToolUseGate,
  toolUsedParams,
  trackToolUsed,
} from './toolAnalytics.js';

const location = {
  origin: 'https://yourpoolmate.com.au',
  pathname: '/tools/pool-volume-calculator/',
};

test('tool_used carries the tool name and a clean page location', () => {
  assert.deepEqual(toolUsedParams(TOOL_VOLUME, location), {
    tool_name: 'pool_volume_calculator',
    page_location: 'https://yourpoolmate.com.au/tools/pool-volume-calculator/',
    page_path: '/tools/pool-volume-calculator/',
  });
  assert.deepEqual(
    toolUsedParams(TOOL_CHLORINE, {
      origin: 'https://yourpoolmate.com.au',
      pathname: '/tools/chlorine-dose-calculator/?utm_source=fb#hash',
    }),
    {
      tool_name: 'chlorine_dose_calculator',
      page_location: 'https://yourpoolmate.com.au/tools/chlorine-dose-calculator/',
      page_path: '/tools/chlorine-dose-calculator/',
    },
  );
  assert.equal(toolUsedParams('scan_test', location), null);
  assert.equal(JSON.stringify(toolUsedParams(TOOL_VOLUME, location)).includes('@'), false);
});

test('the same calculation fires once; a new one fires again', () => {
  const calls = [];
  const gtag = (...args) => calls.push(args);
  const gate = createToolUseGate();
  const options = { gate, gtag, location };

  assert.equal(trackToolUsed(TOOL_VOLUME, '', options), false);
  assert.equal(trackToolUsed(TOOL_VOLUME, 'rectangle|48000', options), true);
  assert.equal(trackToolUsed(TOOL_VOLUME, 'rectangle|48000', options), false);
  assert.equal(trackToolUsed(TOOL_VOLUME, 'round|23562', options), true);
  assert.equal(trackToolUsed('not_a_tool', 'round|23562', options), false);
  assert.equal(trackToolUsed(TOOL_CHLORINE, 'liquid|540', { gate, gtag: undefined, location }), false);

  assert.deepEqual(calls.map((call) => [call[0], call[1], call[2].tool_name]), [
    ['event', 'tool_used', 'pool_volume_calculator'],
    ['event', 'tool_used', 'pool_volume_calculator'],
  ]);
  assert.equal(calls[0][2].page_location.includes('?'), false);
});
