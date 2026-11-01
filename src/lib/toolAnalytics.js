// File: src/lib/toolAnalytics.js
//
// GA4 for the static marketing calculators. The pages keep the site's
// existing gtag config, which already sends page_view. This module only
// sends tool_used, and only after a successful calculation.
//
// Event name and param follow the custom-event style in draft PR #16:
// snake_case event, a short allowlisted param, and a page_location with
// no query string and no hash. No email, name, or account id.

export const TOOL_VOLUME = 'pool_volume_calculator';
export const TOOL_CHLORINE = 'chlorine_dose_calculator';

const TOOL_NAMES = new Set([TOOL_VOLUME, TOOL_CHLORINE]);

export function toolUsedParams(toolName, loc = {}) {
  if (!TOOL_NAMES.has(toolName)) return null;
  const params = { tool_name: toolName };
  const origin = typeof loc.origin === 'string' ? loc.origin : '';
  const path = typeof loc.pathname === 'string' ? loc.pathname.split('?')[0].split('#')[0] : '';
  if (origin && path.startsWith('/')) {
    params.page_location = `${origin}${path}`;
    params.page_path = path;
  }
  return params;
}

/** True once per distinct successful calculation. Same signature does not fire again. */
export function createToolUseGate() {
  let last = null;
  return function shouldTrack(signature) {
    if (typeof signature !== 'string' || signature.length === 0) return false;
    if (signature === last) return false;
    last = signature;
    return true;
  };
}

/**
 * Queue tool_used. No-op without gtag, without a known tool name, or when
 * the gate rejects a repeat of the same calculation.
 */
export function trackToolUsed(toolName, signature, options = {}) {
  const params = toolUsedParams(toolName, options.location || {});
  if (!params) return false;
  const gtag = options.gtag;
  if (typeof gtag !== 'function') return false;
  const gate = options.gate;
  if (typeof gate === 'function' && !gate(signature)) return false;
  gtag('event', 'tool_used', params);
  return true;
}
