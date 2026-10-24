// L1–L7 subjects and bodies. Design matches the Oct 2026 marketing refresh:
// deep-teal hero with a sun-yellow accent, sun buttons, abyss panel for the
// warranty message. No images (the hero is text only).
// House rules: hyphens only (no en/em dashes), "test" rather than "log",
// no photo-scan claims. Enforced by assertOutboundStyle and the tests.
// Founding copy renders only when foundingMember is true (signup rank, not a client flag).

import { FROM_ADDRESS, REPLY_TO } from "./lifecycle-rules.js"

export { FROM_ADDRESS, REPLY_TO }

export const APP_URL = "https://app.yourpoolmate.com.au"
// Opens straight on the water test form once signed in. Used by every "add a test" button.
export const TEST_URL = `${APP_URL}/?test=1`
const SITE_URL = "https://yourpoolmate.com.au"
const HELLO = "hello@yourpoolmate.com.au"
const ABN = "ABN 61 264 129 127"

// Brand tokens (marketing site :root)
const FONT = "'Albert Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif"
const INK = "#13262E"
const MID = "#4E6671"
const DEPTH = "#063B4C"
const DEEP = "#085E78"
const OCEAN = "#0B7799"
const SUN = "#FFD166"
const ABYSS = "#042A36"
const MIST = "#EAF6FA"
const BG = "#F4F8FA"
const LINE = "#DCE9EE"
const PILL = "#0A6F8E"
const HERO_GRAD = `linear-gradient(160deg,${OCEAN} 0%,${DEEP} 45%,${DEPTH} 100%)`

const SUBJECTS = {
  L1: "Welcome - your first step takes about 2 minutes",
  L2: "Got a pool shop printout? That's all you need",
  L3: "Your first test is in - here's what to do with it",
  L4: "Why your pool warranty cares about your water tests",
  L5: "Your free trial ends this week",
  L6: "Welcome aboard - you're all set",
  L7: "Know another pool owner?",
}

export function greetingName(raw) {
  if (raw == null) return "there"
  const cleaned = String(raw).replace(/[\r\n\t]+/g, " ").trim()
  if (!cleaned) return "there"
  const first = cleaned.split(/\s+/)[0]
  if (first.length > 40 || first.includes("@")) return "there"
  if (!/^[\p{L}][\p{L}'’.-]{0,39}$/u.test(first)) return "there"
  return first
}

export function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function safeHttps(url) {
  if (!url || typeof url !== "string") return null
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== "https:") return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function planLabel(plan) {
  if (plan === "annual") return "Yearly ($49/year)"
  if (plan === "founding_lifetime") return "Founding lifetime ($79)"
  return "Your Pool Mate"
}

export function amountLabel(plan, cents, currency) {
  const cur = String(currency ?? "aud").toLowerCase()
  if (typeof cents === "number" && Number.isFinite(cents)) {
    const major = (cents / 100).toFixed(2)
    return cur === "aud" ? `$${major} AUD` : `$${major} ${cur.toUpperCase()}`
  }
  if (plan === "annual") return "$49.00 AUD"
  if (plan === "founding_lifetime") return "$79.00 AUD"
  return ""
}

// "Thursday 20 November" in Melbourne time, or null if the date is unusable.
export function trialEndLabel(value) {
  if (!value) return null
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return null
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Australia/Melbourne",
  }).format(d).replace(",", "")
}

function assertOutboundStyle(template, blob) {
  if (blob.includes("—") || blob.includes("–")) {
    throw new Error(`lifecycle ${template} contains a dash that is not a hyphen`)
  }
  if (/\blog\b/i.test(blob)) throw new Error(`lifecycle ${template} uses "log"`)
  if (/photo/i.test(blob)) throw new Error(`lifecycle ${template} mentions a photo`)
  if (/\bscan\b/i.test(blob)) throw new Error(`lifecycle ${template} mentions a scan`)
  if (blob.includes("{{")) throw new Error(`lifecycle ${template} has an unreplaced field`)
}

// Spam Act 2003 (Cth): every commercial email needs a working unsubscribe.
// Replies land in REPLY_TO; whoever reads that inbox actions the request
// within 5 working days. Mirrored as a List-Unsubscribe header.
export const UNSUBSCRIBE_MAILTO = `mailto:${REPLY_TO}?subject=Unsubscribe`
const UNSUBSCRIBE_TEXT = `Don't want these tips? Reply with "unsubscribe" or email ${REPLY_TO} and we'll stop them.`
const UNSUBSCRIBE_HTML = `<p style="font-family:${FONT};font-size:13px;line-height:20px;color:${MID};text-align:center;margin:0 0 32px;padding:0 16px;">Don't want these tips? <a href="${UNSUBSCRIBE_MAILTO}" style="color:${MID};text-decoration:underline;">Unsubscribe</a> or reply with "unsubscribe" and we'll stop them.</p>`

// ─── Building blocks (also used by recurring-templates.js) ──────────
// Each returns one or more <tr> rows for the body table in shell().

export function button(href, label) {
  return `<tr>
            <td style="padding:10px 0 22px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                <td bgcolor="${SUN}" style="background:${SUN};border-radius:12px;">
                  <a href="${esc(href)}" style="display:inline-block;padding:16px 28px;font-family:${FONT};font-size:17px;line-height:22px;font-weight:700;color:${ABYSS};text-decoration:none;border-radius:12px;">${esc(label)} &rarr;</a>
                </td>
              </tr></table>
            </td>
          </tr>`
}

export function para(html, style = `font-size:17px;line-height:27px;padding-bottom:16px;color:${INK};`) {
  return `<tr><td style="font-family:${FONT};${style}">${html}</td></tr>`
}

function eyebrow(text, color = OCEAN) {
  return `<p style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${color};">${esc(text)}</p>`
}

function boxRow(inner, bg, extra = "") {
  return `<tr>
            <td style="padding:4px 0 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${bg}" style="background:${bg};border-radius:16px;${extra}">
                <tr><td style="padding:20px 22px;font-family:${FONT};">${inner}</td></tr>
              </table>
            </td>
          </tr>`
}

// Light (mist) or dark (abyss) panel with an eyebrow title. bodyHtml is trusted copy.
export function callout(title, bodyHtml, { dark = false } = {}) {
  const color = dark ? "#FFFFFF" : INK
  const strong = dark ? "#FFFFFF" : DEPTH
  const body = bodyHtml.replace(/<strong>/g, `<strong style="color:${strong};">`)
  return boxRow(
    `${eyebrow(title, dark ? SUN : OCEAN)}<p style="margin:0;font-size:17px;line-height:26px;color:${color};">${body}</p>`,
    dark ? ABYSS : MIST,
  )
}

// Numbered steps on a pale panel. Items are trusted copy.
function steps(title, items) {
  const rows = items.map((item, i) => `<tr>
                  <td width="40" valign="top" style="width:40px;padding:0 0 14px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="${OCEAN}" width="28" height="28" style="width:28px;height:28px;background:${OCEAN};border-radius:14px;font-family:${FONT};font-size:14px;line-height:28px;font-weight:800;color:#FFFFFF;">${i + 1}</td></tr></table>
                  </td>
                  <td valign="top" style="padding:2px 0 14px;font-family:${FONT};font-size:17px;line-height:26px;color:${INK};">${item.replace(/<strong>/g, `<strong style="color:${DEPTH};">`)}</td>
                </tr>`).join("\n")
  return boxRow(
    `<p style="margin:0 0 16px;font-size:19px;line-height:25px;font-weight:800;letter-spacing:-0.4px;color:${DEPTH};">${esc(title)}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>`,
    BG,
  )
}

function offerCard({ label, price, terms, note }) {
  return `<tr>
            <td style="padding:4px 0 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FFFFFF;border:2px solid ${OCEAN};border-radius:20px;">
                <tr><td style="padding:22px 24px 24px;font-family:${FONT};">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="${SUN}" style="background:${SUN};border-radius:999px;padding:5px 12px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:${ABYSS};">${esc(label)}</td></tr></table>
                  <p style="margin:16px 0 0;font-size:52px;line-height:52px;font-weight:800;letter-spacing:-1.5px;color:${DEPTH};">${esc(price)}</p>
                  <p style="margin:6px 0 0;font-size:17px;line-height:24px;font-weight:600;color:${INK};">${esc(terms)}</p>
                  <p style="margin:12px 0 0;font-size:15px;line-height:22px;color:${MID};">${esc(note)}</p>
                </td></tr>
              </table>
            </td>
          </tr>`
}

export function signoff(closingHtml) {
  return `${para(closingHtml)}
          <tr>
            <td style="padding-top:8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
                <td style="border-top:1px solid ${LINE};padding-top:20px;font-family:${FONT};">
                  <p style="margin:0;font-size:17px;line-height:24px;font-weight:700;color:${DEPTH};">James</p>
                  <p style="margin:0;font-size:15px;line-height:22px;color:${MID};">Founder, Your Pool Mate</p>
                  <p style="margin:0;font-size:15px;line-height:22px;"><a href="mailto:${HELLO}" style="color:${OCEAN};text-decoration:underline;">${HELLO}</a></p>
                </td>
              </tr></table>
            </td>
          </tr>`
}

// hero: { eyebrow, h1: [before, accent, after] }. Without it the subject is the headline.
// prices: true adds the one-line AUD note to the footer.
export function shell(title, preview, rows, footer, { hero, prices = false } = {}) {
  const [before, accent, after] = hero?.h1 ?? [title, "", ""]
  const label = hero?.eyebrow ?? "Your Pool Mate"
  const reason = footer ? `${footer}<br />` : ""
  const aud = prices ? "<br />All prices are in Australian dollars." : ""
  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>${esc(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>
    @media screen and (max-width:620px) {
      .ypm-pad { padding-left:22px !important; padding-right:22px !important; }
      .ypm-h1 { font-size:31px !important; line-height:35px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${FONT};color:${INK};">
  <div style="display:none;font-size:1px;color:${BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preview)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${BG}" style="background:${BG};">
    <tr>
      <td align="center" style="padding:28px 10px 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;">
          <tr>
            <td class="ypm-pad" bgcolor="${DEEP}" style="background:${DEEP};background-image:${HERO_GRAD};border-radius:20px 20px 0 0;padding:28px 40px 34px;font-family:${FONT};">
              <p style="margin:0;font-size:17px;line-height:22px;font-weight:800;letter-spacing:-0.2px;color:#FFFFFF;">Your Pool Mate</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top:22px;"><tr><td bgcolor="${PILL}" style="background:${PILL};border-radius:999px;padding:6px 14px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:#FFFFFF;">${esc(label)}</td></tr></table>
              <h1 class="ypm-h1" style="margin:16px 0 0;font-family:${FONT};font-size:36px;line-height:40px;font-weight:800;letter-spacing:-1px;color:#FFFFFF;">${esc(before)}<span style="color:${SUN};">${esc(accent)}</span>${esc(after)}</h1>
            </td>
          </tr>
          <tr>
            <td class="ypm-pad" bgcolor="#FFFFFF" style="background:#FFFFFF;border:1px solid ${LINE};border-top:0;border-radius:0 0 20px 20px;padding:30px 40px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-family:${FONT};color:${INK};">
          ${rows}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 16px 12px;font-family:${FONT};font-size:13px;line-height:20px;color:${MID};">
              ${reason}<a href="${APP_URL}" style="color:${MID};text-decoration:underline;">Open the app</a> &middot; <a href="${SITE_URL}/privacy.html" style="color:${MID};text-decoration:underline;">Privacy</a><br />
              Your Pool Mate &middot; ${ABN} &middot; Australian owned${aud}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function plainSignoff(closing) {
  return `${closing}

James
Founder, Your Pool Mate
${HELLO}`
}

function plainFooter(prices) {
  return `\n\n--\nYour Pool Mate · ${ABN} · Australian owned${prices ? "\nAll prices are in Australian dollars." : ""}`
}

// "3 tests", or null when the count is unknown (a manual send without it).
export function testsLabel(count) {
  const n = Number(count)
  if (!Number.isInteger(n) || n < 0) return null
  return `${n} test${n === 1 ? "" : "s"}`
}

const TRIAL_FOOTER = "You're receiving this because you started a Your Pool Mate trial."

function renderL1(name) {
  const preview = "Add one water test and you'll know exactly where your pool stands."
  const intro = "Thanks for giving Your Pool Mate a go. I built it because I got sick of guessing what my pool needed, and of walking out of the pool shop with chemicals I wasn't sure I needed."
  const step = "Add one water test. Type in the numbers from your pool shop printout, or read a test strip and enter the results. You'll get a Health Score out of 100, whether it's good to swim, and exactly what to add, and how much, for anything that's out."
  const record = "Many pool builder and equipment warranties ask for water chemistry records if you ever need to make a claim. Every test you add is dated and kept, so the history is there when you need it."
  const closing = "Anything confusing? Just hit reply. It comes straight to me."
  const text = `Hi ${name},

${intro}

You've got a 30-day free trial. No card needed.

YOUR FIRST STEP
${step}

Add your first test: ${TEST_URL}

WHY IT'S WORTH KEEPING A RECORD
${record}

${plainSignoff(closing)}${plainFooter(false)}`
  const html = shell(SUBJECTS.L1, preview, `
          ${para(`Hi ${esc(name)},`)}
          ${para(intro)}
          ${para(`You've got a <strong style="color:${DEPTH};">30-day free trial</strong>. No card needed.`)}
          ${callout("Your first step", step)}
          ${button(TEST_URL, "Add your first test")}
          ${callout("Why it's worth keeping a record", record, { dark: true })}
          ${signoff(closing)}
  `, TRIAL_FOOTER, { hero: { eyebrow: "Welcome", h1: ["Let's get your pool ", "sorted", "."] } })
  return { preview, text, html }
}

function renderL2(name) {
  const preview = "Type in the numbers and your Health Score is ready."
  const intro = "Your Pool Mate can't tell you much until it's seen your water. One test is all it takes."
  const ways = [
    "<strong>Pool shop printout</strong>: type in the numbers they gave you",
    "<strong>Test strips</strong>: dip, match the colours, enter the readings",
    "<strong>Liquid test kit</strong>: same again, enter what you read",
  ]
  const after = "You'll get your Health Score and plain-English steps for anything that needs fixing."
  const tip = "No test kit yet? Most pool shops will test a water sample for free. Bring the printout home and type it in."
  const closing = "Stuck on something? Hit reply. It comes straight to me."
  const text = `Hi ${name},

${intro}

Three ways to add it:
${ways.map((w, i) => `${i + 1}. ${w.replace(/<\/?strong>/g, "")}`).join("\n")}

${after}

Add your first test: ${TEST_URL}

${tip}

Already done it? Ignore this one. You're on your way.

${plainSignoff(closing)}${plainFooter(false)}`
  const html = shell(SUBJECTS.L2, preview, `
          ${para(`Hi ${esc(name)},`)}
          ${para(intro)}
          ${steps("Three ways to add it", ways)}
          ${para(after)}
          ${button(TEST_URL, "Add your first test")}
          ${callout("No test kit yet?", "Most pool shops will test a water sample for free. Bring the printout home and type it in.")}
          ${para("Already done it? Ignore this one. You're on your way.", `font-size:15px;line-height:22px;padding-bottom:16px;color:${MID};`)}
          ${signoff(closing)}
  `, TRIAL_FOOTER, { hero: { eyebrow: "Your first test", h1: ["One test. ", "One clear answer.", ""] } })
  return { preview, text, html }
}

function renderL3(name) {
  const preview = "Your Health Score, what to add, and how often to test from here."
  const intro = "Your first water test is saved. Open the app to see your Health Score and anything that needs a tweak: what to add, how much, and why."
  const tips = [
    "<strong>Test about once a week</strong>, more often in hot weather or when the pool's busy",
    "<strong>Test again after rain, a pool party or a big top-up</strong>. They all shift the chemistry",
    "<strong>Record what you add</strong>, so over time you can see what actually worked",
  ]
  const shop = "Open the app before you head in. You'll walk in knowing exactly what your water needs, and what it doesn't."
  const closing = "Questions? Hit reply. It comes straight to me."
  const text = `Hi ${name},

${intro}

See your Health Score: ${APP_URL}

Getting the most out of it:
${tips.map((t, i) => `${i + 1}. ${t.replace(/<\/?strong>/g, "")}`).join("\n")}

USE YOUR POOL SHOP SMARTER
${shop}

${plainSignoff(closing)}${plainFooter(false)}`
  const html = shell(SUBJECTS.L3, preview, `
          ${para(`Hi ${esc(name)},`)}
          ${para(intro)}
          ${button(APP_URL, "See your Health Score")}
          ${steps("Getting the most out of it", tips)}
          ${callout("Use your pool shop smarter", shop)}
          ${signoff(closing)}
  `, TRIAL_FOOTER, { hero: { eyebrow: "First test done", h1: ["Good start. ", "Here's what's next.", ""] } })
  return { preview, text, html }
}

function renderL4(name, founding, testCount) {
  const count = testsLabel(testCount)
  const preview = count && testCount > 0
    ? `Halfway through your trial, with ${count} in your record.`
    : "Your test history is quietly doing a second job."
  const intro = count && testCount > 0
    ? `You're halfway through your 30-day trial, and you've added ${count} so far. Each one is dated and kept, and that record is doing a second job too.`
    : "You're about halfway through your 30-day trial. If you've been adding tests, your history is starting to show a pattern, and it's doing a second job too."
  const warranty = "Many pool builder warranties, and plenty of pump, filter and chlorinator makers, can ask for water chemistry records before they honour a claim. Every test in Your Pool Mate is saved with its date, and you can download the full record as a PDF or spreadsheet from Chemistry in the app."
  const nudge = testCount === 0
    ? "You haven't added a test yet. Your first one takes about a minute, and it starts the record."
    : count
      ? "Add one a week and the record keeps building. It takes about a minute."
      : "Haven't tested much yet? Now's a good time. It takes about a minute."
  const offerHtml = founding
    ? `When your trial ends, you can keep going as a <strong style="color:${DEPTH};">founding member</strong> for <strong style="color:${DEPTH};">$79 once</strong>, for life. That price is held for the first 300 people to sign up, and you're one of them. No need to decide today.`
    : `When your trial ends, you can keep going for <strong style="color:${DEPTH};">$49/year</strong>. No need to decide today.`
  const offerPlain = offerHtml.replace(/<[^>]+>/g, "")
  const closing = "If something's confusing or missing, hit reply. I read every one."
  const text = `Hi ${name},

${intro}

THE PART NOBODY TELLS YOU
${warranty}

${nudge}

Add a test: ${TEST_URL}

${offerPlain}

${plainSignoff(closing)}${plainFooter(true)}`
  const html = shell(SUBJECTS.L4, preview, `
          ${para(`Hi ${esc(name)},`)}
          ${para(intro)}
          ${callout("The part nobody tells you", warranty, { dark: true })}
          ${para(nudge)}
          ${button(TEST_URL, "Add a test")}
          ${para(offerHtml, `font-size:16px;line-height:25px;padding:16px 0;color:${INK};border-top:1px solid ${LINE};`)}
          ${signoff(closing)}
  `, TRIAL_FOOTER, { hero: { eyebrow: "Two weeks in", h1: ["Your tests are ", "building a record", "."] }, prices: true })
  return { preview, text, html }
}

function renderL5(name, founding, trialEndsAt, testCount) {
  const count = testsLabel(testCount)
  const ends = trialEndLabel(trialEndsAt)
  const preview = founding
    ? "As one of the first 300, your price is $79 once, for life."
    : "Keep your pool records for $49/year."
  const endsHtml = ends
    ? `Your free trial ends on <strong style="color:${DEPTH};">${esc(ends)}</strong>.`
    : "Your free trial ends in a few days."
  const offer = founding
    ? { label: "Founding member", price: "$79", terms: "once, lifetime access", note: "Held for you as one of the first 300 to sign up. 30-day refund. After the first 300 it's $49/year." }
    : { label: "Yearly", price: "$49", terms: "per year", note: "That's $49/year, billed once a year. Payments are handled securely by Stripe." }
  const how = "Join any time from Profile in the app, or wait and the app will show you how when your trial ends. It takes about a minute, and you pay securely through Stripe."
  const kept = count && testCount > 0 ? `your ${count}, each with its date, ${testCount === 1 ? "stays" : "stay"} saved` : "your test history stays saved"
  const safe = `We never took a card for the trial, so nothing gets charged automatically. If you don't join, your access pauses, but ${kept}, ready if you come back.`
  const closing = "Not sure it's for you? Hit reply and tell me why. I read every one."
  const cta = founding ? "Claim founding access" : "Keep my pool records"
  const text = `Hi ${name},

${endsHtml.replace(/<[^>]+>/g, "")} If Your Pool Mate has earned its place, here's what it costs to keep it:

${offer.label}: ${offer.price} ${offer.terms}
${offer.note}

${how}

${cta}: ${APP_URL}

NO SURPRISE CHARGES
${safe}

${plainSignoff(closing)}${plainFooter(true)}`
  const html = shell(SUBJECTS.L5, preview, `
          ${para(`Hi ${esc(name)},`)}
          ${para(`${endsHtml} If Your Pool Mate has earned its place, here's what it costs to keep it:`)}
          ${offerCard(offer)}
          ${para(how.replace("Profile", `<strong style="color:${DEPTH};">Profile</strong>`))}
          ${button(APP_URL, cta)}
          ${callout("No surprise charges", safe)}
          ${signoff(closing)}
  `, TRIAL_FOOTER, { hero: { eyebrow: "Your trial", h1: ["Nearly done. ", "Here's your option.", ""] }, prices: true })
  return { preview, text, html }
}

function renderL6(name, input, founding) {
  const preview = "Your membership is active. Here's how to get the most from it."
  const plan = planLabel(input.plan)
  const amount = amountLabel(input.plan, input.amountCents, input.currency)
  const receipt = safeHttps(input.receiptUrl)
  const records = amount ? `${plan} · ${amount}` : plan
  const receiptPlain = receipt ? `\nReceipt: ${receipt}` : ""
  const thanks = "Your membership is active now. Thank you, genuinely. Every member helps me keep building this."
  const next = founding
    ? "As a founding member, every new feature is yours as it ships. From here, just add a test whenever you check the pool. The longer your history, the more useful your Health Score trend, and the stronger your warranty record."
    : "From here, just add a test whenever you check the pool. The longer your history, the more useful your Health Score trend, and the stronger your warranty record."
  const closing = "If anything looks off with billing or your account, hit reply. It comes straight to me."
  const text = `Hi ${name},

${thanks}

${next}

Open the app: ${APP_URL}

For your records: ${records}${receiptPlain}

${plainSignoff(closing)}${plainFooter(true)}`
  const receiptHtml = receipt
    ? `<p style="margin:6px 0 0;font-size:15px;line-height:22px;"><a href="${esc(receipt)}" style="color:${OCEAN};text-decoration:underline;">View your receipt</a></p>`
    : ""
  const recordsBox = boxRow(
    `${eyebrow("For your records", MID)}<p style="margin:0;font-size:17px;line-height:26px;color:${INK};"><strong style="color:${DEPTH};">${esc(plan)}</strong>${amount ? ` &middot; ${esc(amount)}` : ""}</p>${receiptHtml}`,
    "#FFFFFF",
    `border:1px solid ${LINE};`,
  )
  const html = shell(SUBJECTS.L6, preview, `
          ${para(`Hi ${esc(name)},`)}
          ${para(thanks)}
          ${para(next)}
          ${button(APP_URL, "Open the app")}
          ${recordsBox}
          ${signoff(closing)}
  `, "You're receiving this because you completed a Your Pool Mate checkout.", {
    hero: { eyebrow: "You're in", h1: ["Thanks for ", "backing Your Pool Mate", "."] }, prices: true,
  })
  return { preview, text, html }
}

function renderL7(name) {
  const preview = "One quick favour, and I'll only ask once."
  const ask = "I'll only ask this once. Your Pool Mate is a one-person business, and word of mouth from people like you is how it grows."
  const who = "If you know someone who's never quite sure what their pool needs (a neighbour, a mate, someone in the family), send them this link:"
  const gets = "They'll get a 30-day free trial, no card needed."
  const closing = "If you'd rather not, that's completely fine. Thanks for being here."
  const text = `Hi ${name},

${ask}

${who}
${SITE_URL}

${gets}

${plainSignoff(closing)}${plainFooter(false)}`
  const html = shell(SUBJECTS.L7, preview, `
          ${para(`Hi ${esc(name)},`)}
          ${para(ask)}
          ${para(who)}
          ${button(SITE_URL, "Share Your Pool Mate")}
          ${para(gets)}
          ${signoff(closing)}
  `, "You're receiving this because you've used Your Pool Mate. We send this ask once.", {
    hero: { eyebrow: "A quick favour", h1: ["Know another ", "pool owner", "?"] },
  })
  return { preview, text, html }
}

export function renderTemplate(template, input = {}) {
  const name = greetingName(input.firstName)
  const founding = input.foundingMember === true
  let body
  switch (template) {
    case "L1":
      body = renderL1(name)
      break
    case "L2":
      body = renderL2(name)
      break
    case "L3":
      body = renderL3(name)
      break
    case "L4":
      body = renderL4(name, founding, input.testCount)
      break
    case "L5":
      body = renderL5(name, founding, input.trialEndsAt, input.testCount)
      break
    case "L6":
      body = renderL6(name, input, founding)
      break
    case "L7":
      body = renderL7(name)
      break
    default:
      throw new Error(`Unknown lifecycle template ${template}`)
  }
  const rendered = {
    template,
    subject: SUBJECTS[template],
    preview: body.preview,
    text: `${body.text}\n\n${UNSUBSCRIBE_TEXT}`,
    html: body.html.replace("</body>", `${UNSUBSCRIBE_HTML}\n</body>`),
  }
  assertOutboundStyle(template, `${rendered.subject}\n${rendered.preview}\n${rendered.text}\n${rendered.html}`)
  return rendered
}

export function resendPayload(to, rendered) {
  return {
    from: FROM_ADDRESS,
    to: [to],
    reply_to: REPLY_TO,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: { "List-Unsubscribe": `<${UNSUBSCRIBE_MAILTO}>` },
    tags: [{ name: "template", value: rendered.template }],
  }
}
