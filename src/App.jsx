import { useState, useEffect, useRef } from 'react';
import FeedbackOverlay from './FeedbackOverlay.jsx';
import WaterTestScanner from './components/WaterTestScanner.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import GuestOnboarding from './components/GuestOnboarding.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import WaterTrendChart from './components/WaterTrendChart.jsx';
import { useAuth } from './context/AuthContext.jsx';
import * as db from './lib/db.js';
import { calculateScore, isSaltPool } from './lib/healthScore.js';

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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.4" fill="none" stroke="white" strokeWidth="2.1"/>
      <path d="M3.68 13.5 Q 7.8 11.55 12 13.5 T 20.33 13.5 A 8.4 8.4 0 0 1 3.68 13.5 Z" fill="white"/>
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
        <span className="score-number score-number-lg" style={{ fontSize: Math.round(size * 0.46) }}>{score}</span>
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

// Common AU pool equipment brands — suggestions only, the field stays free text.
const EQUIPMENT_BRANDS = [
  'AstralPool', 'Davey', 'Zodiac', 'Pentair', 'Hayward', 'Waterco',
  'Onga', 'Hurlcon', 'Maytronics (Dolphin)', 'Kreepy Krauly', 'Poolrite',
  'Emaux', 'Madimack', 'EvoHeat', 'Insnrg',
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
function HealthScorePage({ testData, poolProfile, onLogFirst }) {
  const score = testData ? scoreFor(testData, poolProfile?.sanitiser) : null;
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
            <button className="btn btn-primary btn-sm" onClick={onLogFirst}>Log first water test</button>
          </div>
        </div>
      </div>
    );
  }

  const params = buildParams(testData);
  const scoreClass = score >= 80 ? 'score-good' : score >= 50 ? 'score-warn' : 'score-critical';
  const headline = scoreHeadline(score, params);
  const primaryAction = getPrimaryAction(testData, poolProfile);
  const recommendations = getRecommendations(testData, poolProfile);

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
          <HealthScoreRing score={score} size={160} />
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
          <div className="eyebrow" style={{ marginBottom: 12 }}>What to do — in order</div>
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
function WaterTestsPage({ testData, onLogTest, onScanTest, poolProfile, autoOpenForm, onAutoOpened }) {
  const [showForm, setShowForm] = useState(false);
  const EMPTY_FORM = {
    freeChlor: '', pH: '', alkalinity: '', cyanuricAcid: '', calciumHardness: '',
    salt: '', phosphates: '', tds: '',
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Open the entry form when a nav "Log test" action requests it, then clear the trigger.
  useEffect(() => {
    if (autoOpenForm) {
      setShowForm(true);
      onAutoOpened?.();
    }
  }, [autoOpenForm, onAutoOpened]);

  const saltPool = isSaltPool(poolProfile?.sanitiser);

  // Core fields, plus salt for salt/mineral pools, plus optional advanced fields.
  const formFields = [
    { key: 'freeChlor',       label: 'Free chlorine',    unit: 'ppm', placeholder: '1.0–3.0' },
    { key: 'pH',              label: 'pH',               unit: '',    placeholder: '7.2–7.6' },
    { key: 'alkalinity',      label: 'Total alkalinity', unit: 'ppm', placeholder: '80–120' },
    { key: 'cyanuricAcid',    label: 'Cyanuric acid',    unit: 'ppm', placeholder: '30–50' },
    { key: 'calciumHardness', label: 'Calcium hardness', unit: 'ppm', placeholder: '200–400' },
    ...(saltPool ? [{ key: 'salt', label: 'Salt', unit: 'ppm', placeholder: '3000–4500' }] : []),
    { key: 'phosphates', label: 'Phosphates', unit: 'ppb', placeholder: 'optional' },
    { key: 'tds',        label: 'Total dissolved solids', unit: 'ppm', placeholder: 'optional' },
  ];

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 800)); // simulate save
    // Untested fields stay null — they're skipped by the Health Score
    // (weights renormalise) instead of being scored as a 0 reading.
    const num = (s) => { const n = parseFloat(s); return Number.isFinite(n) ? n : null; };
    const data = {
      freeChlor: num(form.freeChlor),
      pH: num(form.pH),
      alkalinity: num(form.alkalinity),
      cyanuricAcid: num(form.cyanuricAcid),
      calciumHardness: num(form.calciumHardness),
      createdAt: new Date().toISOString(),
    };
    if (form.salt !== '')       data.salt = num(form.salt);
    if (form.phosphates !== '') data.phosphates = num(form.phosphates);
    if (form.tds !== '')        data.tds = num(form.tds);
    onLogTest(data);
    setSubmitting(false);
    setShowForm(false);
    setForm(EMPTY_FORM);
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
            {formFields.map(f => (
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
// "Untested for more than 2 months" threshold.
const GAP_DAYS = 60;

// Manual event types offered in the "Add event" form.
const EVENT_TYPE_OPTIONS = [
  { value: 'green_treatment', label: 'Green-pool treatment' },
  { value: 'shock',           label: 'Shock dose' },
  { value: 'drain_refill',    label: 'Drain / refill' },
  { value: 'new_equipment',   label: 'New equipment' },
  { value: 'custom',          label: 'Other / custom' },
];

function eventMeta(type) {
  return {
    green_treatment: { color: 'var(--green)',     label: 'Green-pool treatment' },
    shock:           { color: 'var(--blue)',      label: 'Shock dose' },
    new_equipment:   { color: 'var(--color-sky)', label: 'New equipment' },
    drain_refill:    { color: 'var(--blue)',      label: 'Drain / refill' },
    treatment:       { color: 'var(--green)',     label: 'Treatment' },
    custom:          { color: 'var(--gray-mid)',  label: 'Event' },
  }[type] || { color: 'var(--gray-mid)', label: 'Event' };
}

// Auto-detect stretches with no test for > 2 months (incl. an ongoing gap to today).
function deriveGaps(history) {
  if (!history || history.length === 0) return [];
  const sorted = history.slice().sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = +new Date(sorted[i - 1].createdAt);
    const b = +new Date(sorted[i].createdAt);
    const days = Math.round((b - a) / 86400000);
    if (days > GAP_DAYS) gaps.push({ start: sorted[i - 1].createdAt, end: sorted[i].createdAt, days });
  }
  const last = +new Date(sorted[sorted.length - 1].createdAt);
  const sinceDays = Math.round((Date.now() - last) / 86400000);
  if (sinceDays > GAP_DAYS) {
    gaps.push({ start: sorted[sorted.length - 1].createdAt, end: new Date().toISOString(), days: sinceDays, ongoing: true });
  }
  return gaps;
}

// Auto "new equipment" markers, pulled from the equipment register.
function deriveEquipmentEvents(equipment) {
  return (equipment || []).filter(e => e.created_at).map(e => {
    const make = [e.brand, e.model].filter(Boolean).join(' ');
    return {
      id: `eq-${e.id}`,
      type: 'new_equipment',
      title: make ? `${e.type}: ${make}` : e.type,
      date: e.created_at,
      source: 'auto',
    };
  });
}

// ─────────────────────────────────────────────────────────────────
// CHEMISTRY LOG PAGE  (trend graph + events + history table)
// ─────────────────────────────────────────────────────────────────
function ChemistryLogPage({ history, events = [], equipment = [], poolProfile, onAddEvent, onDeleteEvent }) {
  const today = new Date().toISOString().slice(0, 10);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'green_treatment', title: '', date: today, notes: '' });

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submitEvent = () => {
    if (!form.title.trim()) return;
    onAddEvent?.({
      type: form.type,
      title: form.title.trim(),
      date: new Date(`${form.date}T12:00:00`).toISOString(),
      notes: form.notes.trim(),
    });
    setForm({ type: 'green_treatment', title: '', date: today, notes: '' });
    setShowForm(false);
  };

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

  const scored = history.map(t => ({ ...t, score: scoreFor(t, poolProfile?.sanitiser) }));
  const equipEvents = deriveEquipmentEvents(equipment);
  const allEvents = [...events, ...equipEvents].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  const gaps = deriveGaps(history);

  return (
    <div>
      <h1 className="page-title">Chemistry log</h1>
      <p className="page-subtitle">{history.length} tests logged</p>

      {/* Trend graph */}
      <div className="card-section">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Trends over time</div>
        {history.length < 2 ? (
          <p style={{ fontSize: 14, color: 'var(--gray-mid)', marginBottom: 12 }}>
            One test logged. Log another and the line graph will chart your trend.
          </p>
        ) : null}
        <WaterTrendChart history={scored} events={allEvents} gaps={gaps} />
      </div>

      {/* Events */}
      <div className="card-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="eyebrow" style={{ margin: 0 }}>Pool events</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancel' : '+ Add event'}
          </button>
        </div>

        {showForm && (
          <div style={{ marginBottom: 16 }}>
            <div className="input-group">
              <label className="input-label">Event type</label>
              <select className="input" value={form.type} onChange={e => setField('type', e.target.value)}>
                {EVENT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Description</label>
              <input
                className="input"
                placeholder="e.g. Treated green pool — 2 L liquid chlorine + flocculant"
                value={form.title}
                onChange={e => setField('title', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Date</label>
              <input className="input" type="date" max={today} value={form.date} onChange={e => setField('date', e.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Notes (optional)</label>
              <input className="input" value={form.notes} onChange={e => setField('notes', e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={submitEvent} disabled={!form.title.trim()}>
              Save event
            </button>
          </div>
        )}

        {allEvents.length === 0 && gaps.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--gray-mid)' }}>
            No events yet. Add green-pool treatments, shock doses or equipment changes to see them on your timeline.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gaps.map((g, i) => (
              <div key={`gap-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-line)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--amber)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-dark)' }}>
                    Untested for {g.days} days{g.ongoing ? ' (ongoing)' : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-mid)' }}>
                    {formatDate(g.start)} → {g.ongoing ? 'now' : formatDate(g.end)} · auto-detected
                  </div>
                </div>
                <span className="tag tag-warn">Gap</span>
              </div>
            ))}
            {allEvents.slice().reverse().map((e) => {
              const m = eventMeta(e.type);
              const isAuto = e.source === 'auto';
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-line)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-dark)' }}>{e.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-mid)' }}>
                      {m.label} · {formatDate(e.date)}{e.notes ? ` · ${e.notes}` : ''}
                    </div>
                  </div>
                  {isAuto ? (
                    <span className="tag tag-neutral">auto</span>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      aria-label="Delete event"
                      onClick={() => onDeleteEvent?.(e.id)}
                      style={{ minWidth: 44, minHeight: 44, padding: 0 }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History table */}
      <div className="card-section">
        <div className="eyebrow" style={{ marginBottom: 12 }}>All tests</div>
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
              const score = scoreFor(t, poolProfile?.sanitiser);
              const scoreClass = score >= 80 ? 'tag-good' : score >= 50 ? 'tag-warn' : 'tag-bad';
              return (
                <tr key={i}>
                  <td className="col-muted">{formatDate(t.createdAt)}</td>
                  <td><span className={`tag ${scoreClass}`}>{score}</span></td>
                  <td>{fmtReading(t.freeChlor, 'ppm')}</td>
                  <td>{fmtReading(t.pH, '')}</td>
                  <td>{fmtReading(t.alkalinity, 'ppm')}</td>
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
    fenceCertDate: '',
    ...poolProfile,
  }));
  const [saved, setSaved] = useState(false);
  // Volume estimator inputs (metres)
  const [dims, setDims] = useState({ length: '', width: '', depth: '' });

  const set = (key, value) => { setForm(v => ({ ...v, [key]: value })); setSaved(false); };

  const volumeEstimate = (() => {
    const l = parseFloat(dims.length), w = parseFloat(dims.width), d = parseFloat(dims.depth);
    if (l > 0 && w > 0 && d > 0) return Math.round(l * w * d * 1000);
    return null;
  })();

  const handleSave = () => {
    // Volume is held as a raw string while editing (so the field can sit
    // empty instead of snapping back to a sticky 0) — coerce on save only.
    onSave({ ...form, volumeL: parseFloat(form.volumeL) || 0 });
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
            value={form.volumeL === 0 ? '' : form.volumeL}
            onChange={e => set('volumeL', e.target.value)}
          />
          <div style={{ fontSize: 12, color: 'var(--gray-light)', marginTop: 4 }}>
            {parseFloat(form.volumeL) > 0
              ? `≈ ${(parseFloat(form.volumeL) / 1000).toLocaleString('en-AU', { maximumFractionDigits: 1 })} kL`
              : 'Length × width × average depth (m) × 1,000 = litres'}
          </div>

          {/* Volume calculator (beta feedback: asked for on both devices) */}
          <details style={{ marginTop: 8 }}>
            <summary style={{
              fontSize: 13, color: 'var(--blue)', cursor: 'pointer',
              minHeight: 44, display: 'flex', alignItems: 'center',
            }}>
              Not sure? Work it out from your pool's size
            </summary>
            <div style={{ paddingTop: 4 }}>
              <div style={{ fontSize: 13, color: 'var(--gray-mid)', marginBottom: 8 }}>
                Measure in metres. Average depth = (shallow end + deep end) ÷ 2.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { key: 'length', label: 'Length' },
                  { key: 'width',  label: 'Width' },
                  { key: 'depth',  label: 'Avg depth' },
                ].map(f => (
                  <div key={f.key} className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">{f.label}</label>
                    <input
                      className="input"
                      type="number"
                      inputMode="decimal"
                      placeholder="m"
                      value={dims[f.key]}
                      onChange={e => setDims(v => ({ ...v, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              {volumeEstimate && (
                <div style={{ fontSize: 13, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Estimated ≈ <strong>{volumeEstimate.toLocaleString('en-AU')} L</strong></span>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => set('volumeL', String(volumeEstimate))}
                  >
                    Use this
                  </button>
                </div>
              )}
            </div>
          </details>
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

        {/* Fencing certificate date — part of the compliance record */}
        <div className="input-group">
          <label className="input-label" htmlFor="fence-cert-date">Pool fencing certificate date (if you have one)</label>
          <input
            id="fence-cert-date"
            className="input"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.fenceCertDate || ''}
            onChange={e => set('fenceCertDate', e.target.value)}
          />
          <div style={{ fontSize: 12, color: 'var(--gray-light)', marginTop: 4 }}>
            The date on your fencing compliance certificate — part of your pool's
            record, handy at sale or inspection time.
          </div>
        </div>

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
function EquipmentForm({ form, setForm, onSave, onCancel, isNew, saving, error }) {
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
            list="equipment-brand-options"
            value={form.brand}
            onChange={e => setForm(v => ({ ...v, brand: e.target.value }))}
          />
          <datalist id="equipment-brand-options">
            {EQUIPMENT_BRANDS.map(b => <option key={b} value={b} />)}
          </datalist>
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
      {error && (
        <p role="alert" style={{ fontSize: 13, color: '#e05555', marginTop: 10, marginBottom: 0 }}>
          {error}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : isNew ? 'Add equipment' : 'Save changes'}
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const startNew = () => { setForm(EMPTY_FORM); setError(''); setMode('new'); };
  const startEdit = (item) => {
    setForm({ type: item.type, brand: item.brand, model: item.model, notes: item.notes || '' });
    setError('');
    setMode(item.id);
  };
  // Save waits for the DB and keeps the form open on failure — a silent
  // console-only error here was beta feedback ("Can't add").
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (mode === 'new') {
        await onAdd(form);
      } else {
        await onUpdate({ ...form, id: mode });
      }
      setMode('list');
    } catch (err) {
      console.error('Equipment save failed:', err);
      setError("Couldn't save that — check your connection and try again.");
    } finally {
      setSaving(false);
    }
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
                    saving={saving}
                    error={error}
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
            saving={saving}
            error={error}
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
          You've had 30 days to see what Your Pool Mate can do. Keep going — become a founding member at the lowest price we'll ever offer.
        </p>
        <div style={{ background: 'var(--water-pale)', borderRadius: 'var(--r-sm)', padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-read)', fontSize: 36, fontWeight: 400, color: 'var(--black)' }}>$79</div>
          <div style={{ fontSize: 13, color: 'var(--gray-mid)' }}>AUD · one-time · yours forever</div>
        </div>
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: 10 }}
          onClick={() => { window.location.href = 'https://yourpoolmate.com.au/#checkout'; }}
        >
          Claim founding access
        </button>
        <div style={{ fontSize: 12, color: 'var(--gray-light)' }}>
          Limited to 200 founding members
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CHEMISTRY LOGIC HELPERS
// ─────────────────────────────────────────────────────────────────
// Health Score lives in src/lib/healthScore.js (mirrors the
// calculate-health-score edge function). A test's stored score is
// preferred over recomputing so history stays stable if the model
// ever changes: use scoreFor(test, sanitiser) everywhere.
const scoreFor = (test, sanitiser) =>
  test?.healthScore ?? calculateScore(test, sanitiser);

// Acceptable ranges (Australian residential pool standards).
const PARAM_RANGES = {
  freeChlor:       { lo: 1,    hi: 3 },
  pH:              { lo: 7.2,  hi: 7.6 },
  alkalinity:      { lo: 80,   hi: 120 },
  cyanuricAcid:    { lo: 30,   hi: 50 },
  calciumHardness: { lo: 200,  hi: 400 },
  salt:            { lo: 3000, hi: 4500 },
  phosphates:      { lo: 0,    hi: 200 },
  tds:             { lo: 0,    hi: 2000 },
};

// Reading display — untested values render as a dash, never "null ppm".
function fmtReading(v, unit) {
  if (v === null || v === undefined || v === '') return '—';
  return unit ? `${v} ${unit}` : `${v}`;
}

function buildParams(test) {
  const params = [
    { key: 'freeChlor',       name: 'Free Chlorine',    reading: fmtReading(test.freeChlor, 'ppm'),       target: '1.0–3.0', ...statusForParam('freeChlor', test.freeChlor) },
    { key: 'pH',              name: 'pH',               reading: fmtReading(test.pH, ''),                 target: '7.2–7.6', ...statusForParam('pH', test.pH) },
    { key: 'alkalinity',      name: 'Total Alkalinity', reading: fmtReading(test.alkalinity, 'ppm'),      target: '80–120',  ...statusForParam('alkalinity', test.alkalinity) },
    { key: 'cyanuricAcid',    name: 'Cyanuric Acid',    reading: fmtReading(test.cyanuricAcid, 'ppm'),    target: '30–50',   ...statusForParam('cyanuricAcid', test.cyanuricAcid) },
    { key: 'calciumHardness', name: 'Calcium Hardness', reading: fmtReading(test.calciumHardness, 'ppm'), target: '200–400', ...statusForParam('calciumHardness', test.calciumHardness) },
  ];
  if (test.salt != null && test.salt !== '')
    params.push({ key: 'salt', name: 'Salt', reading: fmtReading(test.salt, 'ppm'), target: '3000–4500', ...statusForParam('salt', test.salt) });
  if (test.phosphates != null && test.phosphates !== '')
    params.push({ key: 'phosphates', name: 'Phosphates', reading: fmtReading(test.phosphates, 'ppb'), target: '< 200', ...statusForParam('phosphates', test.phosphates) });
  if (test.tds != null && test.tds !== '')
    params.push({ key: 'tds', name: 'Total Dissolved Solids', reading: fmtReading(test.tds, 'ppm'), target: '< 2000', ...statusForParam('tds', test.tds) });
  return params;
}

function statusForParam(key, val) {
  const r = PARAM_RANGES[key];
  if (val === null || val === undefined || val === '' || !r) {
    return { tagClass: 'tag-neutral', status: '— No data', label: `? ${key}`, state: 'none' };
  }
  const n = Number(val);
  if (!Number.isFinite(n)) return { tagClass: 'tag-neutral', status: '— No data', label: `? ${key}`, state: 'none' };
  if (n >= r.lo && n <= r.hi) return { tagClass: 'tag-good', status: '✓ Good', label: `✓ ${paramShort(key)}`, state: 'ok' };
  if (n < r.lo)               return { tagClass: 'tag-warn', status: '↓ Low',  label: `↓ ${paramShort(key)}`, state: 'low' };
  return                             { tagClass: 'tag-warn', status: '↑ High', label: `↑ ${paramShort(key)}`, state: 'high' };
}

function paramShort(key) {
  return {
    freeChlor: 'Chlorine', pH: 'pH', alkalinity: 'Alkalinity', cyanuricAcid: 'Cyanuric',
    calciumHardness: 'Calcium', salt: 'Salt', phosphates: 'Phosphate', tds: 'TDS',
  }[key] || key;
}

function scoreHeadline(score, params) {
  if (score >= 80) {
    const issues = params.filter(p => p.state === 'low' || p.state === 'high');
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

// ─────────────────────────────────────────────────────────────────
// RECOMMENDATION ENGINE
// Volume-scaled doses, "or" alternatives, correct balancing order,
// and cross-parameter interaction notes.
// ─────────────────────────────────────────────────────────────────

function hasVolume(pool) {
  return !!(pool && pool.volumeL && pool.volumeL > 0);
}

// Dose formatting
const fmtMass = (g)  => (!g  || g  <= 0) ? null : (g  >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${Math.round(g / 5) * 5} g`);
const fmtVol  = (ml) => (!ml || ml <= 0) ? null : (ml >= 1000 ? `${(ml / 1000).toFixed(1)} L`  : `${Math.round(ml / 10) * 10} mL`);

// Midpoint each parameter is dosed toward
const TARGET_MID = {
  pH: 7.4, freeChlor: 2.0, alkalinity: 100, cyanuricAcid: 40,
  calciumHardness: 300, salt: 3500, phosphates: 0, tds: 0,
};

// Correct order to balance a pool: alkalinity buffers pH (first),
// salt must be present before the chlorinator works, chlorine goes in last.
const BALANCE_ORDER = ['alkalinity', 'pH', 'calciumHardness', 'cyanuricAcid', 'salt', 'freeChlor', 'phosphates', 'tds'];

const ACTION_LABEL = {
  pH:              { low: 'Raise pH',                high: 'Lower pH' },
  freeChlor:       { low: 'Raise chlorine',         high: 'Lower chlorine' },
  alkalinity:      { low: 'Raise Total Alkalinity', high: 'Lower Total Alkalinity' },
  cyanuricAcid:    { low: 'Raise stabiliser',       high: 'Lower stabiliser' },
  calciumHardness: { low: 'Raise calcium hardness', high: 'Lower calcium hardness' },
  salt:            { low: 'Raise salt',             high: 'Lower salt' },
  phosphates:      { low: 'Remove phosphates',      high: 'Remove phosphates' },
  tds:             { low: 'Reduce TDS',             high: 'Reduce TDS' },
};

// Dose options for one parameter. `kl` is pool volume in 1000-L units (0 = unknown).
function doseOptions(key, state, val, kl, saltPool) {
  const t = TARGET_MID[key];
  const d = state === 'low' ? (t - val) : (val - t);
  switch (key) {
    case 'pH':
      return state === 'low'
        ? [{ name: 'soda ash (sodium carbonate)', amount: fmtMass(kl * 60 * d) }]
        : [{ name: 'dry acid (sodium bisulphate)', amount: fmtMass(kl * 80 * d) },
           { name: 'hydrochloric acid (liquid)',   amount: fmtVol(kl * 80 * d) }];
    case 'freeChlor': {
      if (state === 'low') {
        const o = [
          { name: 'liquid chlorine (sodium hypochlorite)',    amount: fmtVol(kl * 8 * d) },
          { name: 'granular chlorine (calcium hypochlorite)', amount: fmtMass(kl * 1.4 * d) },
        ];
        if (saltPool) o.unshift({ name: 'increase chlorinator output or run time', amount: null });
        return o;
      }
      return [
        { name: 'let chlorine reduce naturally (sunlight)', amount: null },
        { name: 'chlorine remover (sodium thiosulphate)',   amount: fmtMass(kl * 2.5 * d) },
      ];
    }
    case 'alkalinity':
      return state === 'low'
        ? [{ name: 'buffer / bicarb soda (sodium bicarbonate)', amount: fmtMass(kl * 1.7 * d) }]
        : [{ name: 'dry acid (sodium bisulphate)', amount: fmtMass(kl * 1.9 * d) },
           { name: 'hydrochloric acid (liquid)',   amount: fmtVol(kl * 1.6 * d) }];
    case 'cyanuricAcid':
      return state === 'low'
        ? [{ name: 'stabiliser / conditioner (cyanuric acid)', amount: fmtMass(kl * 1.0 * d) }]
        : [{ name: 'partial drain & refill, or consult your pool professional', amount: null }];
    case 'calciumHardness':
      return state === 'low'
        ? [{ name: 'calcium chloride (hardness increaser)', amount: fmtMass(kl * 1.5 * d) }]
        : [{ name: 'partial drain & refill, or consult your pool professional', amount: null },
           { name: 'scale inhibitor / sequestrant', amount: null }];
    case 'salt':
      return state === 'low'
        ? [{ name: 'pool salt', amount: fmtMass(kl * 1.0 * d) }]
        : [{ name: 'partial drain & refill, or consult your pool professional', amount: null }];
    case 'phosphates':
      return [{ name: 'phosphate remover (lanthanum-based) — dose per product label', amount: null }];
    case 'tds':
      return [{ name: 'partial drain & refill, or consult your pool professional', amount: null }];
    default:
      return [{ name: 'needs attention', amount: null }];
  }
}

// One-line sequencing hint for the ordered plan.
function planNote(key, state, statuses) {
  const alkOff = statuses.alkalinity === 'low' || statuses.alkalinity === 'high';
  if (key === 'alkalinity') return 'Start here — correct alkalinity first so pH holds steady.';
  if (key === 'pH' && alkOff) return 'Do this after alkalinity, and re-test pH first — it often shifts once alkalinity is right.';
  if (key === 'freeChlor' && state === 'low') return 'Add chlorine last — it can nudge pH up, so re-check pH afterwards.';
  if (key === 'salt' && state === 'low') return 'Add salt before relying on the chlorinator.';
  return null;
}

// Cross-parameter interaction notes.
function interactionNotes(key, state, statuses) {
  const out = [];
  const alkOff = statuses.alkalinity === 'low' || statuses.alkalinity === 'high';
  if (key === 'pH') {
    if (state === 'low') {
      if (alkOff) out.push('Balance Total Alkalinity first — unstable alkalinity makes pH swing. Re-test pH afterwards; it often corrects itself.');
      out.push('Soda ash lifts alkalinity slightly as well.');
    } else {
      out.push(statuses.alkalinity === 'high'
        ? 'Bonus: acid brings pH and alkalinity down together.'
        : 'Acid lowers alkalinity too. If it drops low, aerate the water to lift pH back up without chemicals.');
    }
  } else if (key === 'alkalinity') {
    if (state === 'low') out.push('Fix alkalinity before pH — it buffers pH swings. Bicarb nudges pH up a little.');
    else out.push(statuses.pH === 'high'
      ? 'Acid will bring pH down at the same time — adjust both and re-test.'
      : 'Acid lowers pH as well; aerate afterwards to bring pH back up.');
  } else if (key === 'freeChlor' && state === 'low') {
    out.push('Add chlorine last. Liquid chlorine is alkaline and nudges pH up; cal hypo also raises pH and adds calcium. Re-check pH after dosing.');
  } else if (key === 'cyanuricAcid' && state === 'low') {
    out.push('Stabiliser is mildly acidic and can lower pH slightly as it dissolves.');
  } else if (key === 'salt' && state === 'low') {
    out.push('Salt must fully dissolve before the chlorinator can use it.');
  }
  return out;
}

// Ordered list of corrective steps for the current test.
function buildSteps(test, pool) {
  if (!test) return [];
  const kl = hasVolume(pool) ? pool.volumeL / 1000 : 0;
  const saltPool = isSaltPool(pool?.sanitiser);
  const statuses = {};
  BALANCE_ORDER.forEach(key => { statuses[key] = statusForParam(key, test[key]).state; });

  return BALANCE_ORDER
    .filter(key => statuses[key] === 'low' || statuses[key] === 'high')
    .map(key => {
      const state = statuses[key];
      const note = planNote(key, state, statuses);
      return {
        key,
        action: ACTION_LABEL[key]?.[state] || key,
        options: doseOptions(key, state, Number(test[key]), kl, saltPool),
        notes: [note, ...interactionNotes(key, state, statuses)].filter(Boolean),
        volumeKnown: kl > 0,
      };
    });
}

const optionText = (opt) => (opt.amount ? `add about ${opt.amount} ${opt.name}` : opt.name);

function getPrimaryAction(test, pool) {
  const steps = buildSteps(test, pool);
  if (!steps.length) return null;
  const s = steps[0];
  const primary = s.options[0];
  return {
    dose: s.action,
    reason: <>— {optionText(primary)}{s.options[1] ? <>, or {optionText(s.options[1])}</> : null}. {s.notes[0] || 'Re-test before adding more.'}</>,
  };
}

function getRecommendations(test, pool) {
  const steps = buildSteps(test, pool);
  if (!steps.length) {
    return [{
      type: 'success', iconColor: 'var(--green)', icon: Icon.check,
      text: <><strong>All readings on target.</strong> No action needed — your next test is due in three days.</>,
    }];
  }
  const multi = steps.length > 1;
  return steps.map((s, i) => ({
    type: 'action', iconColor: 'var(--amber)', icon: Icon.tip,
    text: (
      <>
        <strong>{multi ? `${i + 1}. ` : ''}{s.action}</strong>
        <div style={{ marginTop: 4 }}>
          {s.options.map((opt, j) => (
            <span key={j}>
              {j > 0 ? <span style={{ color: 'var(--gray-light)' }}> — or — </span> : null}
              {opt.amount ? <><strong>{opt.amount}</strong> {opt.name}</> : opt.name}
            </span>
          ))}
        </div>
        {!s.volumeKnown && (
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--gray-light)' }}>
            Set your pool volume in Setup to see exact quantities.
          </div>
        )}
        {s.notes.map((n, k) => (
          <div key={k} style={{ marginTop: 4, fontSize: 13, color: 'var(--gray-mid)' }}>{n}</div>
        ))}
      </>
    ),
  }));
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
// ─────────────────────────────────────────────────────────────────
// VOLUME GATE — blocks saving a test until a pool volume is known.
// ─────────────────────────────────────────────────────────────────
function VolumeGateModal({ onCancel, onConfirm }) {
  const [litres, setLitres] = useState('');
  const [dims, setDims] = useState({ length: '', width: '', depth: '' });

  const estimate = (() => {
    const l = parseFloat(dims.length), w = parseFloat(dims.width), d = parseFloat(dims.depth);
    if (l > 0 && w > 0 && d > 0) return Math.round(l * w * d * 1000);
    return null;
  })();

  const value = parseInt(litres, 10);
  const valid = Number.isFinite(value) && value > 0;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-title">One quick thing — your pool volume</div>
        <div className="modal-body" style={{ marginBottom: 16 }}>
          Your dose recommendations are calculated from your pool's volume. Enter it once
          and we'll remember it for every future test.
        </div>

        <div className="input-group" style={{ marginBottom: 16 }}>
          <label className="input-label" htmlFor="vg-litres">Pool volume (litres)</label>
          <input
            id="vg-litres"
            className="input"
            type="number"
            inputMode="numeric"
            placeholder="e.g. 50000"
            value={litres}
            onChange={e => setLitres(e.target.value)}
          />
        </div>

        <div style={{ fontSize: 13, color: 'var(--gray-mid)', marginBottom: 8 }}>
          Not sure? Estimate it from the pool's size (metres):
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
          {[
            { key: 'length', label: 'Length' },
            { key: 'width',  label: 'Width' },
            { key: 'depth',  label: 'Avg depth' },
          ].map(f => (
            <div key={f.key} className="input-group">
              <label className="input-label">{f.label}</label>
              <input
                className="input"
                type="number"
                inputMode="decimal"
                placeholder="m"
                value={dims[f.key]}
                onChange={e => setDims(v => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        {estimate && (
          <div style={{ fontSize: 13, marginBottom: 16 }}>
            Estimated ≈ <strong>{estimate.toLocaleString()} L</strong>{' '}
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => setLitres(String(estimate))}
            >
              Use this
            </button>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Not now</button>
          <button
            className="btn btn-primary btn-sm"
            disabled={!valid}
            onClick={() => onConfirm(value)}
          >
            Save volume &amp; log test
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// HELP SHEET — opened from the top-nav Help button
// ─────────────────────────────────────────────────────────────────
function HelpSheet({ onClose }) {
  const steps = [
    { n: '1', title: 'Log a water test', body: 'Type the readings in, or scan your pool shop\'s printout with your camera — it fills the numbers in for you.' },
    { n: '2', title: 'Check your Health Score', body: 'One number out of 100 tells you where your water stands. Green is swim-ready.' },
    { n: '3', title: 'Follow the plan, in order', body: 'The "what to do" list gives exact doses for your pool\'s volume. Re-test a day after dosing.' },
  ];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-title">How Your Pool Mate works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
          {steps.map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'var(--water-pale)', color: 'var(--blue)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600,
              }}>
                {s.n}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--black)', marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: 'var(--gray-mid)', lineHeight: 1.5 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'var(--gray-mid)', lineHeight: 1.5, marginBottom: 16 }}>
          Every test is saved to your history automatically — that's your warranty
          record. Stuck, or spotted something off? Use the feedback button, or email{' '}
          <a href="mailto:yourconnectionaustralia@gmail.com" style={{ color: 'var(--blue)' }}>
            yourconnectionaustralia@gmail.com
          </a>.
        </div>
        <div className="modal-actions">
          <button className="btn btn-primary btn-sm" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_POOL = {
  id: null,
  name: 'My pool',
  type: 'In-ground',
  shape: 'Rectangular',
  surface: 'Pebble / pebblecrete',
  volumeL: 0,
  sanitiser: 'Chlorine (granular/liquid)',
  filter: 'Sand',
  yearBuilt: '',
  yearBuiltApprox: false,
  hasCover: false,
  fenceCertDate: '',
};

export default function App() {
  const { user, session, loading, trialExpired, hasPoolProfile, recoveryMode, signOut } = useAuth();

  const [activeView, setActiveView] = useState('health');
  const [testData, setTestData] = useState(null);       // latest test
  const [testHistory, setTestHistory] = useState([]);   // all tests
  const [poolProfile, setPoolProfile] = useState(DEFAULT_POOL);
  const [showScan, setShowScan] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingTest, setPendingTest] = useState(null); // test awaiting a pool volume
  const [trialDaysLeft, setTrialDaysLeft] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [equipment, setEquipment] = useState([]);
  const [events, setEvents] = useState([]);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [openTestForm, setOpenTestForm] = useState(false); // one-shot: open the log form on the Tests page

  // Shared action for every "Log test" entry point: go to Tests and open the form.
  const goLogTest = () => {
    setActiveView('tests');
    setOpenTestForm(true);
  };

  // Load everything from Supabase once signed in (and again after onboarding)
  const loadAll = async (uid) => {
    try {
      const [profile, pool, tests, equip, evts] = await Promise.all([
        db.loadUserProfile(uid),
        db.loadPoolProfile(uid),
        db.loadTests(uid),
        db.loadEquipment(uid),
        db.loadEvents(uid),
      ]);
      if (profile) {
        setIsPremium(!!profile.is_premium);
        if (profile.trial_ends_at) {
          const days = Math.ceil((new Date(profile.trial_ends_at) - Date.now()) / 86400000);
          setTrialDaysLeft(Math.max(0, days));
        }
      }
      if (pool) setPoolProfile(pool);
      setTestHistory(tests);
      setTestData(tests.length ? tests[tests.length - 1] : null);
      setEquipment(equip);
      setEvents(evts || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setDataReady(true);
    }
  };

  useEffect(() => {
    if (user?.id) loadAll(user.id);
    else setDataReady(false);
  }, [user?.id]);

  // Count parameters out of range as pending actions.
  // Untested parameters (state 'none') are not actions — only real
  // low/high readings count.
  const pendingActions = testData
    ? buildParams(testData).filter(p => p.state === 'low' || p.state === 'high').length
    : 0;

  const persistTest = (data) => {
    db.saveTest(user.id, poolProfile.id, data, calculateScore(data, poolProfile?.sanitiser))
      .catch(err => console.error('Failed to save test:', err));
  };

  // Commit a test once we're sure a pool volume exists.
  const finalizeTest = (data) => {
    setTestData(data);
    setTestHistory(h => [...h, data]);
    persistTest(data);
    setActiveView('health');
  };

  // Doses are useless without a real pool volume, so a test cannot be saved
  // until one is set. If it's missing, hold the test and open the volume gate.
  const guardAndSave = (data) => {
    if (hasVolume(poolProfile)) {
      finalizeTest(data);
    } else {
      setPendingTest(data);
    }
  };

  const handleLogTest = (data) => guardAndSave(data);
  const handleScanComplete = (data) => guardAndSave({ ...data, source: 'ocr' });

  // Volume captured in the gate → save to profile, then commit the held test.
  const handleVolumeConfirmed = (volumeL) => {
    handleSavePool({ volumeL });
    const held = pendingTest;
    setPendingTest(null);
    if (held) finalizeTest(held);
  };

  const handleSavePool = (profile) => {
    setPoolProfile(p => ({ ...p, ...profile }));
    // Merge with the current profile before persisting — savePoolProfile
    // writes a full row, so a partial save (e.g. the volume gate passing
    // only { volumeL }) must not null out every other column.
    db.savePoolProfile(user.id, { ...poolProfile, ...profile })
      .then(id => setPoolProfile(p => ({ ...p, id })))
      .catch(err => console.error('Failed to save pool:', err));
  };

  // Equipment add/update await the DB and rethrow — EquipmentPage keeps the
  // form open and shows the error instead of failing silently.
  const handleAddEquipment = async (item) => {
    const saved = await db.addEquipment(user.id, item);
    setEquipment(e => [...e, saved]);
  };
  const handleUpdateEquipment = async (item) => {
    await db.updateEquipment(item);
    setEquipment(e => e.map(x => x.id === item.id ? item : x));
  };
  const handleDeleteEquipment = (id) => {
    const prev = equipment;
    setEquipment(e => e.filter(x => x.id !== id));
    db.deleteEquipment(id).catch(err => {
      console.error('Failed to delete equipment:', err);
      setEquipment(prev); // delete didn't stick — put the item back
    });
  };

  const handleAddEvent = (event) => {
    db.addEvent(user.id, poolProfile.id, event)
      .then(saved => setEvents(e => [...e, saved]))
      .catch(err => console.error('Failed to add event:', err));
  };
  const handleDeleteEvent = (id) => {
    setEvents(e => e.filter(x => x.id !== id));
    db.deleteEvent(id).catch(err => console.error('Failed to delete event:', err));
  };

  // ── Auth / trial gates ──────────────────────────────────────
  if (loading) return <LoadingScreen />;
  // Password recovery: the reset link creates a session, so gate on recoveryMode
  // BEFORE the session check to show the "set a new password" screen.
  if (recoveryMode) return <AuthScreen />;
  if (!session) return <AuthScreen />;
  if (trialExpired && !isPremium) return <TrialExpiredScreen />;
  if (!dataReady) return <LoadingScreen />;

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
          {!isPremium && trialDaysLeft !== null && (
            <span className="topnav-trial-badge">{trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'} left</span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setShowHelp(true)}>Help</button>
          <button className="btn btn-nav" onClick={goLogTest}>
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
            <HealthScorePage testData={testData} poolProfile={poolProfile} onLogFirst={goLogTest} />
          )}
          {activeView === 'tests' && (
            <WaterTestsPage
              testData={testData}
              onLogTest={handleLogTest}
              onScanTest={() => setShowScan(true)}
              poolProfile={poolProfile}
              autoOpenForm={openTestForm}
              onAutoOpened={() => setOpenTestForm(false)}
            />
          )}
          {activeView === 'history' && (
            <ChemistryLogPage
              history={testHistory}
              events={events}
              equipment={equipment}
              poolProfile={poolProfile}
              onAddEvent={handleAddEvent}
              onDeleteEvent={handleDeleteEvent}
            />
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
                <div className="eyebrow" style={{ marginBottom: 12 }}>Account</div>
                <div style={{ fontSize: 14, color: 'var(--gray-dark)', marginBottom: 16 }}>
                  Signed in as <strong>{user?.email || 'guest'}</strong>
                </div>
                <div className="eyebrow" style={{ marginBottom: 12 }}>Membership</div>
                {isPremium ? (
                  <div className="callout callout-info">
                    <span className="callout-icon" style={{ color: 'var(--green)', display: 'inline-flex' }}>
                      {Icon.check}
                    </span>
                    <div className="callout-body">
                      You're a <strong>founding member</strong> — lifetime access, all future features included.
                    </div>
                  </div>
                ) : (
                  <div className="callout callout-info">
                    <span className="callout-icon" style={{ color: 'var(--blue)', display: 'inline-flex' }}>
                      {Icon.info}
                    </span>
                    <div className="callout-body">
                      You're on a <strong>30-day free trial</strong> with {trialDaysLeft ?? '—'} days remaining. Become a founding member to keep full access permanently.
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  {!isPremium && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => { window.location.href = 'https://yourpoolmate.com.au/#checkout'; }}
                    >
                      Claim founding access — $79
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Scan modal — real OCR via the ocr-water-test Edge Function */}
      {/* Help sheet */}
      {showHelp && <HelpSheet onClose={() => setShowHelp(false)} />}

      {showScan && (
        <WaterTestScanner
          onClose={() => setShowScan(false)}
          onComplete={handleScanComplete}
        />
      )}

      {/* Volume gate — a test can't be saved without a pool volume (doses need it) */}
      {pendingTest && (
        <VolumeGateModal
          onCancel={() => setPendingTest(null)}
          onConfirm={handleVolumeConfirmed}
        />
      )}

      {/* Mobile bottom nav */}
      <MobileNav
        activeView={activeView}
        onNav={(view) => { setActiveView(view); setMobileDrawerOpen(false); }}
        pendingActions={pendingActions}
        onMore={() => setMobileDrawerOpen(v => !v)}
        onLogTest={goLogTest}
      />

      {/* Mobile More drawer */}
      {mobileDrawerOpen && (
        <MobileMoreDrawer
          activeView={activeView}
          onNav={setActiveView}
          onClose={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Guest onboarding — auto-shows for signed-in users with no pool profile */}
      {hasPoolProfile === false && (
        <GuestOnboarding onComplete={() => loadAll(user.id)} />
      )}

      {/* Feedback overlay — accumulate notes per page, submit as a round */}
      <FeedbackOverlay activeView={activeView} />
    </div>
  );
}
