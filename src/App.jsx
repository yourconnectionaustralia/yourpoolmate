import { useState, useEffect, useCallback, useRef } from 'react';
import FeedbackOverlay from './FeedbackOverlay.jsx';
import WaterTestScanner from './components/WaterTestScanner.jsx';
import VoiceTestEntry from './components/VoiceTestEntry.jsx';
import AuthScreen from './components/AuthScreen.jsx';
import GuestOnboarding from './components/GuestOnboarding.jsx';
import AppTour from './components/AppTour.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import AppSkeleton from './components/AppSkeleton.jsx';
import { useAuth } from './context/AuthContext.jsx';
import * as db from './lib/db.js';
import { memberFormFromRow } from './lib/memberProfile.js';
import MemberProfileForm from './components/MemberProfileForm.jsx';
import TestEditor, { PrintoutViewer } from './components/TestEditor.jsx';
import ImportShopCsv, { AddPastChoice } from './components/ImportShopCsv.jsx';
import { ReminderOffer, ReminderSettings } from './components/ReminderSettings.jsx';
import AccountData from './components/AccountData.jsx';
import ProblemFixer from './components/ProblemFixer.jsx';
import { careDueNow, careEventFor, careList } from './lib/equipmentCare.js';
import { prefsFromRow, wantsTestForm, withoutTestParam } from './lib/reminderPrefs.js';
import { calculateScore, isSaltPool, saltRangeForEquipment } from './lib/healthScore.js';
import { analyticsScreen, trackPageView } from './lib/analytics.js';
import { cleanNav } from './lib/navSlots.js';
import { chatContext } from './lib/chatContext.js';
import AskMate from './components/AskMate.jsx';
import NavEditor from './components/NavEditor.jsx';
import { doseEventFor, retestPrompt } from './lib/doseLog.js';
import { buildPlan, optionAmount, planContext } from './lib/plan.js';
import { drawForDose, hasPrice, lowStock, planShortfall, productKeyForDose, shedWithStock } from './lib/shed.js';
import PlanPage, { nextStep } from './components/PlanPage.jsx';
import { passedFor, readPassed, setPassed, writePassed } from './lib/passedSteps.js';
import ShedPage from './components/ShedPage.jsx';
import ShopPage from './components/ShopPage.jsx';
import CostsPage from './components/CostsPage.jsx';
import { cleanPins, togglePin } from './components/HomeCards.jsx';
import { supabase } from './lib/supabase.js';
import { fetchCheckoutPricing, offerCopy } from './lib/stripeCheckout.js';
import { CHECKOUT_RETURN_KEY, CheckoutButton, CheckoutReturnNote, captureCheckoutReturn } from './app/checkout/Checkout.jsx';
import { DEFAULT_POOL } from './app/data/poolOptions.js';
import { getAUSeason } from './app/data/season.js';
import { hasVolume, scoreFor } from './app/helpers.js';
import { Icon } from './app/icons.jsx';
import { MobileMoreDrawer } from './app/nav/MobileMoreDrawer.jsx';
import { MobileNav } from './app/nav/MobileNav.jsx';
import { Sidebar } from './app/nav/Sidebar.jsx';
import { HelpSheet } from './app/overlays/HelpSheet.jsx';
import { VolumeGateModal } from './app/overlays/VolumeGateModal.jsx';
import { ChemistryLogPage } from './app/pages/ChemistryLogPage.jsx';
import { EquipmentPage } from './app/pages/EquipmentPage.jsx';
import { HealthScorePage } from './app/pages/HealthScorePage.jsx';
import { SeasonalTipsPage } from './app/pages/SeasonalTipsPage.jsx';
import { SetupPage } from './app/pages/SetupPage.jsx';
import { WaterTestsPage, readDoseIds, writeDoseIds } from './app/pages/WaterTestsPage.jsx';
import { TrialExpiredScreen } from './app/screens/TrialExpiredScreen.jsx';
import { LogoMark } from './app/visuals.jsx';

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
  const [pastChoice, setPastChoice] = useState(false); // "Add past results": type one in, or import a pool shop CSV
  const [importOpen, setImportOpen] = useState(false); // the pool shop CSV import screen
  const [openTestForm, setOpenTestForm] = useState(false); // one-shot: open the log form on the Tests page
  const [openEquipmentForm, setOpenEquipmentForm] = useState(false); // one-shot: open the add-equipment form
  const [tourActive, setTourActive] = useState(false); // post-onboarding walkthrough
  // My Shed and the shopping list (migration 021). `available` is false until
  // the database has the tables; those screens then say so and nothing breaks.
  const [shed, setShed] = useState({ available: false, items: [] });
  const [shop, setShop] = useState({ available: false, items: [] });
  // Plan steps the owner chose to skip, per test, kept on this device.
  const [passedMap, setPassedMap] = useState(() => { try { return readPassed(localStorage); } catch { return {}; } });
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
  // Steps the owner chose to skip for this test.
  const passed = passedFor(passedMap, testKey);
  const next = dosePlan ? nextStep(dosePlan, done, skipped, passed) : null;
  const doneCount = dosePlan ? dosePlan.steps.filter((st) => done[st.key]).length : 0;
  // Steps still to do — shown on the Plan tab badge. A skipped step is not "to do".
  const pendingActions = dosePlan ? dosePlan.steps.filter((st) => !done[st.key] && !passed[st.key]).length : 0;
  const shopCount = shop.items.filter((i) => i.status !== 'bought').length;
  const low = shed.available ? lowStock(stock, doseEvents) : [];
  const shopSuggestions = dosePlan && shop.available
    ? planShortfall({ plan: dosePlan, stock, doneKeys: new Set([...Object.keys(done), ...Object.keys(skipped), ...Object.keys(passed)]), testId: testData?.id ?? null }).filter((r) => !r.covered)
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
    // The editor does not carry how the pool looked, but it still counts towards
    // the score, so a green test keeps its cap when a reading is fixed.
    const poolLook = testHistory.find((t) => t.id === data.id)?.poolLook;
    const saved = await db.updateTest(data.id, data, scoreOne(poolLook ? { ...data, poolLook } : data));
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
  // Pool shop CSV import: the checked tests are saved in batches, each scored
  // like any other test. Whatever did save is shown even if a later batch fails
  // (the error carries it), so a second try adds only the rest.
  const handleImportTests = async (tests) => {
    const asRow = (s) => ({ ...s.test, id: s.id, printoutPath: null });
    try {
      const saved = await db.saveTestsBulk(user.id, poolProfile?.id, tests, scoreOne);
      setHistorySorted([...testHistory, ...saved.map(asRow)]);
      return saved.length;
    } catch (err) {
      if (err?.saved?.length) setHistorySorted([...testHistory, ...err.saved.map(asRow)]);
      throw err;
    }
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
  // "Skip this step": leave it alone for now. It is not a dose, so nothing goes
  // in the history. A step that was on the shopping list comes off it.
  const passStep = async (step) => {
    const listed = skipped[step.key];
    if (listed) await removeShopItem(listed);
    setPassedMap((m) => {
      const next = setPassed(m, testKey, step.key, true);
      writePassed(localStorage, next);
      return next;
    });
  };
  const unpassStep = (step) => {
    setPassedMap((m) => {
      const next = setPassed(m, testKey, step.key, false);
      writePassed(localStorage, next);
      return next;
    });
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
              passed={passed}
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
              passed={passed}
              stock={stock}
              shopAvailable={shop.available}
              onAdded={recordDose}
              onUndo={undoDose}
              onSkip={skipStep}
              onUnskip={removeShopItem}
              onPass={passStep}
              onUnpass={unpassStep}
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
              onAddPastTest={() => setPastChoice(true)}
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
      {pastChoice && (
        <AddPastChoice
          onType={() => { setPastChoice(false); setEditor({ mode: 'add' }); }}
          onImport={() => { setPastChoice(false); setImportOpen(true); }}
          onCancel={() => setPastChoice(false)}
        />
      )}
      {importOpen && (
        <ImportShopCsv
          existingTests={testHistory}
          onImport={handleImportTests}
          onClose={() => setImportOpen(false)}
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
