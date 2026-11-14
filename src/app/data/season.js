

// ─────────────────────────────────────────────────────────────────
// SEASON HELPERS (Australian calendar)
// ─────────────────────────────────────────────────────────────────
export function getAUSeason() {
  const m = new Date().getMonth() + 1; // 1–12
  if (m >= 3 && m <= 5) return 'Autumn';
  if (m >= 6 && m <= 8) return 'Winter';
  if (m >= 9 && m <= 11) return 'Spring';
  return 'Summer';
}

// Menu label is generic; the page itself shows the current season's tips.
export const SEASONAL_TIPS_LABEL = 'Seasonal Tips';

// ─────────────────────────────────────────────────────────────────
// SEASONAL TIPS DATA
// ─────────────────────────────────────────────────────────────────
export const SEASONAL_TIPS = {
  Autumn: {
    icon: 'leaf',
    intro: 'As temperatures drop your pool needs less chlorine but more protection. Stay ahead of algae and prepare for winter.',
    tips: [
      { title: 'Reduce chlorine dosage', body: 'Cooler water consumes chlorine more slowly. Cut your dose by 20–30% and let your readings guide you.' },
      { title: 'Test alkalinity now', body: 'Balanced alkalinity (80–120 ppm) going into winter prevents pH drift and saves you costly corrective work in spring.' },
      { title: 'Clean your filter', body: 'Backwash or rinse the filter before the slow season. A clean filter runs more efficiently on reduced pump hours.' },
      { title: 'Check your pool cover', body: 'Autumn leaves are your biggest enemy. A cover saves hours of cleaning and keeps debris out of the filter.' },
      { title: 'Adjust pump run time', body: 'Drop your timer from 8–10 hrs down to 6–8 hrs. Cooler water needs less circulation to stay clear.' },
    ],
  },
  Winter: {
    icon: 'snowflake',
    intro: "Minimal chemicals, minimal effort — but don't ignore it completely. A well-maintained pool in winter opens cleanly in spring.",
    tips: [
      { title: 'Test fortnightly', body: "Water chemistry moves slowly in winter. Fortnightly testing is enough unless you've had heavy rain or high winds." },
      { title: 'Keep chlorine above 0.5 ppm', body: "You don't need 1–3 ppm in winter — it's a waste. Just keep it above 0.5 ppm to prevent algae." },
      { title: 'Watch for pH drift after rain', body: 'Rain lowers pH. After heavy rainfall, test pH first and add pH Up if it drops below 7.2.' },
      { title: 'Run pump 4–6 hrs/day', body: "Short daily circulation prevents stagnation. Never switch the pump off entirely — still water breeds algae." },
      { title: 'Use algaecide monthly', body: 'A monthly algaecide dose is cheap insurance. Far easier than treating a green pool when spring arrives.' },
    ],
  },
  Spring: {
    icon: 'sprout',
    intro: 'Time to wake your pool up. A thorough test and a good shock now means a clean opening before summer arrives.',
    tips: [
      { title: 'Full water test first', body: 'Test all parameters — chlorine, pH, alkalinity, CYA, and calcium. Winter drift compounds, so start with a complete picture.' },
      { title: 'Shock the pool', body: 'Super-chlorinate to 10–20 ppm to kill any algae spores before the water warms up and they bloom.' },
      { title: 'Backwash your filter', body: "Flush out winter debris before increasing pump hours. A clogged filter won't keep up with spring demand." },
      { title: 'Increase pump run time', body: 'Ramp back up to 8 hrs/day as temperatures rise. More swimmers and warmer water needs more circulation.' },
      { title: 'Book your service', body: 'Spring is peak season for pool techs. Book a service or equipment check now before the wait list fills up.' },
    ],
  },
  Summer: {
    icon: 'sun',
    intro: 'High temperatures and heavy use challenge water chemistry fast. Test twice weekly and stay on top of chlorine.',
    tips: [
      { title: 'Test twice a week', body: 'In summer, chlorine can drop to zero within 48 hours of heavy use. Test Monday and Thursday as a minimum.' },
      { title: 'Keep CYA in range', body: 'Cyanuric acid (30–50 ppm) protects chlorine from UV. Without it, outdoor pools lose chlorine 3× faster.' },
      { title: 'Shock after big swim days', body: 'After parties or heavy use, super-chlorinate that evening — bathers add nitrogen compounds that destroy free chlorine.' },
      { title: 'Run pump 10–12 hrs/day', body: 'Heat + heavy use = fast algae risk. Extended circulation keeps water moving and the filter working.' },
      { title: 'Act on slime early', body: 'Walls feel slightly slimy? Add algaecide and brush immediately. Green water takes a week to recover.' },
    ],
  },
};
