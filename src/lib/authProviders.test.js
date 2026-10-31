import assert from 'node:assert/strict';
import test from 'node:test';
import {
  friendlyRedirectError,
  parseAuthRedirectError,
  parseEnabledProviders,
  providerErrorMessage,
} from './authProviders.js';

test('parseEnabledProviders: unset or empty means email only', () => {
  assert.deepEqual(parseEnabledProviders(undefined), []);
  assert.deepEqual(parseEnabledProviders(''), []);
  assert.deepEqual(parseEnabledProviders('   '), []);
  assert.deepEqual(parseEnabledProviders(null), []);
});

test('parseEnabledProviders: trims, lowercases, drops unknown names', () => {
  assert.deepEqual(parseEnabledProviders(' Google , APPLE '), ['google', 'apple']);
  assert.deepEqual(parseEnabledProviders('google,facebook'), ['google']);
  assert.deepEqual(parseEnabledProviders('facebook'), []);
});

test('parseEnabledProviders: on-screen order is fixed, not env order', () => {
  assert.deepEqual(parseEnabledProviders('apple,google'), ['google', 'apple']);
  assert.deepEqual(parseEnabledProviders('apple'), ['apple']);
});

test('parseAuthRedirectError: clean URL returns null', () => {
  assert.equal(parseAuthRedirectError('', ''), null);
  assert.equal(parseAuthRedirectError('#access_token=abc&type=signup', ''), null);
  assert.equal(parseAuthRedirectError(undefined, undefined), null);
});

test('parseAuthRedirectError: reads the hash form', () => {
  const hash =
    '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
  assert.deepEqual(parseAuthRedirectError(hash, ''), {
    error: 'access_denied',
    code: 'otp_expired',
    description: 'Email link is invalid or has expired',
  });
});

test('parseAuthRedirectError: reads the query form', () => {
  const search = '?error=server_error&error_code=unexpected_failure&error_description=Oops';
  assert.deepEqual(parseAuthRedirectError('', search), {
    error: 'server_error',
    code: 'unexpected_failure',
    description: 'Oops',
  });
});

test('friendlyRedirectError: nothing in, nothing out', () => {
  assert.equal(friendlyRedirectError(null), '');
});

test('friendlyRedirectError: expired email link beats access_denied', () => {
  const msg = friendlyRedirectError({
    error: 'access_denied',
    code: 'otp_expired',
    description: 'Email link is invalid or has expired',
  });
  assert.match(msg, /expired/);
  assert.doesNotMatch(msg, /cancelled/);
});

test('friendlyRedirectError: user backing out of Google/Apple is not an error', () => {
  const msg = friendlyRedirectError({
    error: 'access_denied',
    code: '',
    description: 'The user denied access',
  });
  assert.match(msg, /cancelled/);
});

test('friendlyRedirectError: anything else gets a generic retry', () => {
  const msg = friendlyRedirectError({ error: 'server_error', code: 'unexpected_failure', description: 'x' });
  assert.match(msg, /try again/);
});

test('providerErrorMessage: provider not switched on in Supabase', () => {
  const msg = providerErrorMessage({ message: 'Unsupported provider: provider is not enabled' }, 'apple');
  assert.match(msg, /^Apple sign-in isn't available just yet/);
});

test('providerErrorMessage: rate limit and fallback', () => {
  assert.match(providerErrorMessage({ message: 'rate limit exceeded' }, 'google'), /Too many attempts/);
  assert.match(providerErrorMessage({ message: 'boom' }, 'google'), /Couldn't start Google sign-in/);
  assert.match(providerErrorMessage(null, 'google'), /Couldn't start Google sign-in/);
});
