import { useState, useEffect, useCallback, useRef } from 'react';
import FeedbackOverlay from './FeedbackOverlay.jsx';
import WaterTestScanner from './components/WaterTestScanner.jsx';
import VoiceTestEntry from './components/VoiceTestEntry.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import GuestOnboarding from './components/GuestOnboarding.jsx';
import AppTour from './components/AppTour.jsx';
import { PoolIcon, equipmentIconName } from './components/PoolIcon.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import AppSkeleton from './components/AppSkeleton.jsx';
import WaterTrendChart from './components/WaterTrendChart.jsx';
import { useAuth } from './context/AuthContext.jsx';
import * as db from './lib/db.js';
import { memberFormFromRow } from './lib/memberProfile.js';
import MemberProfileForm from './components/MemberProfileForm.jsx';
import TestEditor, { PrintoutViewer } from './components/TestEditor.jsx';
import InstallGuide from './components/InstallGuide.jsx';
import { ReminderOffer, ReminderSettings } from './components/ReminderSettings.jsx';
import AccountData from './components/AccountData.jsx';
import EquipmentCare from './components/EquipmentCare.jsx';
import ProblemFixer from './components/ProblemFixer.jsx';
import { careDueNow, careEventFor, careList, isCareEvent } from './lib/equipmentCare.js';
import { prefsFromRow, wantsTestForm, withoutTestParam } from './lib/reminderPrefs.js';
import RecordExport from './components/RecordExport.jsx';
import { calculateScore, calciumBand, isSaltPool, saltRangeForEquipment } from './lib/healthScore.js';
import { analyticsScreen, trackPageView } from './lib/analytics.js';
import { emptyTestHeadline } from './lib/emptyTestHeadline.js';
import { goodWaterLine, waterLooksGood } from './lib/goodWaterLine.js';
import { scoreChange } from './lib/scoreChange.js';
import { cleanNav, navOption } from './lib/navSlots.js';
import { chatContext } from './lib/chatContext.js';
import AskMate from './components/AskMate.jsx';
import NavEditor from './components/NavEditor.jsx';
import { testPrompt } from './lib/testPrompt.js';
import { doseEventFor, retestPrompt } from './lib/doseLog.js';
import { buildPlan, optionAmount, planContext, readingProblem, turnoverHours } from './lib/plan.js';
import { drawForDose, hasPrice, lowStock, planShortfall, productKeyForDose, shedWithStock } from './lib/shed.js';
import PlanPage, { nextStep } from './components/PlanPage.jsx';
import ShedPage from './components/ShedPage.jsx';
import ShopPage from './components/ShopPage.jsx';
import CostsPage from './components/CostsPage.jsx';
import ShareReport from './components/ShareReport.jsx';
import {
  LowStock, Shortcuts, SwimCall, ThirtyDays, ThisMonth, SHORTCUTS, cleanPins, togglePin,
} from './components/HomeCards.jsx';
import { rectangularVolumeLitres } from './lib/poolVolume.js';
import { displayNameFromUser, homeGreeting } from './lib/greeting.js';
import { supabase } from './lib/supabase.js';
import { createCheckoutSession, fetchCheckoutPricing, offerCopy } from './lib/stripeCheckout.js';

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
      <rect x="2.8" y="8.4" width="18.4" height="11.2" rx="2"/>
      <path d="M2.8 12.6h18.4"/>
      <path d="M8.8 8.4V6.6a1.6 1.6 0 0 1 1.6-1.6h3.2a1.6 1.6 0 0 1 1.6 1.6v1.8"/>
      <path d="M10.4 12.6v2.2h3.2v-2.2"/>
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
  help: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M9.4 9.2a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.3-2.6 4"/>
      <path d="M12 17.2h.01"/>
    </svg>
  ),
  feedback: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  camera: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  mic: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
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
  chat: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>
    </svg>
  ),
  sliders: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="17" x2="20" y2="17"/><circle cx="9" cy="7" r="2.2" fill="white"/><circle cx="15" cy="17" r="2.2" fill="white"/>
    </svg>
  ),
};

// Icon and label for each screen that can sit on the bottom bar.
const NAV_ICONS = {
  health: Icon.waves, plan: Icon.tip, history: Icon.droplet, chat: Icon.chat,
  shed: Icon.droplet, shop: Icon.check, costs: Icon.calendar, fixer: Icon.tip,
  schedule: Icon.calendar, setup: Icon.settings, equipment: Icon.equipment, profile: Icon.user,
};

// ─────────────────────────────────────────────────────────────────
// HEALTH SCORE RING COMPONENT
// ─────────────────────────────────────────────────────────────────
function HealthScoreRing({ score, size = 88 }) {
  const circumference = 220;
  const dashoffset = circumference - (score / 100) * circumference;
  const ringClass =
    score >= 80 ? 'score-ring-fill score-good'
    : score >= 60 ? 'score-ring-fill score-warn'
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
        {/* Scale the number by digit count so "100" sits inside the ring
            instead of running into the stroke (inner diameter ≈ 0.7 × size). */}
        <span className="score-number score-number-lg" style={{ fontSize: Math.round(size * (String(score).length >= 3 ? 0.32 : 0.4)) }}>{score}</span>
        <span className="score-of" style={{ fontSize: Math.max(10, Math.round(size * 0.08)), marginTop: Math.round(size * 0.02) }}>/ 100</span>
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
// 'Chlorinator' covers both salt and mineral units (renamed from 'Salt
// Chlorinator', July 2026). Existing rows with the old label are
// normalised when opened for editing.
const EQUIPMENT_TYPES = [
  'Pump', 'Filter', 'Heater / Heat Pump', 'Robotic Cleaner',
  'Suction Cleaner', 'Chlorinator', 'Lighting', 'Other',
];

// The Equipment page prompts for each of these until one has been added.
// 'Other' is deliberately absent — it's a catch-all, not something an owner
// can be asked to go and find. Each line says what the app does with it, so
// the row answers "why should I bother" before it's asked.
const EQUIPMENT_PROMPTS = [
  { type: 'Pump',               why: 'Sets your daily run time and turnover guidance.' },
  { type: 'Filter',             why: 'Drives backwash and media-change reminders.' },
  { type: 'Chlorinator',        why: 'Sets your salt target and cell-clean interval.' },
  { type: 'Heater / Heat Pump', why: 'Adjusts seasonal chemistry for a heated pool.' },
  { type: 'Robotic Cleaner',    why: 'Adds service intervals for the unit.' },
  { type: 'Suction Cleaner',    why: 'Tracks hose and diaphragm wear.' },
  { type: 'Lighting',           why: 'Logs globe and transformer replacements.' },
];

// Popular AU brands per equipment type — shown as a dropdown with an
// "Other" escape hatch to free text. Types not listed here (Filter,
// Lighting, Other) get a plain free-text brand field.
const EQUIPMENT_BRANDS = {
  'Pump':               ['AstralPool', 'Davey', 'Hayward', 'Hurlcon', 'Zodiac', 'Waterco', 'Onga', 'Poolrite'],
  'Suction Cleaner':    ['Kreepy Krauly', 'Zodiac', 'Hayward'],
  'Heater / Heat Pump': ['Australian Energy Systems', 'Madimack', 'EvoHeat', 'Zodiac'],
  'Robotic Cleaner':    ['Zodiac', 'Kreepy Krauly', 'Maytronics'],
  'Chlorinator':        ['AstralPool', 'Zodiac', 'Pool Controls', 'Maytronics Mineral Swim', 'Pool Pro'],
};

// Popular AU models per equipment type + brand (keyed 'Type|Brand'). Shown as
// a dropdown once a brand is picked, with an "Other" fall-back to free text.
// Kept mostly at series level — owners rarely know the exact size variant, and
// the free-text field still captures it. Includes well-known legacy lines
// (owners log gear they already own, often 5–15 years old).
const EQUIPMENT_MODELS = {
  // Pumps
  'Pump|AstralPool': ['Viron XT', 'CTX Series', 'BX Series', 'E-Series'],
  'Pump|Davey':      ['PowerMaster 200', 'PowerMaster 250', 'PowerMaster 350', 'PowerMaster 450', 'PowerMaster Eco', 'Silensor SLL'],
  'Pump|Hayward':    ['TriStar', 'Super Pump', 'MaxFlo'],
  'Pump|Hurlcon':    ['CX Series', 'TX Series', 'CTX', 'E-Series'],
  'Pump|Zodiac':     ['FloPro E3', 'FloPro'],
  'Pump|Waterco':    ['Hydrostorm', 'Supastream', 'Supatuf'],
  'Pump|Onga':       ['LeisureTime LTP', 'Pantera PPP', 'SilentFlo'],
  'Pump|Poolrite':   ['SQI Series', 'SQ/SQI Gemini', 'Enduro'],
  // Suction cleaners
  'Suction Cleaner|Kreepy Krauly': ['Sprinta Plus', 'VTX-3', 'VTX-7', 'Marathon'],
  'Suction Cleaner|Zodiac':        ['MX8', 'MX6'],
  'Suction Cleaner|Hayward':       ['AquaNaut 250', 'AquaNaut 450', 'PoolVac XL', 'Navigator V-Flex'],
  // Heaters / heat pumps
  'Heater / Heat Pump|Australian Energy Systems': ['Ultra Inverter', 'Ai Aqua-Inverter Plus', 'EFI Ultra', 'TDI'],
  'Heater / Heat Pump|Madimack': ['InverELITE V4', 'InverELITE V3'],
  'Heater / Heat Pump|EvoHeat':  ['Fusion-i', 'Fusion-i Pro', 'Force-i'],
  'Heater / Heat Pump|Zodiac':   ['Z400 iQ'],
  // Robotic cleaners
  'Robotic Cleaner|Zodiac':        ['CX20', 'CX35', 'TX35', 'VX40', 'VX50'],
  'Robotic Cleaner|Kreepy Krauly': ['rX-Tank Pro'],
  'Robotic Cleaner|Maytronics':    ['Dolphin M600', 'Dolphin M700', 'Dolphin S400', 'Liberty 600'],
  // Chlorinators
  'Chlorinator|AstralPool':             ['eQuilibrium EQ18', 'eQuilibrium EQ25', 'eQuilibrium EQ35', 'eQuilibrium EQ45'],
  'Chlorinator|Zodiac':                 ['eXO iQ', 'eXO iQ pH', 'eXO PRO', 'TRi-XO', 'TRi'],
  'Chlorinator|Pool Controls':          ['SWC 15', 'SWC 25', 'SWC 35', 'SWC 45', 'SWC 60', 'XLS'],
  'Chlorinator|Maytronics Mineral Swim': ['PRO20', 'PRO25', 'PRO40'],
  'Chlorinator|Pool Pro':               ['CPP', 'CPPS', 'MineralX'],
};

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


// ─────────────────────────────────────────────────────────────────
// SEASONAL TIPS DATA
// ─────────────────────────────────────────────────────────────────
const SEASONAL_TIPS = {
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

// ─────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────
function Sidebar({ activeView, onNav, pendingActions, shopCount = 0, onHelp, onFeedback, feedbackNoteCount = 0 }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-section-label">Today</div>
        <div
          className={`sidebar-item ${activeView === 'health' ? 'active' : ''}`}
          onClick={() => onNav('health')}
          data-tour="health"
        >
          <span className="sidebar-icon">{Icon.waves}</span>
          Health Score
        </div>
        <div
          className={`sidebar-item ${activeView === 'plan' ? 'active' : ''}`}
          onClick={() => onNav('plan')}
          data-tour="plan"
        >
          <span className="sidebar-icon">{Icon.tip}</span>
          Plan
          {pendingActions > 0 && (
            <span className="sidebar-badge">{pendingActions} to do</span>
          )}
        </div>
        <div
          className={`sidebar-item ${activeView === 'tests' ? 'active' : ''}`}
          onClick={() => onNav('tests')}
          data-tour="tests"
        >
          <span className="sidebar-icon">{Icon.flask}</span>
          Water Tests
        </div>
        <div
          className={`sidebar-item ${activeView === 'history' ? 'active' : ''}`}
          onClick={() => onNav('history')}
          data-tour="history"
        >
          <span className="sidebar-icon">{Icon.droplet}</span>
          Chemistry log
        </div>
        <div
          className={`sidebar-item ${activeView === 'fixer' ? 'active' : ''}`}
          onClick={() => onNav('fixer')}
        >
          <span className="sidebar-icon">{Icon.tip}</span>
          Problem fixer
        </div>
        <div
          className={`sidebar-item ${activeView === 'chat' ? 'active' : ''}`}
          onClick={() => onNav('chat')}
        >
          <span className="sidebar-icon">{Icon.chat}</span>
          Ask Mate
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Pool</div>
        <div
          className={`sidebar-item ${activeView === 'setup' ? 'active' : ''}`}
          onClick={() => onNav('setup')}
          data-tour="setup"
        >
          <span className="sidebar-icon">{Icon.settings}</span>
          Setup
        </div>
        <div
          className={`sidebar-item ${activeView === 'equipment' ? 'active' : ''}`}
          onClick={() => onNav('equipment')}
          data-tour="equipment"
        >
          <span className="sidebar-icon">{Icon.equipment}</span>
          Equipment
        </div>
        <div
          className={`sidebar-item ${activeView === 'shed' ? 'active' : ''}`}
          onClick={() => onNav('shed')}
        >
          <span className="sidebar-icon">{Icon.droplet}</span>
          My Shed
        </div>
        <div
          className={`sidebar-item ${activeView === 'shop' ? 'active' : ''}`}
          onClick={() => onNav('shop')}
        >
          <span className="sidebar-icon">{Icon.check}</span>
          Shopping list
          {shopCount > 0 && <span className="sidebar-badge">{shopCount}</span>}
        </div>
        <div
          className={`sidebar-item ${activeView === 'costs' ? 'active' : ''}`}
          onClick={() => onNav('costs')}
        >
          <span className="sidebar-icon">{Icon.calendar}</span>
          Costs
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
        {/* Help is an action, not a view — it opens the help sheet, which is
            also where the walkthrough can be replayed. */}
        <div className="sidebar-item" onClick={onHelp}>
          <span className="sidebar-icon">{Icon.help}</span>
          Help
        </div>
        {/* Same feedback panel as before. The menu is the only way in. */}
        <div
          className="sidebar-item"
          onClick={onFeedback}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onFeedback?.();
            }
          }}
        >
          <span className="sidebar-icon">{Icon.feedback}</span>
          Feedback
          {feedbackNoteCount > 0 && (
            <span className="sidebar-badge">{feedbackNoteCount}</span>
          )}
        </div>
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────
// MOBILE BOTTOM NAV
// ─────────────────────────────────────────────────────────────────
function MobileNav({ activeView, onNav, pendingActions, onMore, onLogTest, nav }) {
  // Three slots the owner picks; Test fixed in the middle, More on the right.
  // More lights up for any screen that isn't on the bar.
  const moreActive = activeView !== 'tests' && !nav.includes(activeView);
  const slot = (view) => {
    const opt = navOption(view);
    return (
      <button
        key={view}
        className={`mobile-nav-item ${activeView === view ? 'active' : ''}`}
        onClick={() => onNav(view)}
        data-tour={view}
      >
        <span className="mobile-nav-icon">{NAV_ICONS[view]}</span>
        <span className="mobile-nav-label">{opt?.label ?? view}</span>
        {view === 'plan' && pendingActions > 0 && (
          <span className="mobile-nav-badge">{pendingActions}</span>
        )}
      </button>
    );
  };

  return (
    <nav className="mobile-nav">
      {slot(nav[0])}
      {slot(nav[1])}

      {/* Centre CTA — Test Water */}
      <button
        className={`mobile-nav-item mobile-nav-cta ${activeView === 'tests' ? 'active' : ''}`}
        onClick={onLogTest}
        data-tour="tests"
      >
        <span className="mobile-nav-cta-icon">+</span>
        <span className="mobile-nav-label">Test</span>
      </button>

      {slot(nav[2])}

      {/* More */}
      <button
        className={`mobile-nav-item ${moreActive ? 'active' : ''}`}
        onClick={onMore}
        data-tour="more"
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
function MobileMoreDrawer({ activeView, onNav, onClose, onHelp, onFeedback, feedbackNoteCount = 0, pins = [], onTogglePin, pinNotice, shopCount = 0, nav = [], onEditNav }) {
  const sheetRef = useRef(null);
  const grabRef = useRef(null);

  // Swipe down to close. The grab bar always drags; the rest of the sheet drags
  // only when it is scrolled to the top, so scrolling the list still works.
  // Native listeners (not React's) so a downward drag can stop the page from
  // scrolling or pull-to-refreshing underneath.
  useEffect(() => {
    const sheet = sheetRef.current;
    const grab = grabRef.current;
    if (!sheet || !grab) return undefined;
    let startY = 0;
    let startT = 0;
    let dy = 0;
    let armed = false;
    let dragging = false;
    const setY = (y, animate) => {
      sheet.style.transition = animate ? 'transform 0.2s ease-out' : 'none';
      sheet.style.transform = y ? `translateY(${y}px)` : '';
    };
    const onStart = (e) => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      startT = Date.now();
      dy = 0;
      dragging = false;
      armed = grab.contains(e.target) || sheet.scrollTop <= 0;
    };
    const onMove = (e) => {
      if (!armed) return;
      dy = e.touches[0].clientY - startY;
      if (dy <= 0) {
        if (dragging) setY(0, false);
        return;
      }
      if (!dragging && dy < 6) return;
      dragging = true;
      if (e.cancelable) e.preventDefault();
      setY(dy, false);
    };
    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      armed = false;
      const speed = dy / Math.max(1, Date.now() - startT);
      if (dy > 70 || speed > 0.5) {
        setY(sheet.offsetHeight, true);
        window.setTimeout(onClose, 160);
      } else {
        setY(0, true);
      }
    };
    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onEnd);
    sheet.addEventListener('touchcancel', onEnd);
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onEnd);
      sheet.removeEventListener('touchcancel', onEnd);
    };
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Grouped, three or fewer to a group, so the sheet scans in chunks. Water
  // tests is not here: the Test button in the bar already opens it. Screens
  // already on the bottom bar are left out.
  const groups = [
    { title: 'Today', items: [
      { view: 'health',    icon: Icon.waves,      label: 'Home' },
      { view: 'plan',      icon: Icon.tip,        label: 'Plan' },
      { view: 'history',   icon: Icon.droplet,    label: 'History' },
      { view: 'chat',      icon: Icon.chat,       label: 'Ask Mate' },
    ] },
    { title: 'Fix and plan ahead', items: [
      { view: 'fixer',     icon: Icon.tip,        label: 'Problem fixer' },
      { view: 'schedule',  icon: Icon.calendar,   label: SEASONAL_TIPS_LABEL },
    ] },
    { title: 'Chemicals and costs', items: [
      { view: 'shed',      icon: Icon.droplet,    label: 'My Shed' },
      { view: 'shop',      icon: Icon.check,      label: 'Shopping list', badge: shopCount },
      { view: 'costs',     icon: Icon.calendar,   label: 'Costs' },
    ] },
    { title: 'Your pool', items: [
      { view: 'setup',     icon: Icon.settings,  label: 'Pool Setup' },
      { view: 'equipment', icon: Icon.equipment,  label: 'Equipment' },
    ] },
  ]
    .map((g) => ({ ...g, items: g.items.filter((it) => !nav.includes(it.view)) }))
    .filter((g) => g.items.length > 0);
  const pinnable = new Set(SHORTCUTS.map((x) => x.view));
  const row = (item) => (
    <div key={item.view} className="mobile-drawer-row">
      <button
        className={`mobile-drawer-item ${activeView === item.view ? 'active' : ''}`}
        onClick={() => { onNav(item.view); onClose(); }}
        data-tour={`drawer-${item.view}`}
      >
        <span className="mobile-drawer-icon">{item.icon}</span>
        <span>{item.label}</span>
        {item.badge > 0 && <span className="mobile-drawer-badge">{item.badge}</span>}
      </button>
      {onTogglePin && pinnable.has(item.view) && (
        <button
          type="button"
          className={`pin-toggle${pins.includes(item.view) ? ' is-on' : ''}`}
          aria-pressed={pins.includes(item.view)}
          aria-label={`${pins.includes(item.view) ? 'Unpin' : 'Pin'} ${item.label} ${pins.includes(item.view) ? 'from' : 'to'} Home`}
          onClick={() => onTogglePin(item.view, item.label)}
        >
          <span className="pin-star" aria-hidden="true">{pins.includes(item.view) ? '★' : '☆'}</span>
          <span className="pin-word">{pins.includes(item.view) ? 'On Home' : 'Pin'}</span>
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="mobile-drawer-backdrop" onClick={onClose} />
      <div className="mobile-drawer" ref={sheetRef} role="dialog" aria-label="More">
        <button type="button" className="mobile-drawer-grab" ref={grabRef} onClick={onClose} aria-label="Close menu">
          <span className="mobile-drawer-handle" />
        </button>
        {groups.map((g) => (
          <section key={g.title} className="mobile-drawer-group" aria-label={g.title}>
            <h2 className="mobile-drawer-heading">{g.title}</h2>
            {g.items.map(row)}
          </section>
        ))}
        <p className="mobile-drawer-note" role="status">
          {pinNotice || 'Tap ☆ to put a shortcut on your Health Score page.'}
          {pinNotice && pins.length > 0 && !/Unpin one/.test(pinNotice) && (
            <button type="button" className="mobile-drawer-note-link" onClick={() => { onNav('health'); onClose(); }}>See Home</button>
          )}
        </p>
        <h2 className="mobile-drawer-heading">Account</h2>
        {!nav.includes('profile') && row({ view: 'profile', icon: Icon.user, label: 'Profile' })}
        {onEditNav && (
          <button
            type="button"
            className="mobile-drawer-item"
            onClick={() => { onClose(); onEditNav(); }}
          >
            <span className="mobile-drawer-icon">{Icon.sliders}</span>
            <span>Change bottom bar</span>
          </button>
        )}
        <button
          className="mobile-drawer-item"
          onClick={() => { onClose(); onHelp?.(); }}
        >
          <span className="mobile-drawer-icon">{Icon.help}</span>
          <span>Help</span>
        </button>
        <button
          type="button"
          className="mobile-drawer-item"
          onClick={() => { onClose(); onFeedback?.(); }}
        >
          <span className="mobile-drawer-icon">{Icon.feedback}</span>
          <span>Feedback</span>
          {feedbackNoteCount > 0 && (
            <span className="mobile-drawer-badge">{feedbackNoteCount}</span>
          )}
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// HEALTH SCORE PAGE
// ─────────────────────────────────────────────────────────────────
// Melbourne civil time, refreshed each minute so a page left open crosses
// midday and 6pm without a reload.
function useHomeGreeting(user) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return melbourneGreeting(user, now);
}

function HealthScorePage({
  testData, poolProfile, events = [], onLogFirst, onLogTest, user, reminderOffer = null, careDue = [], onOpenCare, onOpenFixer,
  plan, next, doneCount = 0, done = {}, skipped = {}, shopCount = 0, onAdded, onOpen, ctx, tests = [], low = [], pins = [], badges = {},
}) {
  const greeting = useHomeGreeting(user);
  const lastTest = testData?.createdAt;
  const poolLabel = poolProfile
    ? `${poolProfile.name} · ${(poolProfile.volumeL ?? (poolProfile.volumeKl || 0) * 1000).toLocaleString('en-AU')} L`
    : null;
  const thisMonth = ctx && (
    <ThisMonth climate={ctx.climate} pumpHours={ctx.pumpHours} volumeL={ctx.volumeL} turnover={turnoverHours(ctx.volumeL)} />
  );

  // No test at all, or a saved test with no readings in it (a stored 0 that is
  // not bad water). Either way there is nothing to score, so no warning:
  // just offer the test.
  if (!testData || !plan || emptyTestHeadline(testData, poolProfile?.sanitiser)) {
    return (
      <div>
        <p className="page-title">{greeting}</p>
        <h1 className="page-title">Health Score</h1>
        <p className="page-subtitle">No test logged yet</p>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">{Icon.flask}</div>
            <div className="empty-state-title">Let's check the water</div>
            <div className="empty-state-body">
              Clear water can still be short of chlorine. A two-minute test gives you the score, the swim call and a plan in grams and millilitres for your pool.
            </div>
            <button className="btn btn-primary" onClick={onLogTest || onLogFirst}>Log your first test</button>
          </div>
        </div>
        <Shortcuts pins={pins} onOpen={onOpen} badges={badges} />
        {/* Green or cloudy before the first test? The fixer works without one. */}
        <button className="fixer-link" style={{ marginTop: 16 }} onClick={onOpenFixer}>
          <span className="fixer-link-title">Water looking off?</span>
          <span className="fixer-link-sub">Green, cloudy, stinging eyes, foam or stains: open the problem fixer.</span>
        </button>
        {thisMonth}
      </div>
    );
  }

  const score = plan.score;
  const offRows = plan.rows.filter((r) => r.state === 'low' || r.state === 'high');
  // Green ring is 80+. The quiet line only shows when that score has nothing to add.
  const showQuietLine = waterLooksGood(score, plan.steps.length > 0) && plan.swim.tone === 'good';
  // Overdue: a banner with a button. Otherwise a quiet "next test due" line,
  // unless the good-water line under the score already says it.
  const prompt = testPrompt(lastTest);
  // A dose or shock with no test since is a more useful thing to say than "last tested".
  const retest = retestPrompt(events, lastTest);
  // Did the last round of dosing pay off? Compared with the test before.
  const change = scoreChange(tests);

  return (
    <div>
      <div className="score-home-header">
        <p className="page-title">{greeting}</p>
        <h1 className="page-title">Health Score</h1>
        {poolLabel && (
          <p className="page-subtitle">
            Last test logged {formatRelative(lastTest)} · {poolLabel}
          </p>
        )}
      </div>

      {retest && (
        <div className="callout callout-info test-prompt" role="status">
          <span className="callout-icon" style={{ color: 'var(--blue)', display: 'inline-flex' }}>{Icon.info}</span>
          <div className="callout-body">
            <strong>{retest.title}.</strong> {retest.body}
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={onLogTest || onLogFirst}>Test water</button>
            </div>
          </div>
        </div>
      )}

      {!retest && prompt?.kind === 'stale' && (
        <div className="callout callout-info test-prompt" role="status">
          <span className="callout-icon" style={{ color: 'var(--blue)', display: 'inline-flex' }}>{Icon.info}</span>
          <div className="callout-body">
            <strong>{prompt.title}.</strong> {prompt.body}
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={onLogTest || onLogFirst}>Test water</button>
            </div>
          </div>
        </div>
      )}

      {/* Score card. The number is centred and is the focus of the screen,
          with the swim call and the next dose one tap underneath. Local
          conditions are typical-month averages, labelled as such on the
          "This month" card — this app does not store or invent weather. */}
      <div className="card score-hero-card" data-tour="hero">
        <HealthScoreRing score={score} size={240} />
        {change && (
          <p className={`score-change score-change-${change.tone}`}>
            {change.tone !== 'same' && <span aria-hidden="true">{change.tone === 'up' ? '▲' : '▼'} </span>}
            {change.text}
          </p>
        )}
        {showQuietLine && <p className="score-quiet">{goodWaterLine(lastTest)}</p>}
        {!showQuietLine && <div className="score-headline">{plan.headline}</div>}
        {!showQuietLine && !retest && prompt?.kind === 'upcoming' && <p className="score-next-test">{prompt.text}</p>}
        <div className="param-tag-row score-hero-tags">
          {plan.rows.map(r => (
            <span key={r.key} className={`tag ${r.state === 'ok' ? 'tag-good' : r.state === 'none' ? 'tag-neutral' : 'tag-warn'}`}>
              {r.state === 'ok' ? '✓' : r.state === 'low' ? '↓' : r.state === 'high' ? '↑' : '?'} {r.short}
            </span>
          ))}
        </div>
        <SwimCall
          plan={plan}
          next={next}
          doneCount={doneCount}
          done={done}
          skipped={skipped}
          shopCount={shopCount}
          onAdded={onAdded}
          onOpenPlan={() => onOpen('plan')}
          onOpenShop={() => onOpen('shop')}
          onLogTest={onLogTest || onLogFirst}
        />
      </div>

      <LowStock items={low} onOpen={onOpen} />

      {careDue.length > 0 && (
        <div className="callout callout-action care-due-callout">
          <div className="callout-body">
            <strong>{careDue.length === 1 ? 'A job is due' : `${careDue.length} jobs are due`}.</strong>{' '}
            {careDue.map(s => s.task.label).join(', ')}.
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={onOpenCare}>Open equipment care</button>
            </div>
          </div>
        </div>
      )}

      {reminderOffer}

      <Shortcuts pins={pins} onOpen={onOpen} badges={badges} />

      {/* Readings that need attention, then the full table */}
      <div className="card-section stack-lg">
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          {offRows.length ? `${offRows.length} reading${offRows.length === 1 ? '' : 's'} off target` : 'Water readings — all in range'}
        </div>
        <table className="data-table readings-table">
          <thead>
            <tr>
              <th>Reading</th>
              <th>Result</th>
              <th>Target</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map(r => (
              <tr key={r.key}>
                <td>{r.name}</td>
                <td style={{ fontWeight: 500, color: 'var(--black)' }}>{fmtReading(r.value, r.unit)}</td>
                <td className="col-muted">{r.target}</td>
                <td>
                  <span className={`tag ${r.state === 'ok' ? 'tag-good' : r.state === 'none' ? 'tag-neutral' : 'tag-warn'}`}>
                    {r.state === 'ok' ? '✓ Good' : r.state === 'low' ? '↓ Low' : r.state === 'high' ? '↑ High' : '— No data'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {plan.combined != null && (
          <p className="plan-small" style={{ marginTop: 8 }}>Combined chlorine (total minus free): {plan.combined} ppm.</p>
        )}
      </div>

      <ThirtyDays tests={tests} events={events} onOpen={onOpen} />
      {thisMonth}

      <button className="fixer-link" onClick={onOpenFixer}>
        <span className="fixer-link-title">Water looking off?</span>
        <span className="fixer-link-sub">Green, cloudy, stinging eyes, foam or stains: open the problem fixer.</span>
      </button>
      <button className="fixer-link" onClick={() => onOpen('chat')}>
        <span className="fixer-link-title">Got a question?</span>
        <span className="fixer-link-sub">Ask Mate. Plain-English answers that know your pool's litres and readings.</span>
      </button>

      <InstallGuide />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WATER TESTS PAGE
// ─────────────────────────────────────────────────────────────────
// Which logged dose belongs to which step of which test, for databases from
// before migration 021 (the dose row there can't carry its test and step).
// Newer doses carry testId + stepKey and don't need this.
const DOSE_IDS_STORE = 'ypm.doseEvents.v1';

function readDoseIds(testKey) {
  try { return JSON.parse(localStorage.getItem(DOSE_IDS_STORE) || '{}')[testKey] || {}; } catch { return {}; }
}

function writeDoseIds(testKey, ids) {
  try {
    const all = JSON.parse(localStorage.getItem(DOSE_IDS_STORE) || '{}');
    all[testKey] = ids;
    localStorage.setItem(DOSE_IDS_STORE, JSON.stringify(all));
  } catch { /* non-fatal */ }
}

function WaterTestsPage({ testData, onLogTest, onScanTest, onScanStrip, onSpeakTest, poolProfile, saltRange, autoOpenForm, onAutoOpened, stepsLeft = 0, onOpenPlan, rows = [] }) {
  const [showForm, setShowForm] = useState(false);
  const EMPTY_FORM = {
    freeChlor: '', totalChlor: '', pH: '', alkalinity: '', cyanuricAcid: '', calciumHardness: '',
    salt: '', phosphates: '', tds: '',
  };
  const [problem, setProblem] = useState('');
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
    { key: 'freeChlor',       label: 'Free chlorine',    unit: 'ppm', placeholder: '1.0–3.0', group: 'main' },
    { key: 'pH',              label: 'pH',               unit: '',    placeholder: '7.2–7.6', group: 'main' },
    { key: 'alkalinity',      label: 'Total alkalinity', unit: 'ppm', placeholder: '80–120', group: 'main' },
    ...(saltPool ? [{ key: 'salt', label: 'Salt', unit: 'ppm', placeholder: saltRange ? `${saltRange.lo}–${saltRange.hi}` : '3000–5000', group: 'main' }] : []),
    { key: 'cyanuricAcid',    label: 'Cyanuric acid',    unit: 'ppm', placeholder: '30–50', group: 'kit' },
    { key: 'calciumHardness', label: 'Calcium hardness', unit: 'ppm', placeholder: '200–400', group: 'kit' },
    { key: 'totalChlor', label: 'Total chlorine', unit: 'ppm', placeholder: 'optional', group: 'extra' },
    { key: 'phosphates', label: 'Phosphates', unit: 'ppb', placeholder: 'optional', group: 'extra' },
    { key: 'tds',        label: 'Total dissolved solids', unit: 'ppm', placeholder: 'optional', group: 'extra' },
  ];
  // Three short groups instead of one long grid: the readings every test has,
  // the two most strips and kits add, then the rarely-tested extras folded away.
  const fieldsIn = (group) => formFields.filter((f) => f.group === group);
  const mainFields = fieldsIn('main');
  const mainDone = mainFields.filter((f) => form[f.key] !== '').length;
  const fieldGrid = (fields) => (
    <div className="test-form-grid">
      {fields.map(f => (
        <div key={f.key} className="input-group">
          <label className="input-label" htmlFor={`test-${f.key}`}>{f.label}{f.unit ? ` (${f.unit})` : ''}</label>
          <input
            id={`test-${f.key}`}
            className="input"
            type="number"
            inputMode="decimal"
            placeholder={f.placeholder}
            value={form[f.key]}
            onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
          />
        </div>
      ))}
    </div>
  );

  const handleSubmit = async () => {
    // Catch typos (pH 74) before they become a dose for the wrong water.
    const issue = readingProblem(form);
    if (issue) { setProblem(issue.message); return; }
    setProblem('');
    setSubmitting(true);
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
    if (form.totalChlor !== '') data.totalChlor = num(form.totalChlor);
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
      <p className="page-subtitle">Enter a test, read a test strip, scan a printout, or speak the readings</p>

      {/* Actions row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          Enter Test Results
        </button>
        <button className="btn btn-ghost" onClick={onScanStrip}>
          <span style={{ display: 'inline-flex' }}>{Icon.camera}</span>
          Read my test strip
        </button>
        <button className="btn btn-ghost" onClick={onScanTest}>
          <span style={{ display: 'inline-flex' }}>{Icon.camera}</span>
          Scan test results
        </button>
        <button className="btn btn-ghost" onClick={onSpeakTest}>
          <span style={{ display: 'inline-flex' }}>{Icon.mic}</span>
          Speak results
        </button>
      </div>

      {/* Log form */}
      {showForm && (
        <div className="card-section" style={{ marginBottom: 16 }}>
          <div className="test-form-head">
            <h2 className="test-form-title">Your main readings</h2>
            <p className={`test-form-count${mainDone === mainFields.length ? ' is-done' : ''}`} aria-live="polite">
              {mainDone === mainFields.length ? '✓ ' : ''}{mainDone} of {mainFields.length} in
            </p>
          </div>
          <p className="plan-small">These are on every test. They decide the swim call.</p>
          {fieldGrid(mainFields)}
          <h2 className="test-form-title test-form-title-gap">If your kit has them</h2>
          <p className="plan-small">Most strips and pool shop printouts show these too. Leave blank if not.</p>
          {fieldGrid(fieldsIn('kit'))}
          <details className="test-form-extras">
            <summary className="details-summary">Extra readings (total chlorine, phosphates, TDS)</summary>
            <p className="plan-small">With total chlorine, the plan spots chloramines — the cause of the "chlorine smell" — and adds a shock step.</p>
            {fieldGrid(fieldsIn('extra'))}
          </details>
          {problem && <p role="alert" className="test-editor-problem">{problem}</p>}
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
        <>
          <div className="card-section">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Latest reading</div>
            <table className="data-table readings-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Reading</th>
                  <th>Target range</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.key}>
                    <td>{r.name}</td>
                    <td style={{ fontWeight: 500, color: 'var(--black)' }}>{fmtReading(r.value, r.unit)}</td>
                    <td className="col-muted">{r.target}</td>
                    <td>
                      <span className={`tag ${r.state === 'ok' ? 'tag-good' : r.state === 'none' ? 'tag-neutral' : 'tag-warn'}`}>
                        {r.state === 'ok' ? '✓ Good' : r.state === 'low' ? '↓ Low' : r.state === 'high' ? '↑ High' : '— No data'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 17, color: 'var(--gray-light)', marginTop: 12 }}>
              Logged {formatDate(testData.createdAt)}
            </div>
          </div>

          {/* The steps live on the Plan page, ticked from the history. */}
          <div className="card-section" style={{ marginTop: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>What to do</div>
            {stepsLeft > 0 ? (
              <p style={{ fontSize: 17, marginBottom: 12 }}>
                <strong>{stepsLeft} step{stepsLeft === 1 ? '' : 's'} to do</strong>, in order, with amounts for your pool.
              </p>
            ) : (
              <p style={{ fontSize: 17, marginBottom: 12 }}>Nothing left to add for this test.</p>
            )}
            <button className="btn btn-primary" onClick={onOpenPlan}>Open today's plan</button>
          </div>
        </>
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
  if (isCareEvent(type)) return { color: 'var(--color-sky)', label: 'Equipment care' };
  return {
    green_treatment: { color: 'var(--green)',     label: 'Green-pool treatment' },
    shock:           { color: 'var(--blue)',      label: 'Shock dose' },
    dose:            { color: 'var(--amber)',     label: 'Dose added' },
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
// The install date (owner-entered) beats the row's created_at when known.
function deriveEquipmentEvents(equipment) {
  return (equipment || []).filter(e => e.installed_at || e.created_at).map(e => {
    const make = [e.brand, e.model].filter(Boolean).join(' ');
    return {
      id: `eq-${e.id}`,
      type: 'new_equipment',
      title: make ? `${e.type}: ${make}` : e.type,
      date: e.installed_at || e.created_at,
      source: 'auto',
    };
  });
}

// ─────────────────────────────────────────────────────────────────
// CHEMISTRY LOG PAGE  (trend graph + events + history table)
// ─────────────────────────────────────────────────────────────────
function ChemistryLogPage({ history, events = [], equipment = [], poolProfile, saltRange, onAddEvent, onDeleteEvent, onEditTest, onAddPastTest, onViewPrintout, owner, getPhotoUrl }) {
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
            {onAddPastTest && (
              <button className="btn btn-ghost btn-sm" onClick={onAddPastTest}>+ Add a past result</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const scored = history.map(t => ({ ...t, score: scoreFor(t, poolProfile?.sanitiser, saltRange, poolProfile?.surface, poolProfile?.hasCover) }));
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
          <p style={{ fontSize: 17, color: 'var(--gray-mid)', marginBottom: 12 }}>
            One test logged. Log another and the line graph will chart your trend.
          </p>
        ) : null}
        <WaterTrendChart history={scored} events={allEvents} gaps={gaps} saltRange={saltRange} calciumBand={calciumBand(poolProfile?.surface)} />
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
          <p style={{ fontSize: 17, color: 'var(--gray-mid)' }}>
            No events yet. Add green-pool treatments, shock doses or equipment changes to see them on your timeline.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gaps.map((g, i) => (
              <div key={`gap-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-line)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--amber)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--gray-dark)' }}>
                    Untested for {g.days} days{g.ongoing ? ' (ongoing)' : ''}
                  </div>
                  <div style={{ fontSize: 17, color: 'var(--gray-mid)' }}>
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
                    <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--gray-dark)' }}>{e.title}</div>
                    <div style={{ fontSize: 17, color: 'var(--gray-mid)' }}>
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
                      style={{ minWidth: 44, minHeight: 44, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <PoolIcon name="close" size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RecordExport
        owner={owner}
        pool={poolProfile}
        equipment={equipment}
        tests={history}
        events={events}
        scoreFn={(t) => scoreFor(t, poolProfile?.sanitiser, saltRange, poolProfile?.surface, poolProfile?.hasCover)}
        getPhotoUrl={getPhotoUrl}
      />

      <ShareReport
        saltRange={saltRange}
        pool={poolProfile}
        tests={history}
        events={events}
        scoreFn={(t) => scoreFor(t, poolProfile?.sanitiser, saltRange, poolProfile?.surface, poolProfile?.hasCover)}
      />

      {/* All tests: each can be edited or deleted from here */}
      <div className="card-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <div className="eyebrow" style={{ margin: 0 }}>All tests</div>
          {onAddPastTest && (
            <button className="btn btn-ghost btn-sm" onClick={onAddPastTest}>+ Add a past result</button>
          )}
        </div>
        <div className="test-list">
          {history.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).map((t) => {
            const score = scoreFor(t, poolProfile?.sanitiser, saltRange, poolProfile?.surface, poolProfile?.hasCover);
            const scoreClass = score >= 80 ? 'tag-good' : score >= 60 ? 'tag-warn' : 'tag-bad';
            return (
              <div className="test-row" key={t.id || t.createdAt}>
                <div className="test-row-date">
                  {formatDate(t.createdAt)} <span className={`tag ${scoreClass}`}>{score}</span>
                  {t.source === 'shop_import' && <span className="tag tag-neutral" style={{ marginLeft: 6 }}>Past result</span>}
                </div>
                <div className="test-row-readings">
                  Chlorine {fmtReading(t.freeChlor, 'ppm')} · pH {fmtReading(t.pH, '')} · Alkalinity {fmtReading(t.alkalinity, 'ppm')}
                </div>
                {t.editedAt && (
                  <div className="test-row-edited">
                    Edited {formatDate(t.editedAt)}.{originalSummary(t.originalReadings) ? ` First saved as ${originalSummary(t.originalReadings)}.` : ''}
                  </div>
                )}
                {t.id && onEditTest && (
                  <div className="test-row-actions">
                    {t.printoutPath && onViewPrintout && (
                      <button className="btn btn-ghost btn-sm" style={{ minHeight: 44 }}
                              aria-label={`View the printout photo from ${formatDate(t.createdAt)}`}
                              onClick={() => onViewPrintout(t.printoutPath)}>Photo</button>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ minHeight: 44, minWidth: 64 }}
                            aria-label={`Edit the test from ${formatDate(t.createdAt)}`}
                            onClick={() => onEditTest(t)}>Edit</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// "pH 7.5, chlorine 2 ppm, alkalinity 100 ppm" from the readings as first saved.
function originalSummary(orig) {
  if (!orig) return '';
  const bits = [];
  if (orig.free_chlorine != null) bits.push(`chlorine ${orig.free_chlorine} ppm`);
  if (orig.ph != null) bits.push(`pH ${orig.ph}`);
  if (orig.alkalinity != null) bits.push(`alkalinity ${orig.alkalinity} ppm`);
  return bits.join(', ');
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
    pumpHoursPerDay: '',
    pumpHoursSummer: '',
    pumpHoursAutumn: '',
    pumpHoursWinter: '',
    pumpHoursSpring: '',
    pumpScheduleNote: '',
    chlorinatorOutputPercent: '',
    chlorinatorCellGPerHour: '',
    ...Object.fromEntries(Object.entries(poolProfile || {}).map(([k, v]) => [k, v ?? (k === 'id' ? null : '')])),
  }));
  const [saved, setSaved] = useState(false);
  const saltPool = isSaltPool(form.sanitiser);
  // Volume estimator inputs (metres)
  const [dims, setDims] = useState({ length: '', width: '', depth: '' });

  const set = (key, value) => { setForm(v => ({ ...v, [key]: value })); setSaved(false); };

  const volumeEstimate = rectangularVolumeLitres(dims.length, dims.width, dims.depth);

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
          <div style={{ fontSize: 17, color: 'var(--gray-light)', marginTop: 4 }}>
            {parseFloat(form.volumeL) > 0
              ? `≈ ${(parseFloat(form.volumeL) / 1000).toLocaleString('en-AU', { maximumFractionDigits: 1 })} kL`
              : 'Length × width × average depth (m) × 1,000 = litres'}
          </div>

          {/* Volume calculator (beta feedback: asked for on both devices) */}
          <details style={{ marginTop: 8 }}>
            <summary style={{
              fontSize: 17, color: 'var(--blue)', cursor: 'pointer',
              minHeight: 44, display: 'flex', alignItems: 'center',
            }}>
              Not sure? Work it out from your pool's size
            </summary>
            <div style={{ paddingTop: 4 }}>
              <div style={{ fontSize: 17, color: 'var(--gray-mid)', marginBottom: 8 }}>
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
                <div style={{ fontSize: 17, marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
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
            fontSize: 17, color: 'var(--gray-mid)', cursor: 'pointer', marginTop: -4, marginBottom: 16,
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
          <div style={{ fontSize: 17, color: 'var(--gray-light)', marginTop: 4 }}>
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
                    fontSize: 17, fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {opt.l}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pump run and chlorinator — they turn the chlorine step into
            "turn the chlorinator up" before "buy liquid chlorine". */}
        <div className="eyebrow" style={{ margin: '24px 0 12px' }}>Pump and chlorinator</div>
        <div className="input-group">
          <span className="input-label" id="pump-hours-label">Daily pump hours</span>
          <div className="chip-row" role="group" aria-labelledby="pump-hours-label">
            {[4, 6, 8, 10, 12].map(h => (
              <button
                key={h}
                type="button"
                className={`chip${Number(form.pumpHoursPerDay) === h ? ' is-on' : ''}`}
                aria-pressed={Number(form.pumpHoursPerDay) === h}
                onClick={() => set('pumpHoursPerDay', Number(form.pumpHoursPerDay) === h ? '' : h)}
              >
                {h} h
              </button>
            ))}
          </div>
          <details style={{ marginTop: 8 }}>
            <summary className="details-summary">Different hours each season?</summary>
            <div className="season-hours">
              {[['pumpHoursSummer', 'Summer'], ['pumpHoursAutumn', 'Autumn'], ['pumpHoursWinter', 'Winter'], ['pumpHoursSpring', 'Spring']].map(([k, label]) => (
                <div key={k} className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label" htmlFor={`setup-${k}`}>{label}</label>
                  <input id={`setup-${k}`} className="input" type="number" inputMode="numeric" min={0} max={24} placeholder="hours"
                         value={form[k]} onChange={e => set(k, e.target.value)} />
                </div>
              ))}
            </div>
          </details>
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="setup-pump-note">Pump timer note (optional)</label>
          <input id="setup-pump-note" className="input" maxLength={200} placeholder="e.g. mornings in summer, shorter run in winter"
                 value={form.pumpScheduleNote} onChange={e => set('pumpScheduleNote', e.target.value)} />
        </div>
        {saltPool && (
          <>
            <div className="input-group">
              <span className="input-label" id="chl-output-label">Chlorinator output</span>
              <div className="chip-row" role="group" aria-labelledby="chl-output-label">
                {[40, 60, 80, 100].map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`chip${Number(form.chlorinatorOutputPercent) === p ? ' is-on' : ''}`}
                    aria-pressed={Number(form.chlorinatorOutputPercent) === p}
                    onClick={() => set('chlorinatorOutputPercent', Number(form.chlorinatorOutputPercent) === p ? '' : p)}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="setup-cell">Cell size, grams an hour at 100% (optional)</label>
              <input id="setup-cell" className="input" type="number" inputMode="decimal" min={1} max={100} placeholder="from the chlorinator's manual"
                     value={form.chlorinatorCellGPerHour} onChange={e => set('chlorinatorCellGPerHour', e.target.value)} />
              <div style={{ fontSize: 17, color: 'var(--gray-light)', marginTop: 4 }}>
                Leave blank and we use the model on your equipment list.
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
          {saved && (
            <span style={{ fontSize: 17, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--blue)', display: 'inline-flex' }}>
          <PoolIcon name={data.icon} size={26} />
        </span>
        {season} Tips
      </h1>
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
              fontFamily: 'var(--font-read)', fontSize: 17, fontWeight: 500,
              flexShrink: 0, marginTop: 1,
            }}>
              {i + 1}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--black)', marginBottom: 3 }}>
                {tip.title}
              </div>
              <div style={{ fontSize: 17, color: 'var(--gray-mid)', lineHeight: 1.55 }}>
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
  const brandOptions = EQUIPMENT_BRANDS[form.type];
  const modelOptions = EQUIPMENT_MODELS[`${form.type}|${form.brand}`];
  // Free-text brand mode: chosen via "Other", or an existing item whose
  // brand isn't in the list for its type.
  const [customBrand, setCustomBrand] = useState(
    () => !!form.brand && !!EQUIPMENT_BRANDS[form.type] && !EQUIPMENT_BRANDS[form.type].includes(form.brand)
  );
  // Same idea for the model dropdown.
  const [customModel, setCustomModel] = useState(
    () => !!form.model && !!modelOptions && !modelOptions.includes(form.model)
  );
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label className="input-label">Equipment type</label>
          <select
            className="input"
            value={form.type}
            onChange={e => {
              const type = e.target.value;
              // Changing type invalidates the brand/model lists — clear the
              // model, flip brand to free text if it's not in the new list.
              const list = EQUIPMENT_BRANDS[type];
              setForm(v => ({ ...v, type, model: '' }));
              setCustomBrand(!!form.brand && !!list && !list.includes(form.brand));
              setCustomModel(false);
            }}
          >
            {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Brand</label>
          {brandOptions && !customBrand ? (
            <select
              className="input"
              value={brandOptions.includes(form.brand) ? form.brand : ''}
              onChange={e => {
                // Brand drives the model list — always clear the model too.
                setCustomModel(false);
                if (e.target.value === '__other__') {
                  setCustomBrand(true);
                  setForm(v => ({ ...v, brand: '', model: '' }));
                } else {
                  setForm(v => ({ ...v, brand: e.target.value, model: '' }));
                }
              }}
            >
              <option value="">Select a brand</option>
              {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
              <option value="__other__">Other</option>
            </select>
          ) : (
            <>
              <input
                className="input"
                placeholder="Brand name"
                value={form.brand}
                onChange={e => setForm(v => ({ ...v, brand: e.target.value }))}
              />
              {brandOptions && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 4, alignSelf: 'flex-start' }}
                  onClick={() => { setCustomBrand(false); setCustomModel(false); setForm(v => ({ ...v, brand: '', model: '' })); }}
                >
                  Choose from the list instead
                </button>
              )}
            </>
          )}
        </div>
        <div className="input-group">
          <label className="input-label">Model</label>
          {modelOptions && !customModel ? (
            <select
              className="input"
              value={modelOptions.includes(form.model) ? form.model : ''}
              onChange={e => {
                if (e.target.value === '__other__') {
                  setCustomModel(true);
                  setForm(v => ({ ...v, model: '' }));
                } else {
                  setForm(v => ({ ...v, model: e.target.value }));
                }
              }}
            >
              <option value="">Select a model</option>
              {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
              <option value="__other__">Other</option>
            </select>
          ) : (
            <>
              <input
                className="input"
                placeholder="Model (if known)"
                value={form.model}
                onChange={e => setForm(v => ({ ...v, model: e.target.value }))}
              />
              {modelOptions && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 4, alignSelf: 'flex-start' }}
                  onClick={() => { setCustomModel(false); setForm(v => ({ ...v, model: '' })); }}
                >
                  Choose from the list instead
                </button>
              )}
            </>
          )}
        </div>
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label className="input-label">Date installed (if known)</label>
          <input
            className="input"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.installed_at || ''}
            onChange={e => setForm(v => ({ ...v, installed_at: e.target.value }))}
          />
        </div>
        <div className="input-group" style={{ gridColumn: '1 / -1' }}>
          <label className="input-label">Notes (optional)</label>
          <input
            className="input"
            placeholder="e.g. Runs 8 hrs/day in summer"
            value={form.notes}
            onChange={e => setForm(v => ({ ...v, notes: e.target.value }))}
          />
        </div>
      </div>
      {error && (
        <p role="alert" style={{ fontSize: 17, color: '#e05555', marginTop: 10, marginBottom: 0 }}>
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
function EquipmentPage({ equipment, onAdd, onUpdate, onDelete, autoOpenAdd, onAutoOpened, careItems = [], onCareDone }) {
  const EMPTY_FORM = { type: 'Pump', brand: '', model: '', notes: '', installed_at: '' };
  const [mode, setMode] = useState('list'); // 'list' | 'new' | item-id string
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const startNew = () => { setForm(EMPTY_FORM); setError(''); setMode('new'); };
  // Opening the form from a checklist row pre-fills the type, so the owner
  // never picks it twice.
  const startNewOfType = (type) => { setForm({ ...EMPTY_FORM, type }); setError(''); setMode('new'); };

  // Types still missing — these are the rows the checklist offers.
  const addedTypes = new Set((equipment || []).map(e => e.type));
  const remaining = EQUIPMENT_PROMPTS.filter(pr => !addedTypes.has(pr.type));

  // The walkthrough finishes on "Add my equipment" and lands here. The
  // checklist is now the add UI, so make sure it is what they see.
  useEffect(() => {
    if (autoOpenAdd) {
      setMode('list');
      onAutoOpened?.();
    }
  }, [autoOpenAdd, onAutoOpened]);
  const startEdit = (item) => {
    setForm({
      // Normalise the pre-July-2026 type label so the select matches an option.
      type: item.type === 'Salt Chlorinator' ? 'Chlorinator' : item.type,
      brand: item.brand || '',
      model: item.model || '',
      notes: item.notes || '',
      installed_at: item.installed_at || '',
    });
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
          <button className="btn btn-ghost btn-sm" onClick={startNew}>+ Add</button>
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
                  <span style={{ flexShrink: 0, color: 'var(--blue)', display: 'inline-flex' }}>
                    <PoolIcon name={equipmentIconName(item.type)} size={22} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--black)' }}>{item.type}</div>
                    <div style={{ fontSize: 17, color: 'var(--gray-mid)', marginTop: 2 }}>
                      {[item.brand, item.model].filter(Boolean).join(' · ') || 'No brand/model added'}
                    </div>
                    {item.installed_at && (
                      <div style={{ fontSize: 17, color: 'var(--gray-light)', marginTop: 2 }}>
                        Installed {formatDate(item.installed_at)}
                      </div>
                    )}
                    {item.notes && (
                      <div style={{ fontSize: 17, color: 'var(--gray-light)', marginTop: 2 }}>{item.notes}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(item)}
                      style={{ fontSize: 17 }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onDelete(item.id)}
                      style={{ fontSize: 17, color: '#e05555' }}
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

      <EquipmentCare items={careItems} onDone={onCareDone} />

      {/* Add new inline form */}
      {mode === 'new' && (
        <div className="card-section" style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Add {form.type && form.type !== 'Other' ? form.type.toLowerCase() : 'equipment'}
          </div>
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

      {/* Checklist — one row per equipment type not yet added. A row leaves
          the list the moment that type has an entry, so what's left on screen
          is exactly what's still missing. */}
      {mode === 'list' && remaining.length > 0 && (
        <div className="card-section">
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            {equipment.length === 0 ? 'Add your equipment' : 'Still to add'}
          </div>
          <p style={{ fontSize: 17, color: 'var(--gray-mid)', lineHeight: 1.5, marginBottom: 12 }}>
            {equipment.length === 0
              ? "Add whatever you have — skip anything you don't. Each one sharpens your reminders."
              : "Anything else on your pool? Skip what you don't have."}
          </p>

          {remaining.map((pr, i) => (
            <div
              key={pr.type}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 0',
                borderBottom: i < remaining.length - 1 ? 'var(--border)' : 'none',
              }}
            >
              <span style={{ flexShrink: 0, color: 'var(--blue)', display: 'inline-flex' }}>
                <PoolIcon name={equipmentIconName(pr.type)} size={22} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--black)' }}>{pr.type}</div>
                <div style={{ fontSize: 17, color: 'var(--gray-mid)', marginTop: 2 }}>{pr.why}</div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                style={{ flexShrink: 0 }}
                onClick={() => startNewOfType(pr.type)}
              >
                Add
              </button>
            </div>
          ))}

          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 12 }}
            onClick={() => startNewOfType('Other')}
          >
            Something else? Add it manually
          </button>
        </div>
      )}

      {/* Every prompted type is covered. */}
      {mode === 'list' && remaining.length === 0 && equipment.length > 0 && (
        <div className="callout callout-success" style={{ marginBottom: 8 }}>
          <span className="callout-icon" style={{ color: 'var(--green)', display: 'inline-flex' }}>
            {Icon.check}
          </span>
          <div className="callout-body">
            That's your whole setup logged. Use <strong>+ Add</strong> if you add another
            piece of gear later.
          </div>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// IN-APP CHECKOUT
// Signed-in users pay here. stripe-checkout decides founding ($79 once)
// vs annual ($49/year) from the count of paid founding members. We never send a plan or
// Price ID, and we never send the user to the marketing site.
// ─────────────────────────────────────────────────────────────────
const CHECKOUT_RETURN_KEY = 'ypm_checkout_return';

// Read ?checkout=success|cancelled once. The value is stashed so a
// StrictMode remount (dev) still shows the note after the query is stripped.
function captureCheckoutReturn() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('checkout');
    if (fromUrl === 'success' || fromUrl === 'cancelled') {
      sessionStorage.setItem(CHECKOUT_RETURN_KEY, fromUrl);
      params.delete('checkout');
      params.delete('session_id');
      const qs = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
      return fromUrl;
    }
    const stored = sessionStorage.getItem(CHECKOUT_RETURN_KEY);
    if (stored === 'success' || stored === 'cancelled') return stored;
  } catch {
    /* private mode */
  }
  return null;
}

function CheckoutReturnNote({ status }) {
  if (status !== 'success' && status !== 'cancelled') return null;
  const success = status === 'success';
  return (
    <div
      className={`callout ${success ? 'callout-success' : 'callout-info'}`}
      role="status"
      style={{ marginBottom: 16, textAlign: 'left' }}
    >
      <div className="callout-body">
        {success
          ? 'Payment received. Access updates as soon as it clears — refresh if this screen stays up.'
          : 'Checkout cancelled. Nothing was charged.'}
      </div>
    </div>
  );
}

function CheckoutButton({ label, className, style, block }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const startCheckout = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const origin = window.location.origin;
      const url = await createCheckoutSession(supabase, {
        successUrl: origin,
        cancelUrl: origin,
      });
      window.location.assign(url);
    } catch (err) {
      console.error('stripe-checkout create_session failed:', err);
      setError(err?.message || "Couldn't open checkout. Check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <div style={{ width: block ? '100%' : undefined }}>
      <button
        type="button"
        className={className}
        style={style}
        onClick={startCheckout}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? 'Opening checkout…' : label}
      </button>
      {error && (
        <div role="alert" style={{ fontSize: 17, color: 'var(--red)', marginTop: 8, lineHeight: 1.4, textAlign: 'left' }}>
          {error}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TRIAL EXPIRED BLOCK SCREEN
// ─────────────────────────────────────────────────────────────────
function TrialExpiredScreen({ pricing, checkoutReturn }) {
  const copy = offerCopy(pricing);
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
        <CheckoutReturnNote status={checkoutReturn} />
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, color: 'var(--blue)' }}>
          <PoolIcon name="swimmer" size={44} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-read)', fontSize: 24, fontWeight: 400, color: 'var(--black)', marginBottom: 12 }}>
          Your free trial has ended
        </h2>
        <p style={{ fontSize: 17, color: 'var(--gray-mid)', lineHeight: 'var(--lh-body)', marginBottom: 28 }}>
          {copy.expiredBody}
        </p>
        <div style={{ background: 'var(--water-pale)', borderRadius: 'var(--r-sm)', padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-read)', fontSize: 36, fontWeight: 400, color: 'var(--black)' }}>
            {copy.priceLabel || '—'}
          </div>
          <div style={{ fontSize: 17, color: 'var(--gray-mid)' }}>{copy.priceNote}</div>
        </div>
        <CheckoutButton
          block
          label={copy.claimLabel}
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: 10 }}
        />
        <div style={{ fontSize: 17, color: 'var(--gray-light)', marginTop: 10 }}>
          {copy.footnote}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CHEMISTRY LOGIC HELPERS
// ─────────────────────────────────────────────────────────────────
// Health Score lives in src/lib/healthScore.js (mirrors the
// calculate-health-score edge function). A stored score is preferred so
// history stays as recorded. Surface is used only when a score is calculated
// fresh: a new test, or a row with no stored score. No history rewrite.
// saltRange (from the owner's chlorinator) overrides the default salt band.
// A cover makes stabiliser optional, so hasCover is passed through too.
const scoreFor = (test, sanitiser, saltRange, surface, hasCover = false) =>
  test?.healthScore ?? calculateScore(test, sanitiser, saltRange, surface, { hasCover });

// Reading display — untested values render as a dash, never "null ppm".
function fmtReading(v, unit) {
  if (v === null || v === undefined || v === '') return '—';
  return unit ? `${v} ${unit}` : `${v}`;
}

// The dose plan (order, amounts, notes, safety, swim call) is in
// src/lib/plan.js; dose factors are in src/lib/dosing.js, which the
// marketing chlorine calculator imports too.

function hasVolume(pool) {
  return !!(pool && pool.volumeL && pool.volumeL > 0);
}

function formatRelative(iso) {
  if (!iso) return 'unknown';
  const diff = (Date.now() - new Date(iso)) / 60000;
  if (diff < 2) return 'just now';
  if (diff < 60) return `${Math.round(diff)} min ago`;
  if (diff < 1440) return `${Math.round(diff / 60)} hr ago`;
  return `${Math.round(diff / 1440)} day${Math.round(diff / 1440) > 1 ? 's' : ''} ago`;
}

// Health Score header. Australia/Melbourne civil time from the device clock.
// First word of display_name, first_name, or full_name. No name: the phrase alone.
function melbourneGreeting(user, date = new Date()) {
  return homeGreeting(date, displayNameFromUser(user));
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
function VolumeGateModal({ onCancel, onConfirm, suggestedL = null }) {
  const [litres, setLitres] = useState('');
  const [dims, setDims] = useState({ length: '', width: '', depth: '' });

  const estimate = rectangularVolumeLitres(dims.length, dims.width, dims.depth);

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

        {suggestedL && (
          <div style={{ fontSize: 17, marginBottom: 16 }}>
            Your printout says <strong>{suggestedL.toLocaleString('en-AU')} L</strong>. Shops often estimate, so check it looks right.{' '}
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setLitres(String(suggestedL))}>
              Use this
            </button>
          </div>
        )}

        <div style={{ fontSize: 17, color: 'var(--gray-mid)', marginBottom: 8 }}>
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
          <div style={{ fontSize: 17, marginBottom: 16 }}>
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
function HelpSheet({ onClose, onReplayTour }) {
  const steps = [
    { n: '1', title: 'Enter your test results', body: 'Type the readings in, photograph your test strip, or scan your pool shop\'s printout with your camera. It fills the numbers in for you.' },
    { n: '2', title: 'Check your Health Score', body: 'One number out of 100 tells you where your water stands. Green is swim-ready.' },
    { n: '3', title: 'Follow the plan, in order', body: 'Plan lists what to add, in grams and millilitres for your pool. Tap "I added it" as you go. Re-test a day after dosing.' },
    { n: '4', title: 'Keep the shed stocked', body: 'Add what you buy to My Shed and the plan uses it first, tells you when not to buy more, and adds what you\'re short of to the shopping list.' },
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
                fontSize: 17, fontWeight: 600,
              }}>
                {s.n}
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--black)', marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 17, color: 'var(--gray-mid)', lineHeight: 1.5 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 17, color: 'var(--gray-mid)', lineHeight: 1.5, marginBottom: 16 }}>
          Every test is saved to your history automatically. That's your warranty record. Stuck, or spotted something off? Use Feedback under Profile, or email{' '}
          <a href="mailto:hello@yourpoolmate.com.au" style={{ color: 'var(--blue)' }}>
            hello@yourpoolmate.com.au
          </a>
        </div>
        <div className="modal-actions">
          {onReplayTour && (
            <button className="btn btn-ghost btn-sm" onClick={onReplayTour}>
              Replay the walkthrough
            </button>
          )}
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
  const [scanMode, setScanMode] = useState('printout'); // 'printout' | 'strip': what the scanner reads
  const [showVoice, setShowVoice] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [feedbackOpenToken, setFeedbackOpenToken] = useState(0);
  const [feedbackNoteCount, setFeedbackNoteCount] = useState(0);
  const [pendingTest, setPendingTest] = useState(null); // test awaiting a pool volume
  const [suggestedVolumeL, setSuggestedVolumeL] = useState(null); // pool size printed on a scanned printout
  const [trialDaysLeft, setTrialDaysLeft] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [plan, setPlan] = useState(null); // 'founding_lifetime' | 'annual' | null
  // A failed cloud save must never look like a saved record — the history is
  // the warranty record. Holds { message, retry } while a save needs attention.
  const [saveProblem, setSaveProblem] = useState(null);
  const [memberDetails, setMemberDetails] = useState(() => memberFormFromRow(null));
  const [pricing, setPricing] = useState(null);
  // Captured once from ?checkout= so a StrictMode remount still shows the note.
  const [checkoutReturn] = useState(captureCheckoutReturn);
  const [equipment, setEquipment] = useState([]);
  const [events, setEvents] = useState([]);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false); // session-scoped
  const [dataReady, setDataReady] = useState(false);
  const [reminderPrefs, setReminderPrefs] = useState({ available: false, reminderDay: null, monthlyReport: true });
  // The weekly email links to /?test=1. Remember it from the first render:
  // sign-in can take a moment, and the form should open once the data is in.
  const wantsTestLink = useRef(wantsTestForm(window.location.search));
  const [photoViewer, setPhotoViewer] = useState(null); // printout photo path being viewed
  const [editor, setEditor] = useState(null); // { mode: 'edit', test } | { mode: 'add' }
  const [openTestForm, setOpenTestForm] = useState(false); // one-shot: open the log form on the Tests page
  const [openEquipmentForm, setOpenEquipmentForm] = useState(false); // one-shot: open the add-equipment form
  const [tourActive, setTourActive] = useState(false); // post-onboarding walkthrough
  // My Shed and the shopping list (migration 021). `available` is false until
  // the database has the tables; those screens then say so and nothing breaks.
  const [shed, setShed] = useState({ available: false, items: [] });
  const [shop, setShop] = useState({ available: false, items: [] });
  // Pinned shortcuts: saved to the account when the database allows it,
  // otherwise kept on this device.
  const [pins, setPins] = useState(() => {
    try { return cleanPins(JSON.parse(localStorage.getItem('ypm.pins.v1') || 'null') ?? undefined); } catch { return cleanPins(); }
  });
  const [pinNotice, setPinNotice] = useState(null);
  // The bottom bar's three owner-chosen buttons: saved to the account with
  // the pins, and kept on this device too.
  const [navSlots, setNavSlots] = useState(() => {
    try { return cleanNav(JSON.parse(localStorage.getItem('ypm.nav.v1') || 'null')); } catch { return cleanNav(); }
  });
  const [navEditorOpen, setNavEditorOpen] = useState(false);

  // The shell never changes the URL, so Analytics only sees a new screen
  // when activeView (or an auth/trial gate) changes. Same measurement id
  // and linker as index.html; this only sends page_view.
  const signedIn = Boolean(session);
  useEffect(() => {
    trackPageView(analyticsScreen({
      loading,
      recoveryMode,
      signedIn,
      trialExpired,
      isPremium,
      dataReady,
      activeView,
    }));
  }, [loading, recoveryMode, signedIn, trialExpired, isPremium, dataReady, activeView]);

  // Walkthrough drives the view so each popup describes the page in front of
  // the user. Stable identity so AppTour's effects don't re-fire every render.
  const handleTourNavigate = useCallback((view) => {
    setActiveView(view);
    setMobileDrawerOpen(false);
  }, []);

  // Seen once per account, never again — the walkthrough is a first-run thing.
  // Keyed by account, not just browser, so a second person signing up on the
  // same phone or laptop still gets their welcome.
  const tourSeenKey = `ypm_tour_seen_${user?.id ?? 'guest'}`;
  const endTour = useCallback(({ addEquipment = false } = {}) => {
    setTourActive(false);
    try { localStorage.setItem(tourSeenKey, '1'); } catch { /* private mode */ }
    if (addEquipment) {
      setActiveView('equipment');
      setOpenEquipmentForm(true);
    }
  }, [tourSeenKey]);

  // Shared action for every "Log test" entry point: go to Tests and open the form.
  const goLogTest = () => {
    setActiveView('tests');
    setOpenTestForm(true);
  };

  // Opens the existing feedback panel. A new token each tap so closing
  // it and choosing Feedback again opens it a second time.
  const openFeedback = useCallback(() => {
    setFeedbackOpenToken((n) => n + 1);
  }, []);
  const handleFeedbackNoteCount = useCallback((count) => {
    setFeedbackNoteCount(count);
  }, []);

  // Load everything from Supabase once signed in (and again after onboarding)
  const loadAll = async (uid) => {
    try {
      const [profile, pool, tests, equip, evts, shedRes, shopRes] = await Promise.all([
        db.loadUserProfile(uid),
        db.loadPoolProfile(uid),
        db.loadTests(uid),
        db.loadEquipment(uid),
        db.loadEvents(uid),
        // Shed and shopping list never block the rest of the app.
        db.loadShed(uid).catch((err) => { console.error('Failed to load shed:', err); return { available: false, items: [] }; }),
        db.loadShop(uid).catch((err) => { console.error('Failed to load shopping list:', err); return { available: false, items: [] }; }),
      ]);
      setShed(shedRes);
      setShop(shopRes);
      if (profile?.app_prefs && Array.isArray(profile.app_prefs.pins)) setPins(cleanPins(profile.app_prefs.pins));
      if (profile?.app_prefs && Array.isArray(profile.app_prefs.nav)) setNavSlots(cleanNav(profile.app_prefs.nav));
      if (profile) {
        setIsPremium(!!profile.is_premium);
        setPlan(profile.plan ?? null);
        if (profile.trial_ends_at) {
          const days = Math.ceil((new Date(profile.trial_ends_at) - Date.now()) / 86400000);
          setTrialDaysLeft(Math.max(0, days));
        }
      }
      setMemberDetails(memberFormFromRow(profile));
      setReminderPrefs(prefsFromRow(profile));
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
    if (!dataReady || !wantsTestLink.current) return;
    wantsTestLink.current = false;
    try { window.history.replaceState(null, '', withoutTestParam(window.location.href)); } catch { /* ignore */ }
    goLogTest();
  }, [dataReady]);

  useEffect(() => {
    if (user?.id) loadAll(user.id);
    else setDataReady(false);
  }, [user?.id]);

  // Welcome and first-test emails go out as soon as they are due, not at the
  // next scheduled sweep. New members only; the server decides what is owed.
  const hasTests = testHistory.length > 0;
  useEffect(() => {
    if (!user?.id) return undefined;
    const joined = new Date(user.created_at).getTime();
    if (!Number.isFinite(joined) || Date.now() - joined > 32 * 24 * 60 * 60 * 1000) return undefined;
    db.nudgeMemberEmails();
    // The first-test follow-up waits 15 minutes by design; ask again just after.
    const timer = hasTests ? setTimeout(() => db.nudgeMemberEmails(), 16 * 60 * 1000) : null;
    return () => { if (timer) clearTimeout(timer); };
  }, [user?.id, hasTests]);

  // Server-authoritative price for the paywall and profile CTA.
  // Failure leaves the button price-neutral; create_session still works.
  useEffect(() => {
    if (!user?.id || isPremium) return undefined;
    let cancelled = false;
    fetchCheckoutPricing(supabase)
      .then((data) => { if (!cancelled && data) setPricing(data); })
      .catch((err) => console.error('stripe-checkout get_pricing failed:', err));
    return () => { cancelled = true; };
  }, [user?.id, isPremium]);

  // Drop the stashed return flag after commit. The timeout is cancelled on
  // the discarded StrictMode mount so the real mount can still read it.
  useEffect(() => {
    const timer = setTimeout(() => {
      try { sessionStorage.removeItem(CHECKOUT_RETURN_KEY); } catch { /* private mode */ }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Webhook grants premium after Stripe redirects back. The first load can
  // beat that write, so retry briefly before asking the user to refresh.
  useEffect(() => {
    if (checkoutReturn !== 'success' || !user?.id) return undefined;
    let cancelled = false;
    const timers = [1500, 4000].map((ms) => setTimeout(() => {
      if (!cancelled) loadAll(user.id);
    }, ms));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [checkoutReturn, user?.id]);

  // Salt/mineral target band from the owner's chlorinator (null = app default).
  const saltRange = saltRangeForEquipment(equipment);

  // ── The plan for the latest test ──────────────────────────
  // Climate comes from the member's postcode (state) and the month.
  const ctx = planContext({ pool: poolProfile, equipment, saltRange, postcode: memberDetails?.postcode });
  const dosePlan = testData ? buildPlan(testData, ctx) : null;
  const doseEvents = events.filter((e) => e.type === 'dose');
  const stock = shedWithStock(shed.items, doseEvents);
  const testKey = testData ? (testData.id || testData.createdAt) : null;

  // Steps marked as added for this test: from the history (migration 021),
  // or the per-device map older databases needed.
  const done = {};
  if (testData?.id) {
    for (const e of doseEvents) if (e.testId === testData.id && e.stepKey) done[e.stepKey] = e;
  }
  if (testKey) {
    for (const [stepKey, id] of Object.entries(readDoseIds(testKey))) {
      const e = events.find((x) => x.id === id);
      if (e && !done[stepKey]) done[stepKey] = e;
    }
  }
  // Steps put on the shopping list instead.
  const skipped = {};
  if (testData?.id) {
    for (const i of shop.items) {
      if (i.status === 'needed' && i.source === 'skip' && i.testId === testData.id && i.stepKey) skipped[i.stepKey] = i;
    }
  }
  const next = dosePlan ? nextStep(dosePlan, done, skipped) : null;
  const doneCount = dosePlan ? dosePlan.steps.filter((st) => done[st.key]).length : 0;
  // Steps still to do — shown on the Plan tab badge.
  const pendingActions = dosePlan ? dosePlan.steps.filter((st) => !done[st.key]).length : 0;
  const shopCount = shop.items.filter((i) => i.status !== 'bought').length;
  const low = shed.available ? lowStock(stock, doseEvents) : [];
  const shopSuggestions = dosePlan && shop.available
    ? planShortfall({ plan: dosePlan, stock, doneKeys: new Set([...Object.keys(done), ...Object.keys(skipped)]), testId: testData?.id ?? null }).filter((r) => !r.covered)
    : [];

  // Show the test straight away, then confirm it reached the database. If the
  // save fails, take it back out of the history and offer a retry — a test
  // that only exists on screen would vanish on the next launch.
  const persistTest = (data, pool = poolProfile) => {
    const score = calculateScore(data, pool?.sanitiser, saltRange, pool?.surface, { hasCover: pool?.hasCover });
    return db.saveTest(user.id, pool?.id, data, score)
      .then((id) => {
        setSaveProblem(null);
        // Give the on-screen copy its database id so it can be edited or deleted
        // straight away, without a reload.
        setTestHistory(h => h.map(t => (t === data ? { ...t, id } : t)));
        setTestData(td => (td === data ? { ...data, id } : td));
        if (data.printout) attachPrintout(id, data.printout);
      })
      .catch(err => {
        console.error('Failed to save test:', err);
        setTestHistory(h => {
          const next = h.filter(t => t !== data);
          setTestData(next.length ? next[next.length - 1] : null);
          return next;
        });
        setSaveProblem({
          message: "That water test didn't save, so it isn't in your history yet. Check your connection and try again.",
          retry: () => finalizeTest(data, pool),
        });
      });
  };

  // Keep the printout photo with a saved test. The test itself is already safe,
  // so a failed upload says so and offers a retry rather than undoing the test.
  const attachPrintout = (testId, blob) => {
    return db.savePrintout(user.id, testId, blob)
      .then((path) => {
        const withPath = (t) => (t.id === testId ? { ...t, printoutPath: path, printout: undefined } : t);
        setTestHistory(h => h.map(withPath));
        setTestData(td => (td ? withPath(td) : td));
      })
      .catch(err => {
        console.error('Failed to save printout photo:', err);
        setSaveProblem({
          message: "Your test is saved, but the printout photo didn't upload. Check your connection and try again.",
          retry: () => attachPrintout(testId, blob),
        });
      });
  };

  // Commit a test once we're sure a pool volume exists.
  const finalizeTest = (data, pool = poolProfile) => {
    // A scanned printout can be older than the latest test. Keep the history in
    // date order and show the newest test as the current one, so an old printout
    // never replaces a newer result on the Health Score page.
    const isNewest = !testHistory.some(t => +new Date(t.createdAt) > +new Date(data.createdAt));
    setTestHistory(h => {
      const next = sortTests([...h, data]);
      setTestData(next[next.length - 1]);
      return next;
    });
    persistTest(data, pool);
    // An older printout lands in the Chemistry log at its real date.
    setActiveView(isNewest ? 'health' : 'history');
  };

  // Doses are useless without a real pool volume, so a test cannot be saved
  // until one is set. If it's missing, hold the test and open the volume gate.
  const guardAndSave = (data, suggested = null) => {
    if (hasVolume(poolProfile)) {
      finalizeTest(data);
    } else {
      setSuggestedVolumeL(suggested);
      setPendingTest(data);
    }
  };

  const handleLogTest = (data) => guardAndSave(data);
  const handleScanComplete = (data) => {
    // The printout's pool size is only a suggestion for the volume prompt.
    const { printoutVolumeL, ...test } = data;
    // A test strip comes back as source 'manual' (a colour match the owner confirmed).
    guardAndSave({ ...test, source: test.source || 'ocr' }, printoutVolumeL ?? null);
  };
  const handleVoiceComplete = (data) => guardAndSave({ ...data, source: 'voice' });

  // Volume captured in the gate → save to profile, then commit the held test.
  const handleVolumeConfirmed = (volumeL) => {
    const nextPool = { ...poolProfile, volumeL };
    const held = pendingTest;
    setPendingTest(null);
    // Save the pool first so the held test is stored against it (and scored
    // with the new volume), rather than racing the profile write.
    handleSavePool({ volumeL }).then((id) => {
      if (held) finalizeTest(held, id ? { ...nextPool, id } : nextPool);
    });
  };

  const handleSaveMember = async (fields) => {
    const saved = await db.saveUserProfile(user.id, fields);
    setMemberDetails(memberFormFromRow(saved));
    return saved;
  };

  const handleSaveReminders = async (patch) => {
    const saved = await db.saveReminderPrefs(user.id, patch);
    setReminderPrefs(prefsFromRow(saved));
    return saved;
  };

  const handleSavePool = (profile) => {
    setPoolProfile(p => ({ ...p, ...profile }));
    // Merge with the current profile before persisting — savePoolProfile
    // writes a full row, so a partial save (e.g. the volume gate passing
    // only { volumeL }) must not null out every other column.
    return db.savePoolProfile(user.id, { ...poolProfile, ...profile })
      .then(id => {
        setPoolProfile(p => ({ ...p, id }));
        return id;
      })
      .catch(err => {
        console.error('Failed to save pool:', err);
        setSaveProblem({
          message: "Your pool details didn't save. Check your connection and try again.",
          retry: () => handleSavePool(profile),
        });
        return poolProfile?.id ?? null;
      });
  };

  // Equipment add/update await the DB and rethrow — EquipmentPage keeps the
  // form open and shows the error instead of failing silently.
  const handleAddEquipment = async (item) => {
    const saved = await db.addEquipment(user.id, item);
    setEquipment(e => [...e, saved]);
  };
  const handleUpdateEquipment = async (item) => {
    await db.updateEquipment(item);
    // Merge, don't replace — the form payload doesn't carry created_at.
    setEquipment(e => e.map(x => x.id === item.id ? { ...x, ...item } : x));
  };
  const handleDeleteEquipment = (id) => {
    const prev = equipment;
    setEquipment(e => e.filter(x => x.id !== id));
    db.deleteEquipment(id).catch(err => {
      console.error('Failed to delete equipment:', err);
      setEquipment(prev); // delete didn't stick — put the item back
    });
  };

  // ── Fix, delete or back-date a test (History screen) ─────────
  // These await the database and rethrow, so the editor stays open and says
  // what went wrong instead of closing on a save that did not happen.
  const sortTests = (list) => [...list].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const setHistorySorted = (next) => {
    const sorted = sortTests(next);
    setTestHistory(sorted);
    setTestData(sorted.length ? sorted[sorted.length - 1] : null);
  };
  const scoreOne = (t) => calculateScore(t, poolProfile?.sanitiser, saltRange, poolProfile?.surface, { hasCover: poolProfile?.hasCover });

  const handleUpdateTest = async (data, { photo, removePhoto } = {}) => {
    const saved = await db.updateTest(data.id, data, scoreOne(data));
    let printoutPath = saved.printoutPath;
    if (photo) printoutPath = await db.savePrintout(user.id, data.id, photo);
    else if (removePhoto && printoutPath) { await db.removePrintout(data.id, printoutPath); printoutPath = null; }
    setHistorySorted(testHistory.map(t => (t.id === saved.id ? { ...saved, printoutPath } : t)));
    setEditor(null);
  };
  const handleDeleteTest = async (t) => {
    await db.deleteTest(t.id, t.printoutPath);
    setHistorySorted(testHistory.filter(x => x.id !== t.id));
    setEditor(null);
  };
  const handleAddPastTest = async (data, { photo } = {}) => {
    const test = { ...data, source: 'shop_import' };
    const id = await db.saveTest(user.id, poolProfile?.id, test, scoreOne(test));
    let printoutPath = null;
    if (photo) {
      // The result is saved. If only the photo fails, say so and keep the test.
      try { printoutPath = await db.savePrintout(user.id, id, photo); } catch (err) {
        console.error('Failed to save printout photo:', err);
        setSaveProblem({
          message: "Your past result is saved, but the photo didn't upload. Open it from the Chemistry log with Edit to add the photo again.",
          retry: null,
        });
      }
    }
    setHistorySorted([...testHistory, { ...test, id, printoutPath }]);
    setEditor(null);
  };

  const handleAddEvent = (event) => {
    db.addEvent(user.id, poolProfile?.id, event)
      .then(saved => setEvents(e => [...e, saved]))
      .catch(err => {
        console.error('Failed to add event:', err);
        setSaveProblem({
          message: "That event didn't save. Check your connection and try again.",
          retry: () => handleAddEvent(event),
        });
      });
  };
  // "I added it" on a plan step. The dose goes in the history with the test
  // and step it was for, the amount, what it drew from the shed and its cost
  // from the owner's own prices. Throws so the step can say it didn't save.
  const recordDose = async (step, option) => {
    const amount = optionAmount(option);
    const draw = shed.available ? drawForDose(stock, option.name, amount) : { draws: [], costAud: null };
    const event = {
      ...doseEventFor(step, option, poolProfile?.volumeL),
      testId: testData?.id ?? null,
      stepKey: step.key,
      product: option.name,
      grams: option.grams ?? null,
      millilitres: option.millilitres ?? null,
      costAud: draw.costAud,
      shedDraw: draw.draws,
    };
    const saved = await db.addEvent(user.id, poolProfile?.id, event);
    setEvents(e => [...e, saved]);
    // Older databases don't keep the test and step on the row: remember it here.
    if (!saved.stepKey && testKey) writeDoseIds(testKey, { ...readDoseIds(testKey), [step.key]: saved.id });
    // A step done from the shopping list comes off the list.
    const listed = skipped[step.key];
    if (listed) {
      db.deleteShopItem(listed.id)
        .then(() => setShop((sh) => ({ ...sh, items: sh.items.filter((i) => i.id !== listed.id) })))
        .catch((err) => console.error('Failed to clear shopping item:', err));
    }
    return saved.id;
  };
  const undoDose = async (record) => {
    await db.deleteEvent(record.id);
    setEvents(e => e.filter(x => x.id !== record.id));
    if (testKey) {
      const ids = readDoseIds(testKey);
      const k = Object.keys(ids).find((key) => ids[key] === record.id);
      if (k) { delete ids[k]; writeDoseIds(testKey, ids); }
    }
  };
  // "I haven't bought it yet": the step goes on the shopping list for this test.
  const skipStep = async (step, option) => {
    const need = optionAmount(option);
    const key = productKeyForDose(option.name);
    const row = planShortfall({ plan: { steps: [{ ...step, options: [option] }] }, stock }).find(() => true);
    const item = await db.addShopItem(user.id, {
      product: option.name,
      productKey: key,
      quantity: row?.buy?.quantity ?? need,
      quantityLabel: row?.buy?.label ?? option.amount ?? '',
      form: option.grams > 0 ? 'mass' : option.millilitres > 0 ? 'volume' : 'other',
      source: 'skip',
      testId: testData?.id ?? null,
      stepKey: step.key,
      stepTitle: step.action,
    });
    setShop((sh) => ({ ...sh, items: [item, ...sh.items] }));
  };
  const removeShopItem = async (item) => {
    await db.deleteShopItem(item.id);
    setShop((sh) => ({ ...sh, items: sh.items.filter((i) => i.id !== item.id) }));
  };
  const addShopItem = async (fields) => {
    const item = await db.addShopItem(user.id, fields);
    setShop((sh) => ({ ...sh, items: [item, ...sh.items] }));
  };
  const toggleShopItem = async (item, bought) => {
    const saved = await db.setShopItemBought(item.id, bought);
    setShop((sh) => ({ ...sh, items: sh.items.map((i) => (i.id === saved.id ? saved : i)) }));
  };
  const addShedItems = async (items) => {
    const saved = await db.addShedItems(user.id, items);
    setShed((sh) => ({ ...sh, items: [...sh.items, ...saved] }));
  };
  const deleteShedItem = (id) => {
    const prev = shed.items;
    setShed((sh) => ({ ...sh, items: sh.items.filter((i) => i.id !== id) }));
    db.deleteShedItem(id).catch((err) => {
      console.error('Failed to delete shed item:', err);
      setShed((sh) => ({ ...sh, items: prev }));
    });
  };
  const handleTogglePin = (view, label) => {
    const result = togglePin(pins, view);
    const name = label || view;
    setPinNotice(result.notice
      || (result.pins.includes(view) ? `Pinned ${name} to Home.` : `Removed ${name} from Home.`));
    if (result.pins === pins) return;
    setPins(result.pins);
    try { localStorage.setItem('ypm.pins.v1', JSON.stringify(result.pins)); } catch { /* private mode */ }
    db.saveAppPrefs(user.id, { pins: result.pins, nav: navSlots }).catch(() => { /* kept on this device */ });
  };
  const handleSaveNav = (next) => {
    const clean = cleanNav(next);
    setNavSlots(clean);
    try { localStorage.setItem('ypm.nav.v1', JSON.stringify(clean)); } catch { /* private mode */ }
    db.saveAppPrefs(user.id, { pins, nav: clean }).catch(() => { /* kept on this device */ });
  };
  const openView = (view) => {
    setActiveView(view);
    setMobileDrawerOpen(false);
    window.scrollTo?.({ top: 0 });
  };
  // "Done" on an equipment care job: save it as an event, so it is in the history and the record.
  const handleCareDone = async (task) => {
    const saved = await db.addEvent(user.id, poolProfile?.id, careEventFor(task));
    setEvents(e => [...e, saved]);
  };
  // "Add to my history" on a problem fixer guide.
  const handleAddFixerNote = async (event) => {
    const saved = await db.addEvent(user.id, poolProfile?.id, event);
    setEvents(e => [...e, saved]);
  };
  const handleDeleteEvent = (id) => {
    setEvents(e => e.filter(x => x.id !== id));
    db.deleteEvent(id).catch(err => console.error('Failed to delete event:', err));
  };

  const membershipCopy = offerCopy(pricing);

  // ── Auth / trial gates ──────────────────────────────────────
  if (loading) return <LoadingScreen />;
  // Password recovery: the reset link creates a session, so gate on recoveryMode
  // BEFORE the session check to show the "set a new password" screen.
  if (recoveryMode) return <AuthScreen />;
  if (!session) return <AuthScreen />;
  if (trialExpired && !isPremium) {
    return <TrialExpiredScreen pricing={pricing} checkoutReturn={checkoutReturn} />;
  }
  // Signed in, trial fine, data still arriving: draw the app's own layout in
  // grey (skeleton) instead of a spinner. Same early return as before, so
  // analyticsScreen() still sees "no screen yet" for this stage.
  if (!dataReady) return <AppSkeleton />;

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
            Test Water
          </button>
        </div>
      </nav>

      {/* Body */}
      <div className="app-body">
        <Sidebar
          activeView={activeView}
          onNav={setActiveView}
          pendingActions={pendingActions}
          shopCount={shopCount}
          onHelp={() => setShowHelp(true)}
          onFeedback={openFeedback}
          feedbackNoteCount={feedbackNoteCount}
        />

        <main className="main-content">
          {activeView === 'health' && (
            <HealthScorePage
              testData={testData}
              poolProfile={poolProfile}
              onLogFirst={goLogTest}
              onLogTest={goLogTest}
              events={events}
              user={user}
              plan={dosePlan}
              next={next}
              doneCount={doneCount}
              done={done}
              skipped={skipped}
              shopCount={Object.keys(skipped).length}
              onAdded={recordDose}
              onOpen={openView}
              ctx={ctx}
              tests={testHistory.map((t) => ({ ...t, healthScore: scoreFor(t, poolProfile?.sanitiser, saltRange, poolProfile?.surface, poolProfile?.hasCover) }))}
              low={low}
              pins={pins}
              badges={{ shop: shopCount, plan: pendingActions }}
              careDue={careDueNow(equipment, poolProfile, events)}
              onOpenCare={() => setActiveView('equipment')}
              onOpenFixer={() => setActiveView('fixer')}
              reminderOffer={<ReminderOffer prefs={reminderPrefs} testCount={testHistory.length} lastTestAt={testData?.createdAt} onSave={handleSaveReminders} />}
            />
          )}
          {activeView === 'tests' && (
            <WaterTestsPage
              testData={testData}
              onLogTest={handleLogTest}
              onScanTest={() => { setScanMode('printout'); setShowScan(true); }}
              onScanStrip={() => { setScanMode('strip'); setShowScan(true); }}
              onSpeakTest={() => setShowVoice(true)}
              poolProfile={poolProfile}
              saltRange={saltRange}
              autoOpenForm={openTestForm}
              onAutoOpened={() => setOpenTestForm(false)}
              stepsLeft={pendingActions}
              onOpenPlan={() => openView('plan')}
              rows={dosePlan?.rows ?? []}
            />
          )}
          {activeView === 'plan' && (
            <PlanPage
              test={testData}
              plan={dosePlan}
              ctx={ctx}
              done={done}
              skipped={skipped}
              stock={stock}
              shopAvailable={shop.available}
              onAdded={recordDose}
              onUndo={undoDose}
              onSkip={skipStep}
              onUnskip={removeShopItem}
              onOpen={openView}
              onLogTest={goLogTest}
              onOpenFixer={() => openView('fixer')}
              retest={retestPrompt(events, testData?.createdAt)}
            />
          )}
          {activeView === 'shed' && (
            <ShedPage
              available={shed.available}
              stock={stock}
              low={low}
              onAdd={addShedItems}
              onDelete={deleteShedItem}
              onOpen={openView}
            />
          )}
          {activeView === 'shop' && (
            <ShopPage
              available={shop.available}
              list={shop.items}
              suggestions={shopSuggestions}
              low={low}
              shedItems={shed.items}
              shedAvailable={shed.available}
              onAdd={addShopItem}
              onToggle={toggleShopItem}
              onDelete={removeShopItem}
              onAddShed={addShedItems}
            />
          )}
          {activeView === 'costs' && (
            <CostsPage
              events={events}
              hasTests={testHistory.length > 0}
              hasPrices={shed.items.some(hasPrice)}
              onOpen={openView}
              onLogTest={goLogTest}
            />
          )}
          {activeView === 'history' && (
            <ChemistryLogPage
              history={testHistory}
              events={events}
              equipment={equipment}
              poolProfile={poolProfile}
              saltRange={saltRange}
              onAddEvent={handleAddEvent}
              onDeleteEvent={handleDeleteEvent}
              onEditTest={(test) => setEditor({ mode: 'edit', test })}
              onAddPastTest={() => setEditor({ mode: 'add' })}
              onViewPrintout={setPhotoViewer}
              owner={memberDetails}
              getPhotoUrl={db.printoutUrl}
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
              autoOpenAdd={openEquipmentForm}
              onAutoOpened={() => setOpenEquipmentForm(false)}
              careItems={careList(equipment, poolProfile, events)}
              onCareDone={handleCareDone}
            />
          )}
          {activeView === 'fixer' && (
            <ProblemFixer onTestWater={goLogTest} onNote={handleAddFixerNote} />
          )}
          {activeView === 'chat' && (
            <AskMate
              userId={user.id}
              getContext={() => chatContext({ poolProfile, testData, plan: dosePlan })}
              onOpenPlan={() => openView('plan')}
            />
          )}
          {activeView === 'schedule' && (
            <SeasonalTipsPage season={getAUSeason()} />
          )}
          {activeView === 'profile' && (
            <div>
              <h1 className="page-title">Profile</h1>
              <p className="page-subtitle">Account settings and preferences</p>
              <div className="card-section feedback-card">
                <div className="eyebrow" style={{ marginBottom: 12 }}>Feedback</div>
                <div style={{ fontSize: 17, color: 'var(--gray-dark)', marginBottom: 12 }}>
                  Something confusing, missing or not working? Tell us. You can jot notes as you
                  move around the app and send them together.
                </div>
                <button className="btn btn-primary" onClick={openFeedback}>
                  {feedbackNoteCount > 0 ? `Review ${feedbackNoteCount} note${feedbackNoteCount === 1 ? '' : 's'} and send` : 'Give feedback'}
                </button>
              </div>
              <div className="card-section">
                <div className="eyebrow" style={{ marginBottom: 12 }}>Account</div>
                <div style={{ fontSize: 17, color: 'var(--gray-dark)', marginBottom: 16 }}>
                  Signed in as <strong>{user?.email || 'guest'}</strong>
                </div>
                <div className="eyebrow" style={{ marginBottom: 12 }}>Membership</div>
                {isPremium ? (
                  <div className="callout callout-info">
                    <span className="callout-icon" style={{ color: 'var(--green)', display: 'inline-flex' }}>
                      {Icon.check}
                    </span>
                    <div className="callout-body">
                      {plan === 'annual'
                        ? <>You're a <strong>member</strong> on the annual plan. Thanks for backing Your Pool Mate.</>
                        : <>You're a <strong>founding member</strong> — lifetime access, all future features included.</>}
                    </div>
                  </div>
                ) : (
                  <div className="callout callout-info">
                    <span className="callout-icon" style={{ color: 'var(--blue)', display: 'inline-flex' }}>
                      {Icon.info}
                    </span>
                    <div className="callout-body">
                      You're on a <strong>30-day free trial</strong> with {trialDaysLeft ?? '—'} days remaining.
                      {' '}
                      {membershipCopy.known
                        ? membershipCopy.profileDetail
                        : "First 300 members get founding access for $79 AUD lifetime; after that it's $49/year AUD."}
                    </div>
                  </div>
                )}
                {checkoutReturn && (
                  <div style={{ marginTop: 12 }}>
                    <CheckoutReturnNote status={checkoutReturn} />
                  </div>
                )}
                <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {!isPremium && (
                    <CheckoutButton
                      label={membershipCopy.profileLabel}
                      className="btn btn-primary btn-sm"
                    />
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <MemberProfileForm
                  initial={memberDetails}
                  onSave={handleSaveMember}
                />
              </div>
              <ReminderSettings prefs={reminderPrefs} onSave={handleSaveReminders} />
              <AccountData
                email={user?.email}
                isPremium={isPremium}
                plan={plan}
                loadMyData={() => db.loadMyData(user.id)}
                deleteAccount={db.deleteMyAccount}
              />
            </div>
          )}
        </main>
      </div>

      {/* Scan modal — real OCR via the ocr-water-test Edge Function */}
      {/* Help sheet */}
      {showHelp && (
        <HelpSheet
          onClose={() => setShowHelp(false)}
          onReplayTour={() => {
            setShowHelp(false);
            setMobileDrawerOpen(false);
            setActiveView('health');
            setTourActive(true);
          }}
        />
      )}

      {showScan && (
        <WaterTestScanner
          onClose={() => setShowScan(false)}
          onComplete={handleScanComplete}
          poolVolumeL={hasVolume(poolProfile) ? poolProfile.volumeL : null}
          history={testHistory}
          mode={scanMode}
        />
      )}

      {showVoice && (
        <VoiceTestEntry
          onClose={() => setShowVoice(false)}
          onComplete={handleVoiceComplete}
        />
      )}

      {/* Volume gate — a test can't be saved without a pool volume (doses need it) */}
      {pendingTest && (
        <VolumeGateModal
          onCancel={() => setPendingTest(null)}
          onConfirm={handleVolumeConfirmed}
          suggestedL={suggestedVolumeL}
        />
      )}

      {/* Mobile bottom nav */}
      <MobileNav
        activeView={activeView}
        onNav={(view) => { setActiveView(view); setMobileDrawerOpen(false); }}
        pendingActions={pendingActions}
        onMore={() => { setPinNotice(null); setMobileDrawerOpen(v => !v); }}
        onLogTest={goLogTest}
        nav={navSlots}
      />

      {/* Mobile More drawer */}
      {mobileDrawerOpen && (
        <MobileMoreDrawer
          activeView={activeView}
          onNav={setActiveView}
          onClose={() => { setPinNotice(null); setMobileDrawerOpen(false); }}
          onHelp={() => setShowHelp(true)}
          onFeedback={openFeedback}
          feedbackNoteCount={feedbackNoteCount}
          pins={pins}
          onTogglePin={handleTogglePin}
          pinNotice={pinNotice}
          shopCount={shopCount}
          nav={navSlots}
          onEditNav={() => setNavEditorOpen(true)}
        />
      )}
      {navEditorOpen && (
        <NavEditor nav={navSlots} onSave={handleSaveNav} onClose={() => setNavEditorOpen(false)} />
      )}

      {/* Guest onboarding — auto-shows for signed-in users with no pool profile.
          Dismissible for this session: hasPoolProfile is also set false when the
          profile lookup errors (see AuthContext), so a network blip must not
          leave the user locked behind an unclosable sheet. It re-appears on the
          next app launch until a pool profile exists. */}
      {hasPoolProfile === false && !onboardingDismissed && (
        <GuestOnboarding
          onComplete={() => {
            loadAll(user.id);
            // Straight into the walkthrough — unless they've already had it.
            let seen = false;
            try { seen = localStorage.getItem(tourSeenKey) === '1'; } catch { /* private mode */ }
            if (!seen) {
              setActiveView('health');
              setTourActive(true);
            }
          }}
          onDismiss={() => setOnboardingDismissed(true)}
        />
      )}

      {/* Post-onboarding walkthrough — anchored popups over the real nav.
          Finishes on Equipment and hands off into the add-equipment form. */}
      {tourActive && (
        <AppTour
          onNavigate={handleTourNavigate}
          onFinish={() => endTour({ addEquipment: true })}
          onDismiss={() => endTour()}
        />
      )}

      {/* Save problem — a record that didn't reach the database */}
      {saveProblem && (
        <div className="save-problem" role="alert">
          <span className="save-problem-text">{saveProblem.message}</span>
          <div className="save-problem-actions">
            {saveProblem.retry && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { const retry = saveProblem.retry; setSaveProblem(null); retry(); }}
              >
                Try again
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setSaveProblem(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {editor && (
        <TestEditor
          mode={editor.mode}
          test={editor.test}
          saltPool={isSaltPool(poolProfile?.sanitiser)}
          saltRange={saltRange}
          auditTracked={testHistory.length === 0 || testHistory.some(t => t.auditTracked)}
          onSave={editor.mode === 'edit' ? handleUpdateTest : handleAddPastTest}
          onDelete={handleDeleteTest}
          getPhotoUrl={db.printoutUrl}
          onCancel={() => setEditor(null)}
        />
      )}
      {photoViewer && (
        <PrintoutViewer path={photoViewer} getUrl={db.printoutUrl} onClose={() => setPhotoViewer(null)} />
      )}

      {/* Feedback panel. Opened from the desktop sidebar and the mobile More menu. */}
      <FeedbackOverlay
        activeView={activeView}
        openToken={feedbackOpenToken}
        onNoteCount={handleFeedbackNoteCount}
      />
    </div>
  );
}
