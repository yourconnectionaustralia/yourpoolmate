// L1–L7 subjects and bodies from email/lifecycle (approved bank).
// Light style fixes only: no em dashes, "test" rather than "log", no photo-scan claims.
// Founding paragraphs render only when foundingMember is true (signup rank, not a client flag).

import { FROM_ADDRESS, REPLY_TO } from "./lifecycle-rules.js"

export { FROM_ADDRESS, REPLY_TO }

const APP_URL = "https://app.yourpoolmate.com.au"
const SITE_URL = "https://yourpoolmate.com.au"
const HELLO = "hello@yourpoolmate.com.au"
const FONT = "Arial,Helvetica,sans-serif"

const SUBJECTS = {
  L1: "Welcome - let's get your pool sorted",
  L2: "Your pool's Health Score starts with one test",
  L3: "First test done - here's what to do next",
  L4: "Halfway through your trial - how's the water looking?",
  L5: "Your trial ends in a few days - here's the choice",
  L6: "Welcome aboard - here's what happens next",
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

function esc(value) {
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

function assertOutboundStyle(template, blob) {
  if (blob.includes("\u2014") || blob.includes("\u2013")) {
    throw new Error(`lifecycle ${template} contains a dash that is not a hyphen`)
  }
  if (/\blog\b/i.test(blob)) throw new Error(`lifecycle ${template} uses "log"`)
  if (/photo/i.test(blob)) throw new Error(`lifecycle ${template} mentions a photo`)
  if (/\bscan\b/i.test(blob)) throw new Error(`lifecycle ${template} mentions a scan`)
  if (blob.includes("{{")) throw new Error(`lifecycle ${template} has an unreplaced field`)
}

function button(href, label) {
  return `<tr>
            <td align="center" style="padding-bottom:18px;">
              <a href="${esc(href)}" style="display:inline-block;background:#0B7799;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;padding:12px 20px;border-radius:8px;">${esc(label)}</a>
            </td>
          </tr>`
}

function para(html, style = "font-size:16px;line-height:1.55;padding-bottom:14px;") {
  return `<tr><td style="${style}">${html}</td></tr>`
}

function signoff(closingHtml) {
  return `${para(closingHtml, "font-size:15px;line-height:1.5;color:#333;")}
          <tr>
            <td style="font-size:15px;line-height:1.5;color:#333;">
              - James<br />Your Pool Mate<br />
              <a href="mailto:${HELLO}" style="color:#0B7799;">${HELLO}</a>
            </td>
          </tr>`
}

function shell(title, preview, rows, footer) {
  const footerHtml = footer
    ? `<p style="font-size:12px;color:#888;margin:16px 0 0;max-width:560px;">${footer}</p>`
    : ""
  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f1;font-family:${FONT};color:#1a1a1a;">
  <div style="display:none;font-size:1px;color:#f4f4f1;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preview)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f1;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:28px 24px;">
          <tr>
            <td style="font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#0B7799;padding-bottom:12px;">Your Pool Mate</td>
          </tr>
          <tr>
            <td style="font-size:22px;line-height:1.3;font-weight:700;padding-bottom:12px;">${esc(title)}</td>
          </tr>
          ${rows}
        </table>
        ${footerHtml}
      </td>
    </tr>
  </table>
</body>
</html>`
}

function plainSignoff(closing) {
  return `${closing}

- James
Your Pool Mate
${HELLO}`
}

function renderL1(name, founding) {
  const preview = "Add your first water test and see where you stand."
  const step = "add a water test (type in a shop printout, or read a test strip and enter the results)"
  const foundingPlain = founding
    ? `\nThe first 300 members can lock in $79 lifetime access when the trial ends. After that it's $49/year. No rush today - use the trial.\n`
    : ""
  const text = `Hi ${name},

Welcome to Your Pool Mate.

You've got a 30-day free trial. No card required to start. The point of the app is simple: know what's going on in your water, and what to do next - without guessing.

Your first step: ${step}. You'll get a clear Health Score and plain-English next actions.

Open the app: ${APP_URL}
${foundingPlain}
${plainSignoff("If anything's unclear, just reply to this email. It comes to me.")}`

  const foundingRow = founding
    ? para(
      `Founding note: the first 300 members can lock in <strong>$79 lifetime</strong> when the trial ends. After that it's <strong>$49/year</strong>. No rush today - use the trial.`,
      "font-size:14px;line-height:1.5;color:#444;padding-bottom:14px;border-top:1px solid #eee;padding-top:14px;",
    )
    : ""
  const html = shell(SUBJECTS.L1, preview, `
          ${para(`Hi ${esc(name)},`)}
          ${para("You've got a <strong>30-day free trial</strong>. No card required to start. Your Pool Mate shows what's going on in your water and what to do next - without guessing.")}
          ${para(`<strong>Your first step:</strong> ${step}. You'll get a Health Score and plain-English next actions.`, "font-size:16px;line-height:1.55;padding-bottom:18px;")}
          ${button(APP_URL, "Add your first test")}
          ${foundingRow}
          ${signoff("If anything's unclear, reply to this email.")}
  `, "You're receiving this because you started a Your Pool Mate trial.")
  return { preview, text, html }
}

function renderL2(name) {
  const preview = "Enter a shop printout or your strip readings."
  const text = `Hi ${name},

Quick nudge - Your Pool Mate works best once it has a real reading from your pool.

If you haven't added a water test yet, that's the highest-value next step. Use a printout from the pool shop, or read a test strip and enter the results in the app. You'll get a Health Score and clear next actions.

Add your first test: ${APP_URL}

Already done it? You can ignore this - you're underway.

${plainSignoff("Questions? Reply here.")}`
  const html = shell(SUBJECTS.L2, preview, `
          ${para(`Hi ${esc(name)},`)}
          ${para("Quick nudge - Your Pool Mate works best once it has a real reading from your pool.")}
          ${para("If you haven't added a water test yet, that's the highest-value next step. Use a printout from the pool shop, or read a test strip and enter the results in the app. You'll get a Health Score and clear next actions.", "font-size:16px;line-height:1.55;padding-bottom:18px;")}
          ${button(APP_URL, "Add your first test")}
          ${para("Already done it? You can ignore this - you're underway.", "font-size:14px;line-height:1.5;color:#555;padding-bottom:14px;")}
          ${signoff("Questions? Reply here.")}
  `, null)
  return { preview, text, html }
}

function renderL3(name) {
  const preview = "Open the app to see your score and next actions."
  const text = `Hi ${name},

First test done - your first water test is in.

Open Your Pool Mate to see your Health Score and the next actions in plain English. If something needs attention, the app will tell you what to adjust and why.

Open your results: ${APP_URL}

Tip: the more regularly you test, the clearer the pattern gets - especially after weather, parties, or topping up.

${plainSignoff("Questions? Reply here.")}`
  const html = shell(SUBJECTS.L3, preview, `
          ${para(`Hi ${esc(name)},`)}
          ${para("Your first water test is in. Open Your Pool Mate to see your Health Score and the next actions in plain English.")}
          ${para("If something needs attention, the app will tell you what to adjust and why.", "font-size:16px;line-height:1.55;padding-bottom:18px;")}
          ${button(APP_URL, "Open your Health Score")}
          ${para("Tip: the more regularly you test, the clearer the pattern gets - especially after weather, parties, or topping up.", "font-size:14px;line-height:1.5;color:#555;padding-bottom:14px;")}
          ${signoff("Questions? Reply here.")}
  `, null)
  return { preview, text, html }
}

function renderL4(name, founding) {
  const preview = founding
    ? "Keep testing. Founding access is still available while spots last."
    : "Keep testing through the rest of your trial."
  const foundingPlain = founding
    ? `\nWhen your trial ends, the first 300 members can lock in $79 lifetime access. After that it's $49/year. No pressure today - use the trial.\n`
    : ""
  const text = `Hi ${name},

You're about halfway through your 30-day Your Pool Mate trial.

If you've been adding water tests, you should be seeing a clearer picture of your pool - Health Score, history, and what to do next in plain English. If you haven't tested much yet, now's a good time to get one in: use a shop printout, or read a strip and enter the results.

Open the app: ${APP_URL}
${foundingPlain}
${plainSignoff("If something's confusing or missing, reply to this email.")}`
  const foundingRow = founding
    ? para(
      "Founding note: when your trial ends, the first 300 members can lock in <strong>$79 lifetime</strong> access. After that it's <strong>$49/year</strong>. No pressure today - use the trial.",
      "font-size:14px;line-height:1.5;color:#444;padding-bottom:14px;border-top:1px solid #eee;padding-top:14px;",
    )
    : ""
  const html = shell(SUBJECTS.L4, preview, `
          ${para(`Hi ${esc(name)},`)}
          ${para("You're about halfway through your 30-day Your Pool Mate trial.")}
          ${para("If you've been adding water tests, you should be seeing a clearer picture of your pool - Health Score, history, and what to do next in plain English. If you haven't tested much yet, now's a good time to get one in: use a shop printout, or read a strip and enter the results.")}
          ${button(APP_URL, "Open the app")}
          ${foundingRow}
          ${signoff("If something's confusing or missing, reply to this email.")}
  `, null)
  return { preview, text, html }
}

function renderL5(name, founding) {
  const preview = founding
    ? "First 300 keep $79 lifetime. After that it's $49/year."
    : "After the trial, access is $49/year."
  const choicePlain = founding
    ? `• Founding (while under 300 paid members): $79 once, lifetime access
• After founding is full: $49/year`
    : "• After founding is full: $49/year"
  const choiceHtml = founding
    ? `<ul style="margin:0;padding-left:20px;">
                <li style="margin-bottom:8px;"><strong>Founding</strong> (while under 300 paid members): <strong>$79</strong> once, lifetime access</li>
                <li><strong>After founding is full:</strong> <strong>$49/year</strong></li>
              </ul>`
    : `<ul style="margin:0;padding-left:20px;">
                <li><strong>After founding is full:</strong> <strong>$49/year</strong></li>
              </ul>`
  const text = `Hi ${name},

Your 30-day Your Pool Mate trial ends in about three days.

If the app's been useful - clearer water tests, Health Score, and plain-English next steps - you can keep it. Here's how.

${choicePlain}

Open the app to lock in (or keep using the trial until it ends):
${APP_URL}

No card was required to start the trial. If you do nothing, access ends when the trial does - no surprise charge.

${plainSignoff("If you have any questions, reply to this email.")}`
  const html = shell(SUBJECTS.L5, preview, `
          ${para(`Hi ${esc(name)},`)}
          ${para("Your 30-day Your Pool Mate trial ends in about three days.")}
          ${para("If the app's been useful - clearer water tests, Health Score, and plain-English next steps - you can keep it. Here's how.")}
          ${para(choiceHtml, "font-size:16px;line-height:1.55;padding-bottom:18px;")}
          ${button(APP_URL, "Lock in access")}
          ${para("No card was required to start the trial. If you do nothing, access ends when the trial does - no surprise charge.", "font-size:14px;line-height:1.5;color:#444;padding-bottom:14px;border-top:1px solid #eee;padding-top:14px;")}
          ${signoff("If you have any questions, reply to this email.")}
  `, "You're receiving this because you started a Your Pool Mate trial.")
  return { preview, text, html }
}

function renderL6(name, input) {
  const preview = "Access is active. A quick note on what to do from here."
  const plan = planLabel(input.plan)
  const amount = amountLabel(input.plan, input.amountCents, input.currency)
  const receipt = safeHttps(input.receiptUrl)
  const records = amount ? `${plan} · ${amount}` : plan
  const receiptPlain = receipt ? `\nReceipt: ${receipt}` : ""
  const text = `Hi ${name},

Welcome aboard. Thanks for joining Your Pool Mate.

Here's what happens next: your access is active now. Keep adding water tests when you check the pool - Health Score and plain-English next steps get clearer the more history you have.

Open the app: ${APP_URL}

For your records: ${records}${receiptPlain}

${plainSignoff("If anything looks off with billing or the account, reply to this email. It comes to me.")}`
  const receiptHtml = receipt
    ? `<br /><span style="font-size:14px;color:#444;">Receipt: <a href="${esc(receipt)}" style="color:#0B7799;">view receipt</a></span>`
    : ""
  const html = shell(SUBJECTS.L6, preview, `
          ${para(`Hi ${esc(name)},`)}
          ${para("Welcome aboard. Thanks for joining Your Pool Mate.")}
          ${para("Here's what happens next: your access is active now. Keep adding water tests when you check the pool - Health Score and plain-English next steps get clearer the more history you have.", "font-size:16px;line-height:1.55;padding-bottom:18px;")}
          ${button(APP_URL, "Open the app")}
          ${para(`For your records: ${esc(records)}${receiptHtml}`, "font-size:14px;line-height:1.5;color:#444;padding-bottom:14px;border-top:1px solid #eee;padding-top:14px;")}
          ${signoff("If anything looks off with billing or the account, reply to this email. It comes to me.")}
  `, "You're receiving this because you completed a Your Pool Mate checkout.")
  return { preview, text, html }
}

function renderL7(name) {
  const preview = "If Your Pool Mate has been useful, one mate with a pool might appreciate the link."
  const text = `Hi ${name},

Quick one - and only this once.

If Your Pool Mate has been useful for your water tests and next steps, you might know one other pool owner who'd want the same clarity.

No pressure. If it fits, send them this link:
${SITE_URL}

They can try the 30-day free trial (no card to start). Founding is still $79 lifetime while under 300 paid members; after that it's $49/year.

If you'd rather not share, all good - just keep using the app.

${plainSignoff("Questions? Reply here. It comes to me.")}`
  const html = shell(SUBJECTS.L7, preview, `
          ${para(`Hi ${esc(name)},`)}
          ${para("Quick one - and only this once.")}
          ${para("If Your Pool Mate has been useful for your water tests and next steps, you might know one other pool owner who'd want the same clarity.")}
          ${para("No pressure. If it fits, send them this link:", "font-size:16px;line-height:1.55;padding-bottom:18px;")}
          ${button(SITE_URL, "Share Your Pool Mate")}
          ${para("They can try the 30-day free trial (no card to start). Founding is still $79 lifetime while under 300 paid members; after that it's $49/year.", "font-size:15px;line-height:1.55;padding-bottom:14px;color:#333;")}
          ${para("If you'd rather not share, all good - just keep using the app.", "font-size:15px;line-height:1.55;padding-bottom:14px;color:#333;")}
          ${signoff("Questions? Reply here. It comes to me.")}
  `, "You're receiving this because you've used Your Pool Mate. We send this ask once.")
  return { preview, text, html }
}

export function renderTemplate(template, input = {}) {
  const name = greetingName(input.firstName)
  const founding = input.foundingMember === true
  let body
  switch (template) {
    case "L1":
      body = renderL1(name, founding)
      break
    case "L2":
      body = renderL2(name)
      break
    case "L3":
      body = renderL3(name)
      break
    case "L4":
      body = renderL4(name, founding)
      break
    case "L5":
      body = renderL5(name, founding)
      break
    case "L6":
      body = renderL6(name, input)
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
    text: body.text,
    html: body.html,
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
    tags: [{ name: "template", value: rendered.template }],
  }
}
