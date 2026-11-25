# Your Pool Mate: analytics, SEO/GEO and Facebook Group playbook

**Written:** 23 November 2026 · **Owner:** James · **Review:** monthly

One goal: more Australian pool owners find us when they have a pool problem, and start a free trial. Search engines (Google, Bing) and AI answer engines (Google AI Overviews and AI Mode, ChatGPT search, Perplexity, Copilot, Claude) are the two ways they'll find us. The Facebook Group is where we learn what they actually ask.

---

## 1. What's now built

### Analytics (GA4, property `G-ETWSG20K0R`, shared by site and app)

| Where | Event | When | Params |
|---|---|---|---|
| Marketing site | `page_view`, scrolls, outbound clicks | Automatic (enhanced measurement) | — |
| Marketing site | `start_free_click` | Any "Start free" link or button | `cta_location` (hero, pricing, guide_cta, hub_cta, tool_trial, nav…), `page_path` |
| Marketing tools | `tool_used` | A calculator gives a result | `tool_name` |
| App | `page_view` | Every screen (now includes Plan, Shed, Shop, Costs, Fixer, Ask Mate) | virtual path |
| App | `sign_up` | New account created | `method` |
| App | `test_logged` | A water test is saved | `method`: manual, ocr, voice, import |
| App | `begin_checkout` | Paywall button tapped | — |
| App | `checkout_success` | Back from Stripe, paid | — |
| App | `ask_mate_question` | Ask Mate answers | — |
| App | `report_shared` | Share link sent or copied | `method` |
| App | `record_exported` | PDF or CSV downloaded | `format` |

Nothing personal is sent: every param is a fixed word from an allowlist (`src/lib/analytics.js`, tested).

### SEO / GEO

- `/guides/` hub with the ideal-ranges table, plus 6 guides: reading a test, warranty records, green pool, cloudy pool, chlorine high/low, pH and alkalinity.
- Each guide: answer-first "short answer" box, question-style headings, tables, FAQ, Article + Breadcrumb + FAQ structured data, updated date, related links, CTA.
- Homepage: Organization, WebSite and SoftwareApplication structured data (prices included, **no ratings**, because we have no reviews yet and must never invent them). "Guides" in the nav and footer.
- `sitemap.xml` with `lastmod`; privacy and terms removed (they're `noindex`).
- `robots.txt` allows search and AI answer crawlers (Googlebot, Bingbot, OAI-SearchBot, ChatGPT-User, Claude-SearchBot, PerplexityBot) and blocks AI training crawlers (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, CCBot and others). It matches Cloudflare's managed robots.txt, which Cloudflare puts in front of ours.
- `llms.txt`: a plain summary of the site for AI tools, with the ranges and every guide.
- IndexNow: `.github/workflows/indexnow.yml` pings Bing a few minutes after any marketing change. Bing's index feeds ChatGPT search and Copilot.

---

## 2. Your one-off setup jobs (about 45 minutes, in this order)

1. **Cloudflare: let the answer engines through, keep training blocked.** Cloudflare dashboard → yourpoolmate.com.au → *AI Crawl Control* → *Crawlers*. Training crawlers (GPTBot, ClaudeBot, Google-Extended…) stay blocked. Set the *AI Search* and *AI Assistant* crawlers (PerplexityBot, OAI-SearchBot, ChatGPT-User, Claude-SearchBot) to Allow. Leave *Bot Preference Sync* on: it adds the training blocks and `ai-train=no` to robots.txt, which agrees with ours.
2. **Google Search Console.** search.google.com/search-console → add property `yourpoolmate.com.au` (Domain type, verify with a DNS TXT record in Cloudflare) → Sitemaps → submit `https://yourpoolmate.com.au/sitemap.xml`. Then URL Inspection → *Request indexing* for `/guides/` and each guide.
3. **Bing Webmaster Tools.** bing.com/webmasters → *Import from Google Search Console* (one click). Submit the sitemap there too.
4. **GA4 key events.** GA4 → Admin → Events → mark `sign_up`, `test_logged`, `begin_checkout`, `checkout_success` and `start_free_click` as key events (they appear 24–48 hours after the deploy).
5. **GA4 custom dimensions.** Admin → Custom definitions → create event-scoped dimensions for `cta_location`, `method`, `format`, `tool_name`. Without this you can't break reports down by them.
6. **GA4 cross-domain.** Admin → Data streams → web stream → Configure tag settings → Configure your domains → add `yourpoolmate.com.au` and `app.yourpoolmate.com.au`. Keeps a visit that starts on a guide and ends in a sign-up as one journey.
7. **GA4 ↔ Search Console link.** Admin → Product links → Search Console. Shows which Google searches land on which guide.
8. **Funnel report.** GA4 → Explore → Funnel: `start_free_click` → `sign_up` → `test_logged` → `begin_checkout` → `checkout_success`. This is the one report to check weekly.

### Weekly numbers to watch (5 minutes, Monday)

| Number | Where | Healthy early sign |
|---|---|---|
| Organic visits to `/guides/*` | GA4 → Pages, filter "guides" | Rising week on week |
| Search impressions and top queries | Search Console → Performance | New queries appearing |
| AI referrals | GA4 → Traffic acquisition, source contains chatgpt, perplexity, copilot, claude, gemini | Any at all, in months 2–4 |
| start_free_click → sign_up rate | Funnel report | Above 30% |
| sign_up → first test_logged | Funnel report | Above 60%. If lower, onboarding is the problem, not SEO |
| Facebook referrals | GA4 → source `facebook`, campaign `fb_group` | Clicks from shared guide links |

---

## 3. The SEO/GEO approach (2026 practice)

Search is now two jobs: rank in classic results, and get **quoted** by AI answers. The same habits win both.

1. **Answer first.** Every guide opens with a 40–60 word direct answer, with the numbers in it. That paragraph is what Google's AI Overview, ChatGPT and Perplexity lift and cite.
2. **One question per heading.** Headings phrased like the question people type or ask ("Why is my pool cloudy after shocking?").
3. **Specific numbers, consistent everywhere.** Same ranges on the site, guides, llms.txt and in the app. AI engines favour sources that agree with themselves and give exact figures (ppm, mL per 1,000 L).
4. **Australian specificity is the moat.** Litres not gallons, liquid chlorine not bleach, Aussie sun, salt chlorinators, state guidelines, our brand names (Zodiac, Astral, Pool Controls). US sites dominate pool search, and "Australia" in the query is where we can win.
5. **Real experience (E-E-A-T).** Add your own photos (your test kit, your printout, your pool going green and back) and first-hand lines ("When ours went cloudy after the January storms…"). Next step: an `/about/` page with your story and a named author byline on guides. Google and AI engines weight real, named experience over anonymous content.
6. **Freshness.** Update each guide at least twice a year, at the start of the season (September) and in mid-summer (January), and change the date in the page and sitemap.
7. **Internal links.** Every new guide links to 2–3 others, a calculator, and the hub. The hub links to everything.
8. **Being mentioned elsewhere.** AI engines lean heavily on what other sites and forums say. Genuine mentions in Reddit (r/pools, r/AusRenovation, r/AusPropertyChat), Whirlpool forums and Facebook Groups matter more than backlinks did.
9. **No tricks.** No fake reviews, no AI-spun bulk pages, no keyword stuffing, no hidden text. Google's spam policies now catch "scaled content abuse", and one penalty can wipe the domain.

### Content plan: next 12 guides (one a fortnight)

Ranked by how often the question comes up in pool groups × how well the app answers it.

| # | Guide | Target query | Links to app feature |
|---|---|---|---|
| 1 | Salt chlorinator: salt level, cell cleaning, output | "salt chlorinator not making chlorine" | Chlorinator settings |
| 2 | Stabiliser (cyanuric acid): too high, too low | "pool stabiliser too high australia" | Plan / chlorine aim |
| 3 | Pool shock: when, how much, liquid vs granular | "how much chlorine to shock a pool" | Dose plan |
| 4 | How long to run your pool pump (summer, winter, off-peak) | "how long to run pool pump australia" | Pump settings |
| 5 | Test strips: how to read them accurately | "how to read pool test strips" | Strip scan |
| 6 | Pool after heavy rain or a storm | "pool after heavy rain what to do" | Problem fixer |
| 7 | Black spot and mustard algae | "black spot algae pebblecrete" | Problem fixer |
| 8 | Calcium hardness and scale on pebblecrete and tiles | "white scale pool tiles" | Health Score |
| 9 | Opening your pool for summer (spring start-up checklist) | "pool spring start up checklist" | Seasonal tasks |
| 10 | Winter pool care in Australia | "winter pool care australia" | Seasonal tasks |
| 11 | How much do pool chemicals cost a year? | "pool chemical cost per year australia" | Costs / My Shed |
| 12 | Buying a house with a pool: what records to ask for | "buying house with pool checklist" | Water record / share link |

Also worth building as tools (tools earn links and AI citations): **pool salt calculator**, **pH / acid dose calculator**, **pump run-time calculator**. Each reuses `src/lib` maths like the chlorine calculator does.

**How each guide gets written:** take the real questions from the Facebook log (section 4), answer them in your words, and send them to Claude to turn into a guide page in the same template. Add one photo of your own.

---

## 4. Facebook Group playbook

**The group:** facebook.com/groups/1407260559603442. Large, active, exactly our customer (women 35+ who ask in public, per the ICP).

### Why this stays manual

Facebook's terms forbid automated collection of group content and automated posting, and members' posts are their own. A scraper or bot risks your personal account and the page being banned, and if the group spots it, the reputation we're building is gone. So Claude doesn't read the group for you. The routine below keeps it to about 20 minutes, twice a week, and Claude does the heavy lifting from what you bring back.

### Before posting anything

1. **Read the group rules** (About tab). Most pool groups ban self-promotion and links.
2. **Message an admin** before ever mentioning the app: "I'm a pool owner who built a free water-testing app. I'd like to keep answering questions here and occasionally share free guides. Is that OK, and is there a promo day?" Admin goodwill is worth more than any single post. Some groups allow a pinned resource or a sponsor slot later.
3. **Personal profile, honest.** Post as yourself. When you mention the app, say it's yours, every time.

### The twice-weekly routine (Monday and Thursday, 20 minutes)

1. **Scan (5 min):** open the group, sort by *New posts*, and look at the last 3–4 days.
2. **Log (5 min):** copy the gist of every chemistry question into the question log (paraphrase, no names or photos of members' pools), with the readings if given:

   | Date | Question (paraphrased) | Readings given | Type (green / cloudy / chlorine / salt / pH / warranty / other) | Answered? | Guide that covers it |
   |---|---|---|---|---|---|

3. **Answer 2–3 (10 min):** pick posts with no good answer yet. Answer fully *in the comment*: the actual fix and amounts. Only link a guide when it genuinely adds something (a full step-by-step), and only if the rules allow links.
4. **Bring the log to Claude** once a week: "Here are this week's group questions." You get back draft replies to adapt, which questions need a new guide, and which existing guide needs an extra section.

### Reply pattern (helpful first, product last or never)

> Sounds like your pH is doing the damage. At 8.0 only about a fifth of your chlorine is in its strong form, so it reads OK but can't keep up. Get pH down to 7.4 first (acid, a bit at a time, pump running), wait 4 hours, re-test, then bring chlorine up to about 3. Brush the walls tonight too.
> I wrote up the full order to fix things here if it helps: [guide link]

Rules of thumb:
- **9 out of 10 replies have no link at all.** Credibility comes first.
- Link **guides**, not the app sign-up page. The guide has the app CTA on it, and guides are far more acceptable to admins.
- Mention the app only when someone asks "is there an app for this?", asks how to keep a record for a warranty, or is clearly stuck doing maths. Say: "Full disclosure, I built one for this: Your Pool Mate. 30 days free."
- Never DM people unprompted.
- Tag every link so it shows in GA4:
  `https://yourpoolmate.com.au/guides/green-pool-how-to-fix/?utm_source=facebook&utm_medium=group&utm_campaign=fb_group`

### Monthly value post (only if the rules allow)

One standalone post a month that's pure value: e.g. "Aussie pool cheat sheet: the 6 numbers that matter" with the ranges table as an image. No link in the post, and the guide link in a comment only if someone asks. This is the warm-up phase in the launch plan, and the founder story post comes later, with the admin's blessing.

### What success looks like (first 90 days)

- 25+ genuinely helpful answers, your name recognised in the group
- Question log of 100+ questions feeding 6+ new guides
- Admin relationship in place (pinned resource or approved promo day)
- GA4 shows `fb_group` sessions converting to `sign_up`

---

## 5. 90-day timeline

| Weeks | Do |
|---|---|
| 1 | Merge and deploy. Run the section 2 setup. Message the group admin. Start the routine. |
| 2–4 | Two guides a month from the log (salt chlorinator, stabiliser). Add your own photos to the existing six. Write the `/about/` page. |
| 5–8 | Two more guides. Build the salt calculator. Check Search Console for queries you rank 8–20 for, and add a section or FAQ answering each. |
| 9–12 | Two more guides. First guide refresh. Review the funnel: if `sign_up → test_logged` is weak, fix onboarding before more traffic. |

Expect Google impressions in weeks 2–6 and steady clicks in months 3–6. AI citations follow once the guides are indexed and mentioned elsewhere.
