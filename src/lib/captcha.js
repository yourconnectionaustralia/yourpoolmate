// Cloudflare Turnstile -> one single-use token per Supabase auth call.
//
// Supabase Auth (Authentication > Attack Protection > Captcha) rejects sign-up,
// sign-in, magic link, password reset, resend and guest sign-in unless the call
// carries a Turnstile token in options.captchaToken. Every such call in the app
// goes through getCaptchaToken() below.
//
// How it behaves:
//  - One invisible widget, rendered on first use. Cloudflare only shows it if it
//    needs the person to tick a box (appearance: 'interaction-only').
//  - Tokens are single use, so each call resets the widget and asks for a fresh
//    one. Calls are queued so two taps never share a token.
//  - It never blocks the app. If the script is blocked, errors, or times out, the
//    call goes ahead with no token and Supabase has the final say. That keeps
//    sign-in working with captcha switched off in Supabase, and gives a clear
//    "couldn't confirm you're human" message (see friendlyAuthError) with it on.
//
// The site key is public. VITE_TURNSTILE_SITE_KEY overrides it (use Cloudflare's
// test keys locally, or set it to an empty string to switch the widget off).

const DEFAULT_SITE_KEY = '0x4AAAAAAF4YTsJ79QFWSehA'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

const QUIET_MS = 15000        // how long to wait for an invisible check
const INTERACTIVE_MS = 120000 // once a visible challenge appears, give the person time

export function createCaptcha({
  siteKey,
  loadTurnstile,
  mount,
  quietMs = QUIET_MS,
  interactiveMs = INTERACTIVE_MS,
}) {
  let turnstile = null
  let widgetId = null
  let current = null // handlers for the call that is waiting on a token
  let queue = Promise.resolve()

  // One shared promise, so priming and a first tap can't render two widgets.
  let ready = null
  function ensureWidget() {
    if (!ready) {
      ready = (async () => {
        turnstile = await loadTurnstile()
        const id = turnstile.render(mount(), {
          sitekey: siteKey,
          execution: 'execute',
          appearance: 'interaction-only',
          callback: (token) => current?.token(token),
          'error-callback': () => current?.fail(),
          'timeout-callback': () => current?.fail(),
          'before-interactive-callback': () => current?.interactive(),
        })
        if (id === undefined || id === null || id === '') throw new Error('Turnstile did not render')
        widgetId = id
      })().catch((err) => {
        ready = null // let a later tap try again
        throw err
      })
    }
    return ready
  }

  function once() {
    return new Promise((resolve) => {
      let timer
      const done = (token) => {
        clearTimeout(timer)
        current = null
        resolve(token)
      }
      const arm = (ms) => {
        clearTimeout(timer)
        timer = setTimeout(() => done(undefined), ms)
      }
      current = {
        token: (t) => done(t),
        fail: () => done(undefined),
        interactive: () => arm(interactiveMs),
      }
      arm(quietMs)
      try {
        turnstile.reset(widgetId)
        turnstile.execute(widgetId)
      } catch (err) {
        console.warn('[captcha] could not run the check:', err)
        done(undefined)
      }
    })
  }

  async function run() {
    try {
      await ensureWidget()
      return await once()
    } catch (err) {
      console.warn('[captcha] unavailable, continuing without a token:', err)
      return undefined
    }
  }

  // Warm the script up so the first tap isn't waiting on a download.
  function prime() {
    if (!siteKey) return
    ensureWidget().catch(() => {})
  }

  function getToken() {
    if (!siteKey) return Promise.resolve(undefined)
    const next = queue.then(run, run)
    queue = next.then(() => {}, () => {})
    return next
  }

  return { getToken, prime }
}

// ---- Browser wiring --------------------------------------------------------

let scriptPromise = null
function loadTurnstileScript() {
  if (typeof window !== 'undefined' && window.turnstile) return Promise.resolve(window.turnstile)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SCRIPT_SRC
      s.async = true
      s.defer = true
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load')))
      s.onerror = () => reject(new Error('Turnstile script was blocked'))
      document.head.appendChild(s)
    }).catch((err) => {
      scriptPromise = null // let a later tap try again
      throw err
    })
  }
  return scriptPromise
}

function mountPoint() {
  const el = document.createElement('div')
  el.id = 'ypm-turnstile'
  // Invisible unless Cloudflare needs a tap; then it appears above everything.
  el.style.cssText =
    'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;'
  document.body.appendChild(el)
  return el
}

const envKey = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_TURNSTILE_SITE_KEY : undefined

const instance = createCaptcha({
  siteKey: typeof envKey === 'string' ? envKey.trim() : DEFAULT_SITE_KEY,
  loadTurnstile: loadTurnstileScript,
  mount: mountPoint,
})

export const getCaptchaToken = instance.getToken
export const primeCaptcha = instance.prime
