// Weekly test reminder and monthly pool report: subjects and bodies.
// Same voice and same house rules as L1-L7: hyphens only, no "log", no "photo".

import {
  APP_URL, FROM_ADDRESS, REPLY_TO, button, esc, greetingName, para, plainSignoff, shell, signoff,
} from "./lifecycle-templates.js"
import { dayName } from "./recurring-rules.js"

function assertStyle(kind, blob) {
  if (blob.includes("—") || blob.includes("–")) throw new Error(`${kind} contains a dash that is not a hyphen`)
  if (/\blog\b/i.test(blob)) throw new Error(`${kind} uses "log"`)
  if (/photo/i.test(blob)) throw new Error(`${kind} mentions a photo`)
  if (blob.includes("{{") || blob.includes("undefined") || blob.includes("NaN")) throw new Error(`${kind} has an unreplaced field`)
}

function unsubHtml(label, url) {
  return `<p style="font-size:12px;color:#666;text-align:center;margin:0 0 24px;">${esc(label)} <a href="${esc(url)}" style="color:#0B7799;">Unsubscribe</a></p>`
}

function daysAgoText(days) {
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  return `${days} days ago`
}

// input: { firstName, reminderDay, daysSinceTest, lastScore, unsubscribeUrl }
export function renderWeeklyReminder(input) {
  const name = greetingName(input.firstName)
  const day = dayName(input.reminderDay)
  const link = `${APP_URL}/?test=1`
  const hasTest = Number.isFinite(input.daysSinceTest)
  const last = hasTest
    ? `Your last test was ${daysAgoText(input.daysSinceTest)}${Number.isFinite(input.lastScore) ? ` and your Health Score was ${input.lastScore}` : ""}.`
    : "You haven't added a test yet. Your first one takes about a minute."
  const subject = "Time to test your pool water"
  const preview = `It's ${day}, your weekly water test day.`
  const body = `It's ${day}, your weekly water test day. ${last} A test a week keeps your record complete and your water sorted.`
  const tail = `Change your reminder day or turn it off any time in the app: Profile, then Reminders.`
  const unsubLabel = "Don't want these reminders?"

  const html = shell(subject, preview, [
    para(`Hi ${esc(name)},`),
    para(esc(body)),
    button(link, "Test my water"),
    para(esc(tail), "font-size:14px;line-height:1.5;color:#555;padding-bottom:14px;"),
    signoff("See you on the other side of the test."),
  ].join("\n")).replace("</body>", `${unsubHtml(unsubLabel, input.unsubscribeUrl)}\n</body>`)

  const text = `${plainTextBlock(`Hi ${name},`, body, `Test my water: ${link}`, tail)}\n\n${plainSignoff("See you on the other side of the test.")}\n\n${unsubLabel} ${input.unsubscribeUrl}`
  const out = { kind: "weekly_reminder", subject, preview, html, text }
  assertStyle("weekly_reminder", `${subject}\n${preview}\n${text}\n${html}`)
  return out
}

const plainTextBlock = (...parts) => parts.join("\n\n")

function scoreLine(input) {
  const { firstScore, lastScore } = input
  if (!Number.isFinite(firstScore) || !Number.isFinite(lastScore)) return null
  if (input.tests < 2 || firstScore === lastScore) return `Health Score: ${lastScore}.`
  const diff = lastScore - firstScore
  return `Health Score: started at ${firstScore}, finished at ${lastScore} (${diff > 0 ? "up" : "down"} ${Math.abs(diff)}).`
}

function readingsLine(r) {
  if (!r) return null
  const bits = []
  if (r.free_chlorine != null) bits.push(`free chlorine ${r.free_chlorine} ppm`)
  if (r.ph != null) bits.push(`pH ${r.ph}`)
  if (r.alkalinity != null) bits.push(`alkalinity ${r.alkalinity} ppm`)
  if (r.cyanuric_acid != null) bits.push(`cyanuric acid ${r.cyanuric_acid} ppm`)
  if (r.calcium != null) bits.push(`calcium ${r.calcium} ppm`)
  if (r.salt != null) bits.push(`salt ${r.salt} ppm`)
  return bits.length ? `Your latest readings: ${bits.join(", ")}.` : null
}

// input: { firstName, monthName, tests, firstScore, lastScore, bestScore, lowestScore, doses, lastReadings, unsubscribeUrl }
export function renderMonthlyReport(input) {
  const name = greetingName(input.firstName)
  const link = APP_URL
  const subject = Number.isFinite(input.lastScore)
    ? `Your pool in ${input.monthName}: Health Score ${input.lastScore}`
    : `Your pool in ${input.monthName}`
  const preview = `${input.tests} test${input.tests === 1 ? "" : "s"} in ${input.monthName}.`
  const facts = [
    `Water tests: ${input.tests}.`,
    scoreLine(input),
    input.tests >= 2 && Number.isFinite(input.bestScore) && Number.isFinite(input.lowestScore) && input.bestScore !== input.lowestScore
      ? `Best score ${input.bestScore}, lowest ${input.lowestScore}.` : null,
    input.doses > 0 ? `Doses you added: ${input.doses}.` : null,
    readingsLine(input.lastReadings),
  ].filter(Boolean)
  const intro = `Here's how your pool went in ${input.monthName}.`
  const tail = "Your full record, as a PDF or spreadsheet, is in the app under Chemistry. It's the page to hand over if you ever need to show your water history."
  const unsubLabel = "Don't want this monthly report?"

  const factRows = facts.map((f) => para(esc(f), "font-size:16px;line-height:1.5;padding-bottom:8px;")).join("\n")
  const html = shell(subject, preview, [
    para(`Hi ${esc(name)},`),
    para(esc(intro)),
    factRows,
    `<tr><td style="padding-top:8px;"></td></tr>`,
    button(link, "Open your pool"),
    para(esc(tail), "font-size:14px;line-height:1.5;color:#555;padding-bottom:14px;"),
    signoff("Thanks for keeping the record."),
  ].join("\n")).replace("</body>", `${unsubHtml(unsubLabel, input.unsubscribeUrl)}\n</body>`)

  const text = `${plainTextBlock(`Hi ${name},`, intro, facts.join("\n"), `Open your pool: ${link}`, tail)}\n\n${plainSignoff("Thanks for keeping the record.")}\n\n${unsubLabel} ${input.unsubscribeUrl}`
  const out = { kind: "monthly_report", subject, preview, html, text }
  assertStyle("monthly_report", `${subject}\n${preview}\n${text}\n${html}`)
  return out
}

export function recurringPayload(to, rendered, unsubscribeUrl) {
  return {
    from: FROM_ADDRESS,
    to: [to],
    reply_to: REPLY_TO,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:${REPLY_TO}?subject=Unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    tags: [{ name: "template", value: rendered.kind }],
  }
}
