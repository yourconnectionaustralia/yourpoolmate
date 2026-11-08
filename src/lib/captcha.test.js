import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { createCaptcha } from './captcha.js'

// A stand-in for window.turnstile. `script` decides what each execute() does.
function fakeTurnstile(script) {
  const log = { renders: 0, resets: 0, executes: 0, opts: null }
  let n = 0
  const api = {
    render(_el, opts) { log.renders++; log.opts = opts; return 'w1' },
    reset() { log.resets++ },
    execute() { log.executes++; script(log.opts, ++n) },
  }
  return { api, log }
}

const make = (script, extra = {}) => {
  const { api, log } = fakeTurnstile(script)
  const captcha = createCaptcha({
    siteKey: 'key',
    loadTurnstile: async () => api,
    mount: () => ({}),
    quietMs: 40,
    interactiveMs: 120,
    ...extra,
  })
  return { captcha, log }
}

test('returns the token and asks for a fresh one on every call', async () => {
  const { captcha, log } = make((o, n) => setTimeout(() => o.callback(`tok${n}`), 1))
  assert.equal(await captcha.getToken(), 'tok1')
  assert.equal(await captcha.getToken(), 'tok2')
  assert.equal(log.renders, 1, 'one widget, reused')
  assert.equal(log.resets, 2, 'reset before each run so tokens are never reused')
})

test('two taps at once are queued, never sharing a token', async () => {
  const { captcha } = make((o, n) => setTimeout(() => o.callback(`tok${n}`), 5))
  const [a, b] = await Promise.all([captcha.getToken(), captcha.getToken()])
  assert.deepEqual([a, b], ['tok1', 'tok2'])
})

test('priming then a first tap renders only one widget', async () => {
  const { captcha, log } = make((o) => setTimeout(() => o.callback('t'), 1))
  captcha.prime()
  await captcha.getToken()
  assert.equal(log.renders, 1)
})

test('no site key: no script, no widget, no token', async () => {
  let loaded = false
  const captcha = createCaptcha({
    siteKey: '',
    loadTurnstile: async () => { loaded = true },
    mount: () => ({}),
  })
  captcha.prime()
  assert.equal(await captcha.getToken(), undefined)
  assert.equal(loaded, false)
})

test('a blocked script means no token, and a later tap tries again', async () => {
  let attempts = 0
  const { api } = fakeTurnstile((o) => setTimeout(() => o.callback('ok'), 1))
  const captcha = createCaptcha({
    siteKey: 'key',
    loadTurnstile: async () => { if (++attempts === 1) throw new Error('blocked'); return api },
    mount: () => ({}),
    quietMs: 40,
  })
  assert.equal(await captcha.getToken(), undefined)
  assert.equal(await captcha.getToken(), 'ok')
})

test('an error from Cloudflare gives no token instead of hanging', async () => {
  const { captcha } = make((o) => setTimeout(() => o['error-callback'](), 1))
  assert.equal(await captcha.getToken(), undefined)
})

test('a silent check that never answers times out', async () => {
  const { captcha } = make(() => {})
  const started = Date.now()
  assert.equal(await captcha.getToken(), undefined)
  assert.ok(Date.now() - started < 400)
})

test('a visible challenge gets the longer wait', async () => {
  const { captcha } = make((o) => {
    setTimeout(() => o['before-interactive-callback'](), 5)
    setTimeout(() => o.callback('after-tap'), 80) // past quietMs (40), inside interactiveMs (120)
  })
  assert.equal(await captcha.getToken(), 'after-tap')
})

test('a failed call does not poison the queue', async () => {
  const { captcha } = make((o, n) => setTimeout(() => (n === 1 ? o['error-callback']() : o.callback('tok2')), 1))
  assert.equal(await captcha.getToken(), undefined)
  assert.equal(await captcha.getToken(), 'tok2')
})

// Guard: with captcha on in Supabase, a sign-in style call that forgets the
// token fails for everyone. Every such call in src/ must carry captchaToken.
test('every Supabase sign-in style call sends a captcha token', () => {
  const guarded = /supabase\.auth\.(signInWithPassword|signUp|signInWithOtp|resetPasswordForEmail|resend|signInAnonymously)\(/g
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
  const root = new URL('..', import.meta.url).pathname
  const offenders = []
  let found = 0
  for (const file of walk(root).filter((f) => /\.(jsx?|mjs)$/.test(f) && !/\.test\./.test(f))) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(guarded)) {
      found++
      const window = src.slice(m.index, m.index + 700)
      if (!/captchaToken/.test(window)) offenders.push(`${file}: ${m[0]}`)
    }
  }
  assert.ok(found >= 6, `expected to find the six auth calls, found ${found}`)
  assert.deepEqual(offenders, [])
})
