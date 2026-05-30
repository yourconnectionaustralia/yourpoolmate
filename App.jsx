import { useState, useEffect, useRef } from 'react';
import FeedbackOverlay from './FeedbackOverlay.jsx';

// ─────────────────────────────────────────────────────────────────
// DESIGN SYSTEM ICONS — inline SVG only, no library dependency
// ─────────────────────────────────────────────────────────────────
const Icon = {
  waves: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17c1.5-1.5 3-1.5 4.5 0S10.5 18.5 12 17s3-1.5 4.5 0 3 1.5 4.5 0"/>
      <path d="M3 13c1.5-1.5 3-1.5 4.5 0S10.5 14.5 12 13s3-1.5 4.5 0 3 1.5 4.5 0"/>
      <path d="M3 9c1.5-1.5 3-1.5 4.5 0S10.5 10.5 12 9s3-1.5 4.5 0 3 1.5 4.5 0"/>
    </svg>
  ),
  flask: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6"/><path d="M10 3v6l-4.5 9a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 9V3"/>
      <path d="M7.5 15h9"/>
    </svg>
  ),
  droplet: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c-3 4-6 7-6 11a6 6 0 0 0 12 0c0-4-3-7-6-11z"/>
    </svg>
  ),
  settings: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h16M9 4v16"/>
    </svg>
  ),
  equipment: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>
    </svg>
  ),
  calendar: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>
    </svg>
  ),
  user: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>
    </svg>
  ),
  camera: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  tip: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6"/><path d="M10 21h4"/>
      <path d="M8 14a5 5 0 1 1 8 0c-1 1-1.5 2-1.5 3.5h-5C9.5 16 9 15 8 14z"/>
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.6" fill="currentColor" stroke="none"/>
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 12 10 18 20 6"/>
    </svg>
  ),
  alert: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4 21 20H3z"/><path d="M12 10v5"/><circle cx="12" cy="18" r="0.6" fill="currentColor" stroke="none"/>
    </svg>
  ),
  logoBig: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c-3 4-6 7-6 11a6 6 0 0 0 12 0c0-4-3-7-6-11z"/>
    </svg>
  ),
  menu: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────
// HEALTH SCORE RING COMPONENT
// ─────────────────────────────────────────────────────────────────
function HealthScoreRing({ score, size = 88 }) {
  const circumference = 220;
  const dashoffset = circumference - (score / 100) * circumference;
  const ringClass =
    score >= 80 ? 'score-ring-fill score-good'
    : score >= 50 ? 'score-ring-fill score-warn'
    : 'score-ring-fill score-critical';

  return (
    <div className="score-ring-container" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 88 88">
        <circle className="score-ring-track" cx="44" cy="44" r="35" />
        <circle
          className={ringClass}
          cx="44" cy="44" r="35"
          style={{ strokeDashoffset: dashoffset }}
        />
      </svg>
      <div className="score-ring-label">
        <span className="score-number score-number-lg">{score}</span>
        <span className="score-of">/ 100</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LOGO MARK
// ─────────────────────────────────────────────────────────────────
function LogoMark() {
  return (
    <div className="topnav-logo-mark">
      {Icon.logoBig}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SEASON HELPERS (Australian calendar)
// ─────────────────────────────────────────────────────────────────
function getAUSeason() {
  const m = new Date().getMonth() + 1; // 1–12
  if (m >= 3 && m <= 5) return 'Autumn';
  if (m >= 6 && m <= 8) return 'Winter';
  if (m >= 9 && m <= 11) return 'Spring';
  return 'Summer';
}
// Menu label is generic; the page itself shows the current season's tips.
const SEASONAL_TIPS_LABEL = 'Seasonal Tips';

// ─────────────────────────────────────────────────────────────────
// EQUIPMENT CONSTANTS
// ─────────────────────────────────────────────────────────────────
const EQUIPMENT_TYPES = [
  'Pump', 'Filter', 'Heater / Heat Pump', 'Robotic Cleaner',
  'Suction Cleaner', 'Salt Chlorinator', 'Lighting', 'Other',
];

// ─────────────────────────────────────────────────────────────────
// POOL SETUP OPTIONS
// ─────────────────────────────────────────────────────────────────
const POOL_TYPES = [
  'In-ground', 'Above-ground', 'Plunge pool', 'Container pool',
  'Lap pool', 'Indoor pool', 'Spa / spool', 'Swim spa',
];
const POOL_SHAPES = [
  'Rectangular', 'Oval', 'Kidney / freeform', 'Round',
  'L-shaped', 'Square', 'Figure-8', 'Other',
];
const POOL_SURFACES = [
  'Pebble / pebblecrete', 'Concrete / rendered', 'Fibreglass',
  'Vinyl liner', 'Fully tiled', 'Painted concrete', 'Other',
];
const SANITISER_TYPES = [
  'Chlorine (granular/liquid)', 'Saltwater chlorinator', 'Mineral / magnesium',
  'Ozone', 'Freshwater system', 'UV', 'Bromine', 'Other',
];
const FILTER_TYPES = [
  'Sand', 'Glass media', 'Cartridge', 'Diatomaceous earth (DE)',
  'Zeolite', 'Other',
];

// Current year, for the "Year built" dropdown
const CURRENT_YEAR = new Date().getFullYear();

function equipmentEmoji(type) {
  if (!type) return '⚙️';
  const t = type.toLowerCase();
  if (t.includes('pump'))    return '💧';
  if (t.includes('filter'))  return '🔵';
  if (t.includes('heat'))    return '🔥';
  if (t.includes('robot') || t.includes('suction') || t.includes('cleaner')) return '🤖';
  if (t.includes('chlorin') || t.includes('salt'))  return '⚗️';
  if (t.includes('light'))   return '💡';
  return '⚙️';
}

// ─────────────────────────────────────────────────────────────────
// SEASONAL TIPS DATA
// ─────────────────────────────────────────────────────────────────
const SEASONAL_TIPS = {
  Autumn: {
    icon: '🍂',
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
    icon: '❄️',
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
    icon: '🌿',
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
    icon: '☀️',
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

// ─────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────
function Sidebar({ activeView, onNav, pendingActions }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-section-label">Today</div>
        <div
          className={`sidebar-item ${activeView === 'health' ? 'active' : ''}`}
          onClick={() => onNav('health')}
        >
          <span className="sidebar-icon">{Icon.waves}</span>
          Health Score
        </div>
        <div
          className={`sidebar-item ${activeView === 'tests' ? 'active' : ''}`}
          onClick={() => onNav('tests')}
        >
          <span className="sidebar-icon">{Icon.flask}</span>
          Water Tests
          {pendingActions > 0 && (
            <span className="sidebar-badge">{pendingActions} action</span>
          )}
        </div>
        <div
          className={`sidebar-item ${activeView === 'history' ? 'active' : ''}`}
          onClick={() => onNav('history')}
        >
          <span className="sidebar-icon">{Icon.droplet}</span>
          Chemistry log
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Pool</div>
        <div
          className={`sidebar-item ${activeView === 'setup' ? 'active' : ''}`}
          onClick={() => onNav('setup')}
        >
          <span className="sidebar-icon">{Icon.settings}</span>
          Setup
        </div>
        <div
          className={`sidebar-item ${activeView === 'equipment' ? 'active' : ''}`}
          onClick={() => onNav('equipment')}
        >
          <span className="sidebar-icon">{Icon.equipment}</span>
          Equipment
        </div>
        <div
          className={`sidebar-item ${activeView === 'schedule' ? 'active' : ''}`}
          onClick={() => onNav('schedule')}
        >
          <span className="sidebar-icon">{Icon.calendar}</span>
          {SEASONAL_TIPS_LABEL}
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Account</div>
        <div
          className={`sidebar-item ${activeView === 'profile' ? 'active' : ''}`}
          onClick={() => onNav('profile')}
        >
          <span className="sidebar-icon">{Icon.user}</span>
          Profile
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────
// MOBILE BOTTOM NAV
// ─────────────────────────────────────────────────────────────────
function MobileNav({ activeView, onNav, pendingActions, onMore, onLogTest }) {
  const SECONDARY = ['setup', 'equipment', 'schedule', 'profile'];
  const moreActive = SECONDARY.includes(activeView);

  return (
    <nav className="mobile-nav">
      {/* Health */}
      <button
        className={`mobile-nav-item ${activeView === 'health' ? 'active' : ''}`}
        onClick={() => onNav('health')}
      >
        <span className="mobile-nav-icon">{Icon.waves}</span>
        <span className="mobile-nav-label">Health</span>
      </button>

      {/* Tests */}
      <button
        className={`mobile-nav-item ${activeView === 'tests' ? 'active' : ''}`}
        onClick={() => onNav('tests')}
      >
        <span className="mobile-nav-icon">{Icon.flask}</span>
        <span className="mobile-nav-label">Tests</span>
        {pendingActions > 0 && (
          <span className="mobile-nav-badge">{pendingActions}</span>
        )}
      </button>

      {/* Centre CTA — Log test */}
      <button className="mobile-nav-item mobile-nav-cta" onClick={onLogTest}>
        <span className="mobile-nav-cta-icon">+</span>
        <span className="mobile-nav-label">Log</span>
      </button>

      {/* History */}
      <button
        className={`mobile-nav-item ${activeView === 'history' ? 'active' : ''}`}
        onClick={() => onNav('history')}
      >
        <span className="mobile-nav-icon">{Icon.droplet}</span>
        <span className="mobile-nav-label">History</span>
      </button>

      {/* More */}
      <button
        className={`mobile-nav-item ${moreActive ? 'active' : ''}`}
        onClick={onMore}
      >
        <span className="mobile-nav-icon">{Icon.menu}</span>
        <span className="mobile-nav-label">More</span>
      </button>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────
// MOBILE MORE DRAWER (slide-up sheet)
// ─────────────────────────────────────────────────────────────────
function MobileMoreDrawer({ activeView, onNav, onClose }) {
  const items = [
    { view: 'setup',     icon: Icon.settings,  label: 'Pool Setup' },
    { view: 'equipment', icon: Icon.equipment,  label: 'Equipment' },
    { view: 'schedule',  icon: Icon.calendar,   label: SEASONAL_TIPS_LABEL },
    { view: 'profile',   icon: Icon.user,        label: 'Profile' },
  ];

  return (
    <>
      <div className="mobile-drawer-backdrop" onClick={onClose} />
      <div className="mobile-drawer">
        <div className="mobile-drawer-handle" />
        {items.map(item => (
          <button
            key={item.view}
            className={`mobile-drawer-item ${activeView === item.view ? 'active' : ''}`}
            onClick={() => { onNav(item.view); onClose(); }}
          >
            <span className="mobile-drawer-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// HEALTH SCORE PAGE
// ─────────────────────────────────────────────────────────────────
function HealthScorePage({ testData, poolProfile }) {
  const score = testData ? calculateScore(testData) : null;
  const lastTest = testData?.createdAt;
  const poolLabel = poolProfile
    ? `${poolProfile.name} · ${(poolProfile.volumeL ?? (poolProfile.volumeKl || 0) * 1000).toLocaleString('en-AU')} L`
    : null;

  if (!testData) {
    return (
      <div>
        <h1 className="page-title">Health Score</h1>
        <p className="page-subtitle">No test logged yet</p>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">{Icon.flask}</div>
            <div className="empty-state-title">No tests logged yet</div>
            <div className="empty-state-body">
              Add your first water test and your Health Score will appear here within seconds.
            </div>
            <button className="btn btn-primary btn-sm">Log first water test</button>
          </div>
        </div>
      </div>
    );
  }

  const params = buildParams(testData);
  const scoreClass = score >= 80 ? 'score-good' : score >= 50 ? 'score-warn' : 'score-critical';
  const headline = scoreHeadline(score, params);
  const primaryAction = getPrimaryAction(params, poolProfile);
  const recommendations = getRecommendations(params, poolProfile);

  return (
    <div>
      <h1 className="page-title">Health Score</h1>
      {poolLabel && (
        <p className="page-subtitle">
          Last test logged {formatRelative(lastTest)} · {poolLabel}
        </p>
      )}

      {/* Score card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="score-card-row">
          <HealthScoreRing score={score} />
          <div className="score-summary">
            <div className="score-eyebrow">Health Score · updated {formatRelative(lastTest)}</div>
            <div className="score-headline">{headline}</div>
            <div className="param-tag-row" style={{ marginTop: 8 }}>
              {params.map(p => (
                <span key={p.key} className={`tag ${p.tagClass}`}>
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {primaryAction && (
          <div style={{ padding: '0 24px 20px' }}>
            <div className="callout callout-action">
              <span className="callout-icon" style={{ color: 'var(--amber)', display: 'inline-flex' }}>
                {Icon.tip}
              </span>
              <div className="callout-body">
                <strong>{primaryAction.dose}</strong> {primaryAction.reason}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Readings table */}
      <div className="card-section stack-lg">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Water Readings</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Reading</th>
              <th>Target</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {params.map(p => (
              <tr key={p.key}>
                <td>{p.name}</td>
                <td style={{ fontWeight: 500, color: 'var(--black)' }}>{p.reading}</td>
                <td className="col-muted">{p.target}</td>
                <td><span className={`tag ${p.tagClass}`}>{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Secondary recommendations */}
      {recommendations.length > 0 && (
        <div className="card-section" style={{ marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Recommendations</div>
          <div className="stack">
            {recommendations.map((r, i) => (
              <div key={i} className={`callout callout-${r.type}`}>
                <span className="callout-icon" style={{ color: r.iconColor, display: 'inline-flex' }}>
                  {r.icon}
                </span>
                <div className="callout-body">
                  {r.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WATER TESTS PAGE
// ─────────────────────────────────────────────────────────────────
function WaterTestsPage({ testData, onLogTest, onScanTest, poolProfile }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    freeChlor: '', pH: '', alkalinity: '', cyanuricAcid: '', calciumHardness: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 800)); // simulate save
    onLogTest({
      freeChlor: parseFloat(form.freeChlor) || 0,
      pH: parseFloat(form.pH) || 0,
      alkalinity: parseFloat(form.alkalinity) || 0,
      cyanuricAcid: parseFloat(form.cyanuricAcid) || 0,
      calciumHardness: parseFloat(form.calciumHardness) || 0,
      createdAt: new Date().toISOString(),
    });
    setSubmitting(false);
    setShowForm(false);
    setForm({ freeChlor: '', pH: '', alkalinity: '', cyanuricAcid: '', calciumHardness: '' });
  };

  return (
    <div>
      <h1 className="page-title">Water Tests</h1>
      <p className="page-subtitle">Log a reading or scan your pool shop test results</p>

      {/* Actions row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          Log water test
        </button>
        <button className="btn btn-ghost" onClick={onScanTest}>
          <span style={{ display: 'inline-flex' }}>{Icon.camera}</span>
          Scan test results
        </button>
      </div>

      {/* Log form */}
      {showForm && (
        <div className="card-section" style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>Enter readings</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'freeChlor',       label: 'Free chlorine',   unit: 'ppm', placeholder: '1.0–3.0' },
              { key: 'pH',              label: 'pH',              unit: '',    placeholder: '7.2–7.6' },
              { key: 'alkalinity',      label: 'Total alkalinity', unit: 'ppm', placeholder: '80–120' },
              { key: 'cyanuricAcid',    label: 'Cyanuric acid',   unit: 'ppm', placeholder: '30–50' },
              { key: 'calciumHardness', label: 'Calcium hardness', unit: 'ppm', placeholder: '200–400' },
            ].map(f => (
              <div key={f.key} className="input-group">
                <label className="input-label">{f.label}{f.unit ? ` (${f.unit})` : ''}</label>
                <input
                  className="input"
                  type="number"
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <span className="dot-loader">
                  <span/><span/><span/>
                </span>
              ) : 'Save reading'}
            </button>
          </div>
        </div>
      )}

      {/* Test history */}
      {testData ? (
        <div className="card-section">
          <div className="eyebrow" style={{ marginBottom: 12 }}>Latest reading</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Reading</th>
                <th>Target range</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {buildParams(testData).map(p => (
                <tr key={p.key}>
                  <td>{p.name}</td>
                  <td style={{ fontWeight: 500, color: 'var(--black)' }}>{p.reading}</td>
                  <td className="col-muted">{p.target}</td>
                  <td><span className={`tag ${p.tagClass}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--gray-light)', marginTop: 12 }}>
            Logged {formatDate(testData.createdAt)}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">{Icon.flask}</div>
            <div className="empty-state-title">No tests logged yet</div>
            <div className="empty-state-body">
              Log your first reading above — your Health Score generates instantly.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CHEMISTRY LOG PAGE
// ─────────────────────────────────────────────────────────────────
function ChemistryLogPage({ history }) {
  if (!history || history.length === 0) {
    return (
      <div>
        <h1 className="page-title">Chemistry log</h1>
        <p className="page-subtitle">Your test history over time</p>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">{Icon.droplet}</div>
            <div className="empty-state-title">No history yet</div>
            <div className="empty-state-body">
              Log two or more water tests and your chemistry trends will appear here.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Chemistry log</h1>
      <p className="page-subtitle">{history.length} tests logged</p>
      <div className="card-section">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Score</th>
              <th>Chlorine</th>
              <th>pH</th>
              <th>Alkalinity</th>
            </tr>
          </thead>
          <tbody>
            {history.slice().reverse().map((t, i) => {
              const score = calculateScore(t);
              const scoreClass = score >= 80 ? 'tag-good' : score >= 50 ? 'tag-warn' : 'tag-bad';
              return (
                <tr key={i}>
                  <td className="col-muted">{formatDate(t.createdAt)}</td>
                  <td><span className={`tag ${scoreClass}`}>{score}</span></td>
                  <td>{t.freeChlor} ppm</td>
                  <td>{t.pH}</td>
                  <td>{t.alkalinity} ppm</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SETUP PAGE
// ─────────────────────────────────────────────────────────────────
function SetupPage({ poolProfile, onSave }) {
  const [form, setForm] = useState(() => ({
    name: 'Backyard pool',
    type: 'In-ground',
    shape: 'Rectangular',
    surface: 'Pebble / pebblecrete',
    volumeL: 32000,
    sanitiser: 'Chlorine (granular/liquid)',
    filter: 'Sand',
    yearBuilt: '',
    yearBuiltApprox: false,
    hasCover: false,
    ...poolProfile,
  }));
  const [saved, setSaved] = useState(false);

  const set = (key, value) => { setForm(v => ({ ...v, [key]: value })); setSaved(false); };

  const handleSave = () => {
    onSave(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const yearOptions = [];
  for (let y = CURRENT_YEAR; y >= 1960; y--) yearOptions.push(y);

  return (
    <div>
      <h1 className="page-title">Pool setup</h1>
      <p className="page-subtitle">Your pool details power accurate dosing calculations</p>

      <div className="card-section">
        <div className="eyebrow" style={{ marginBottom: 16 }}>Pool details</div>

        {/* Pool name */}
        <div className="input-group">
          <label className="input-label">Pool name</label>
          <input
            className="input"
            placeholder="e.g. Backyard pool"
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />
        </div>

        {/* Volume — primary input, full width */}
        <div className="input-group">
          <label className="input-label">Volume (litres)</label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="e.g. 32000"
            value={form.volumeL}
            onChange={e => set('volumeL', parseFloat(e.target.value) || 0)}
          />
          <div style={{ fontSize: 12, color: 'var(--gray-light)', marginTop: 4 }}>
            {form.volumeL > 0
              ? `≈ ${(form.volumeL / 1000).toLocaleString('en-AU', { maximumFractionDigits: 1 })} kL`
              : 'Length × width × average depth (m) × 1,000 = litres'}
          </div>
        </div>

        {/* Type + Shape */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group">
            <label className="input-label">Type</label>
            <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
              {POOL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Shape</label>
            <select className="input" value={form.shape} onChange={e => set('shape', e.target.value)}>
              {POOL_SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Surface + Sanitiser */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group">
            <label className="input-label">Pool surface</label>
            <select className="input" value={form.surface} onChange={e => set('surface', e.target.value)}>
              {POOL_SURFACES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Sanitiser type</label>
            <select className="input" value={form.sanitiser} onChange={e => set('sanitiser', e.target.value)}>
              {SANITISER_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Filter + Year built */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group">
            <label className="input-label">Filter type</label>
            <select className="input" value={form.filter} onChange={e => set('filter', e.target.value)}>
              {FILTER_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Year built (if known)</label>
            <select className="input" value={form.yearBuilt} onChange={e => set('yearBuilt', e.target.value)}>
              <option value="">Not sure</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* Year-built approximate note (only when a year is chosen) */}
        {form.yearBuilt && (
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, color: 'var(--gray-mid)', cursor: 'pointer', marginTop: -4, marginBottom: 16,
          }}>
            <input
              type="checkbox"
              checked={form.yearBuiltApprox}
              onChange={e => set('yearBuiltApprox', e.target.checked)}
              style={{ width: 18, height: 18, accentColor: 'var(--water-deep)', cursor: 'pointer' }}
            />
            This is an approximate year / best guess
          </label>
        )}

        {/* Pool cover Y/N */}
        <div className="input-group">
          <label className="input-label">Pool cover</label>
          <div style={{ display: 'flex', gap: 8 }} role="group" aria-label="Pool cover">
            {[{ v: true, l: 'Yes' }, { v: false, l: 'No' }].map(opt => {
              const active = form.hasCover === opt.v;
              return (
                <button
                  key={opt.l}
                  type="button"
                  onClick={() => set('hasCover', opt.v)}
                  aria-pressed={active}
                  style={{
                    flex: 1, minHeight: 44,
                    borderRadius: 'var(--r-sm)',
                    border: active ? '1px solid var(--water-deep)' : 'var(--border)',
                    background: active ? 'var(--water-pale)' : 'var(--white)',
                    color: active ? 'var(--water-deep)' : 'var(--gray-mid)',
                    fontSize: 14, fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {opt.l}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          {saved && (
            <span style={{ fontSize: 13, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {Icon.check} Saved
            </span>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleSave}>
            Save setup
          </button>
        </div>
      </div>

      <div className="callout callout-info" style={{ marginTop: 16 }}>
        <span className="callout-icon" style={{ color: 'var(--blue)', display: 'inline-flex' }}>
          {Icon.info}
        </span>
        <div className="callout-body">
          Accurate pool volume is the most important setup detail — it determines every dose recommendation.
          If unsure, use the calculator: <strong>length × width × average depth (m) × 1,000</strong> = litres.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SEASONAL TIPS PAGE
// ─────────────────────────────────────────────────────────────────
function SeasonalTipsPage({ season }) {
  const data = SEASONAL_TIPS[season] || SEASONAL_TIPS.Autumn;
  return (
    <div>
      <h1 className="page-title">{data.icon} {season} Tips</h1>
      <p className="page-subtitle">{data.intro}</p>

      <div className="card-section" style={{ marginBottom: 16 }}>
        {data.tips.map((tip, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 14,
              padding: '14px 0',
              borderBottom: i < data.tips.length - 1 ? 'var(--border)' : 'none',
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--water-pale)',
              color: 'var(--blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-read)', fontSize: 13, fontWeight: 500,
              flexShrink: 0, marginTop: 1,
            }}>
              {i + 1}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--black)', marginBottom: 3 }}>
                {tip.title}
              </div>
              <div style={{ fontSize: 13, color: 'var(--gray-mid)', lineHeight: 1.55 }}>
                {tip.body}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="callout callout-info">
        <span className="callout-icon" style={{ color: 'var(--blue)', display: 'inline-flex' }}>
          {Icon.info}
        </span>
        <div className="callout-body">
          Tips update automatically each season — next season: <strong>
            {season === 'Autumn' ? 'Winter' : season === 'Winter' ? 'Spring' : season === 'Spring' ? 'Summer' : 'Autumn'}
          </strong> tips will appear in{' '}
          {season === 'Autumn' ? 'June' : season === 'Winter' ? 'September' : season === 'Spring' ? 'December' : 'March'}.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EQUIPMENT FORM (shared by add + edit)
// ─────────────────────────────────────────────────────────────────
function EquipmentForm({ form, setForm, onSave, onCancel, isNew }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label className="input-label">Equipment type</label>
          <select
            className="input"
            value={form.type}
            onChange={e => setForm(v => ({ ...v, type: e.target.value }))}
          >
            {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Brand</label>
          <input
            className="input"
            placeholder="e.g. Davey, Zodiac"
            value={form.brand}
            onChange={e => setForm(v => ({ ...v, brand: e.target.value }))}
          />
        </div>
        <div className="input-group">
          <label className="input-label">Model</label>
          <input
            className="input"
            placeholder="e.g. PowerMaster 200"
            value={form.model}
            onChange={e => setForm(v => ({ ...v, model: e.target.value }))}
          />
        </div>
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label className="input-label">Notes (optional)</label>
          <input
            className="input"
            placeholder="e.g. Installed 2022, runs 8 hrs/day"
            value={form.notes}
            onChange={e => setForm(v => ({ ...v, notes: e.target.value }))}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={onSave}>
          {isNew ? 'Add equipment' : 'Save changes'}
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// EQUIPMENT PAGE
// ─────────────────────────────────────────────────────────────────
function EquipmentPage({ equipment, onAdd, onUpdate, onDelete }) {
  const EMPTY_FORM = { type: 'Pump', brand: '', model: '', notes: '' };
  const [mode, setMode] = useState('list'); // 'list' | 'new' | item-id string
  const [form, setForm] = useState(EMPTY_FORM);

  const startNew = () => { setForm(EMPTY_FORM); setMode('new'); };
  const startEdit = (item) => {
    setForm({ type: item.type, brand: item.brand, model: item.model, notes: item.notes || '' });
    setMode(item.id);
  };
  const handleSave = () => {
    if (mode === 'new') {
      onAdd({ ...form, id: String(Date.now()) });
    } else {
      onUpdate({ ...form, id: mode });
    }
    setMode('list');
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Equipment</h1>
        {mode === 'list' && equipment.length > 0 && (
          <button className="btn btn-primary btn-sm" onClick={startNew}>+ Add</button>
        )}
      </div>
      <p className="page-subtitle" style={{ marginBottom: 20 }}>Pump, filter, heater, and pool hardware</p>

      {/* Existing equipment list */}
      {equipment.length > 0 && (
        <div className="card-section" style={{ marginBottom: 16 }}>
          {equipment.map((item, i) => (
            <div key={item.id}>
              {mode === item.id ? (
                <div style={{ padding: '16px 0' }}>
                  <div className="eyebrow" style={{ marginBottom: 12 }}>Edit {item.type}</div>
                  <EquipmentForm
                    form={form}
                    setForm={setForm}
                    onSave={handleSave}
                    onCancel={() => setMode('list')}
                    isNew={false}
                  />
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: i < equipment.length - 1 ? 'var(--border)' : 'none',
                }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{equipmentEmoji(item.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--black)' }}>{item.type}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-mid)', marginTop: 2 }}>
                      {[item.brand, item.model].filter(Boolean).join(' · ') || 'No brand/model added'}
                    </div>
                    {item.notes && (
                      <div style={{ fontSize: 12, color: 'var(--gray-light)', marginTop: 2 }}>{item.notes}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(item)}
                      style={{ fontSize: 12 }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onDelete(item.id)}
                      style={{ fontSize: 12, color: '#e05555' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new inline form */}
      {mode === 'new' && (
        <div className="card-section" style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Add equipment</div>
          <EquipmentForm
            form={form}
            setForm={setForm}
            onSave={handleSave}
            onCancel={() => setMode('list')}
            isNew={true}
          />
        </div>
      )}

      {/* Empty state */}
      {equipment.length === 0 && mode === 'list' && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">{Icon.equipment}</div>
            <div className="empty-state-title">No equipment added</div>
            <div className="empty-state-body">
              Add your pump, filter, and heater details. Your Pool Mate uses this to tailor maintenance schedules for your setup.
            </div>
            <button className="btn btn-primary btn-sm" onClick={startNew}>Add first item</button>
          </div>
        </div>
      )}

      {/* Tip callout when items exist */}
      {equipment.length > 0 && mode === 'list' && (
        <div className="callout callout-info" style={{ marginTop: 8 }}>
          <span className="callout-icon" style={{ color: 'var(--blue)', display: 'inline-flex' }}>
            {Icon.info}
          </span>
          <div className="callout-body">
            Accurate equipment details improve maintenance reminders and service interval tracking.
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// OCR SCAN MODAL
// ─────────────────────────────────────────────────────────────────
function ScanModal({ onClose, onComplete }) {
  const [state, setState] = useState('idle'); // idle | scanning | done | error

  const handleScan = async () => {
    setState('scanning');
    await new Promise(r => setTimeout(r, 2000));
    // Simulate OCR result
    setState('done');
    setTimeout(() => {
      onComplete({
        freeChlor: 2.1,
        pH: 7.4,
        alkalinity: 68,
        cyanuricAcid: 42,
        calciumHardness: 280,
        createdAt: new Date().toISOString(),
      });
      onClose();
    }, 800);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Scan test results</div>
        <div className="modal-body">
          Take a photo of your pool shop's printed water test. Your Pool Mate reads the values automatically.
        </div>

        {state === 'idle' && (
          <div style={{
            border: 'var(--border)',
            borderRadius: 'var(--r-md)',
            height: 160,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 24,
            background: 'var(--gray-bg)',
            cursor: 'pointer',
            color: 'var(--gray-mid)',
          }} onClick={handleScan}>
            <span style={{ fontSize: 32 }}>{Icon.camera}</span>
            <span style={{ fontSize: 13 }}>Tap to take a photo</span>
          </div>
        )}

        {state === 'scanning' && (
          <div style={{
            height: 160,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 24,
          }}>
            <div className="dot-loader"><span/><span/><span/></div>
            <span style={{ fontSize: 13, color: 'var(--gray-mid)' }}>Reading your test results…</span>
          </div>
        )}

        {state === 'done' && (
          <div style={{
            height: 160,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 24,
          }}>
            <span style={{ color: 'var(--green)', display: 'flex' }}>{Icon.check}</span>
            <span style={{ fontSize: 13, color: 'var(--gray-mid)' }}>Done — loading your results</span>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TRIAL EXPIRED BLOCK SCREEN
// ─────────────────────────────────────────────────────────────────
function TrialExpiredScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--gray-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div className="card-elevated" style={{ maxWidth: 440, width: '100%', padding: '48px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🏊</div>
        <h2 style={{ fontFamily: 'var(--font-read)', fontSize: 24, fontWeight: 400, color: 'var(--black)', marginBottom: 12 }}>
          Your free trial has ended
        </h2>
        <p style={{ fontSize: 14, color: 'var(--gray-mid)', lineHeight: 'var(--lh-body)', marginBottom: 28 }}>
          You've had 7 days to see what Your Pool Mate can do. Keep going — become a founding member at the lowest price we'll ever offer.
        </p>
        <div style={{ background: 'var(--water-pale)', borderRadius: 'var(--r-sm)', padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-read)', fontSize: 36, fontWeight: 400, color: 'var(--black)' }}>$79</div>
          <div style={{ fontSize: 13, color: 'var(--gray-mid)' }}>AUD · one-time · yours forever</div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }}>
          Claim founding access
        </button>
        <div style={{ fontSize: 12, color: 'var(--gray-light)' }}>
          197 of 200 founding spots remaining
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CHEMISTRY LOGIC HELPERS
// ─────────────────────────────────────────────────────────────────
function calculateScore(test) {
  if (!test) return 0;
  let score = 0;

  // Free chlorine (35%)
  const fc = test.freeChlor;
  score += fc >= 1 && fc <= 3 ? 35
    : fc >= 0.5 && fc < 1    ? 20
    : fc > 3 && fc <= 5      ? 22
    : fc > 5                 ? 10 : 5;

  // pH (25%)
  const pH = test.pH;
  score += pH >= 7.2 && pH <= 7.6 ? 25
    : pH >= 7.0 && pH < 7.2       ? 15
    : pH > 7.6 && pH <= 7.8       ? 15
    : pH > 7.8 && pH <= 8.2       ? 8 : 3;

  // Alkalinity (20%)
  const alk = test.alkalinity;
  score += alk >= 80 && alk <= 120 ? 20
    : alk >= 60 && alk < 80        ? 12
    : alk > 120 && alk <= 150      ? 12
    : alk >= 40                    ? 6 : 2;

  // Cyanuric acid (10%)
  const cya = test.cyanuricAcid;
  score += cya >= 30 && cya <= 50 ? 10
    : cya >= 20 && cya < 30       ? 6
    : cya > 50 && cya <= 80       ? 6
    : cya > 0                     ? 3 : 0;

  // Calcium hardness (10%)
  const ca = test.calciumHardness;
  score += ca >= 200 && ca <= 400 ? 10
    : ca >= 150 && ca < 200       ? 6
    : ca > 400 && ca <= 500       ? 6
    : ca > 0                      ? 3 : 0;

  return Math.min(100, Math.round(score));
}

function buildParams(test) {
  return [
    {
      key: 'freeChlor',
      name: 'Free Chlorine',
      reading: `${test.freeChlor} ppm`,
      target: '1.0–3.0',
      ...statusForParam('freeChlor', test.freeChlor),
    },
    {
      key: 'pH',
      name: 'pH',
      reading: `${test.pH}`,
      target: '7.2–7.6',
      ...statusForParam('pH', test.pH),
    },
    {
      key: 'alkalinity',
      name: 'Total Alkalinity',
      reading: `${test.alkalinity} ppm`,
      target: '80–120',
      ...statusForParam('alkalinity', test.alkalinity),
    },
    {
      key: 'cyanuricAcid',
      name: 'Cyanuric Acid',
      reading: `${test.cyanuricAcid} ppm`,
      target: '30–50',
      ...statusForParam('cyanuricAcid', test.cyanuricAcid),
    },
    {
      key: 'calciumHardness',
      name: 'Calcium Hardness',
      reading: `${test.calciumHardness} ppm`,
      target: '200–400',
      ...statusForParam('calciumHardness', test.calciumHardness),
    },
  ];
}

function statusForParam(key, val) {
  const ranges = {
    freeChlor:       { lo: 1, hi: 3 },
    pH:              { lo: 7.2, hi: 7.6 },
    alkalinity:      { lo: 80, hi: 120 },
    cyanuricAcid:    { lo: 30, hi: 50 },
    calciumHardness: { lo: 200, hi: 400 },
  };
  const r = ranges[key];
  if (!val || !r) return { tagClass: 'tag-neutral', status: '— No data', label: `? ${key}` };
  if (val >= r.lo && val <= r.hi) return { tagClass: 'tag-good', status: '✓ Good',       label: `✓ ${paramShort(key)}` };
  if (val < r.lo)                  return { tagClass: 'tag-warn', status: '↑ Low',        label: `↑ ${paramShort(key)}` };
  return                                  { tagClass: 'tag-warn', status: '↓ High',       label: `↓ ${paramShort(key)}` };
}

function paramShort(key) {
  return { freeChlor: 'Chlorine', pH: 'pH', alkalinity: 'Alkalinity', cyanuricAcid: 'Cyanuric', calciumHardness: 'Calcium' }[key] || key;
}

function scoreHeadline(score, params) {
  if (score >= 80) {
    const issues = params.filter(p => p.tagClass !== 'tag-good');
    return issues.length === 0
      ? 'Your pool is in great shape — all readings on target.'
      : `Your pool is in great shape — ${issues.length === 1 ? 'one minor tweak' : `${issues.length} minor tweaks`}.`;
  }
  if (score >= 50) return 'A few readings need attention before your next swim.';
  return 'Chemistry needs urgent correction — hold off swimming for now.';
}

// Resolve pool volume in kilolitres (kL) for dosing maths.
// Volume is now captured in litres; older profiles may still carry volumeKl.
function poolKl(pool) {
  if (pool?.volumeL) return pool.volumeL / 1000;
  if (pool?.volumeKl) return pool.volumeKl;
  return 30;
}

function getPrimaryAction(params, pool) {
  const alk = params.find(p => p.key === 'alkalinity');
  if (alk?.tagClass === 'tag-warn') {
    const vol = poolKl(pool);
    const dose = Math.round(vol * 15);
    return {
      dose: `Add ${dose}g of sodium bicarbonate`,
      reason: `to raise alkalinity from ${alk.reading.replace(' ppm', '')} to 80–120 ppm. Re-test in 24 hours after circulation.`,
    };
  }
  const fc = params.find(p => p.key === 'freeChlor');
  if (fc?.status === '↑ Low') {
    const vol = poolKl(pool);
    const dose = Math.round(vol * 7);
    return {
      dose: `Add ${dose}g of granular chlorine`,
      reason: `to raise free chlorine from ${fc.reading.replace(' ppm', '')} to 1.0–3.0 ppm.`,
    };
  }
  const pH = params.find(p => p.key === 'pH');
  if (pH?.status === '↓ High') {
    return {
      dose: 'Add 200 mL of muriatic acid in stages',
      reason: 'to lower pH to 7.2–7.6. Add with pump running and re-test in 4 hours.',
    };
  }
  return null;
}

function getRecommendations(params, pool) {
  const recs = [];
  const allGood = params.every(p => p.tagClass === 'tag-good');
  if (allGood) {
    recs.push({
      type: 'success',
      iconColor: 'var(--green)',
      icon: Icon.check,
      text: <><strong>All readings on target.</strong> No action needed — your next test is due in three days.</>,
    });
  }
  return recs;
}

function formatRelative(iso) {
  if (!iso) return 'unknown';
  const diff = (Date.now() - new Date(iso)) / 60000;
  if (diff < 2) return 'just now';
  if (diff < 60) return `${Math.round(diff)} min ago`;
  if (diff < 1440) return `${Math.round(diff / 60)} hr ago`;
  return `${Math.round(diff / 1440)} day${Math.round(diff / 1440) > 1 ? 's' : ''} ago`;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}


// ─────────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeView, setActiveView] = useState('health');
  const [testData, setTestData] = useState(null);       // latest test
  const [testHistory, setTestHistory] = useState([]);   // all tests
  const [poolProfile, setPoolProfile] = useState({
    name: 'Backyard pool',
    type: 'In-ground',
    shape: 'Rectangular',
    surface: 'Pebble / pebblecrete',
    volumeL: 32000,
    sanitiser: 'Chlorine (granular/liquid)',
    filter: 'Sand',
    yearBuilt: '',
    yearBuiltApprox: false,
    hasCover: false,
  });
  const [showScan, setShowScan] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(7);
  const [equipment, setEquipment] = useState([]);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Count parameters out of range as pending actions
  const pendingActions = testData
    ? buildParams(testData).filter(p => p.tagClass !== 'tag-good').length
    : 0;

  const handleLogTest = (data) => {
    setTestData(data);
    setTestHistory(h => [...h, data]);
    setActiveView('health');
  };

  const handleScanComplete = (data) => {
    setTestData(data);
    setTestHistory(h => [...h, data]);
    setActiveView('health');
  };

  const handleSavePool = (profile) => {
    setPoolProfile(profile);
  };

  const handleAddEquipment    = (item) => setEquipment(e => [...e, item]);
  const handleUpdateEquipment = (item) => setEquipment(e => e.map(x => x.id === item.id ? item : x));
  const handleDeleteEquipment = (id)   => setEquipment(e => e.filter(x => x.id !== id));

  // Show trial expiry screen if trial ended
  if (trialDaysLeft <= 0) {
    return <TrialExpiredScreen />;
  }

  return (
    <div className="app-shell">
      {/* Top nav */}
      <nav className="topnav">
        <button className="topnav-home" onClick={() => setActiveView('health')}>
          <LogoMark />
          <span className="topnav-wordmark">Your Pool Mate</span>
        </button>
        <div className="topnav-spacer" />
        <div className="topnav-actions">
          {trialDaysLeft <= 7 && (
            <span className="topnav-trial-badge">{trialDaysLeft} days left</span>
          )}
          <button className="btn btn-ghost btn-sm">Help</button>
          <button className="btn btn-nav" onClick={() => setActiveView('tests')}>
            Log test
          </button>
        </div>
      </nav>

      {/* Body */}
      <div className="app-body">
        <Sidebar
          activeView={activeView}
          onNav={setActiveView}
          pendingActions={pendingActions}
        />

        <main className="main-content">
          {activeView === 'health' && (
            <HealthScorePage testData={testData} poolProfile={poolProfile} />
          )}
          {activeView === 'tests' && (
            <WaterTestsPage
              testData={testData}
              onLogTest={handleLogTest}
              onScanTest={() => setShowScan(true)}
              poolProfile={poolProfile}
            />
          )}
          {activeView === 'history' && (
            <ChemistryLogPage history={testHistory} />
          )}
          {activeView === 'setup' && (
            <SetupPage poolProfile={poolProfile} onSave={handleSavePool} />
          )}
          {activeView === 'equipment' && (
            <EquipmentPage
              equipment={equipment}
              onAdd={handleAddEquipment}
              onUpdate={handleUpdateEquipment}
              onDelete={handleDeleteEquipment}
            />
          )}
          {activeView === 'schedule' && (
            <SeasonalTipsPage season={getAUSeason()} />
          )}
          {activeView === 'profile' && (
            <div>
              <h1 className="page-title">Profile</h1>
              <p className="page-subtitle">Account settings and preferences</p>
              <div className="card-section">
                <div className="eyebrow" style={{ marginBottom: 12 }}>Membership</div>
                <div className="callout callout-info">
                  <span className="callout-icon" style={{ color: 'var(--blue)', display: 'inline-flex' }}>
                    {Icon.info}
                  </span>
                  <div className="callout-body">
                    You're on a <strong>7-day free trial</strong> with {trialDaysLeft} days remaining. Become a founding member to keep full access permanently.
                  </div>
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm">Claim founding access — $79</button>
                  <button className="btn btn-ghost btn-sm">Sign out</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Scan modal */}
      {showScan && (
        <ScanModal
          onClose={() => setShowScan(false)}
          onComplete={handleScanComplete}
        />
      )}

      {/* Mobile bottom nav */}
      <MobileNav
        activeView={activeView}
        onNav={(view) => { setActiveView(view); setMobileDrawerOpen(false); }}
        pendingActions={pendingActions}
        onMore={() => setMobileDrawerOpen(v => !v)}
        onLogTest={() => setActiveView('tests')}
      />

      {/* Mobile More drawer */}
      {mobileDrawerOpen && (
        <MobileMoreDrawer
          activeView={activeView}
          onNav={setActiveView}
          onClose={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Feedback overlay — accumulate notes per page, submit as a round */}
      <FeedbackOverlay activeView={activeView} />
    </div>
  );
}
