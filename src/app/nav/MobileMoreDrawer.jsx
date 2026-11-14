import { useEffect, useRef } from 'react';
import { SHORTCUTS } from '../../components/HomeCards.jsx';
import { SEASONAL_TIPS_LABEL } from '../data/season.js';
import { Icon } from '../icons.jsx';

// ─────────────────────────────────────────────────────────────────
// MOBILE MORE DRAWER (slide-up sheet)
// ─────────────────────────────────────────────────────────────────
export function MobileMoreDrawer({ activeView, onNav, onClose, onHelp, onFeedback, feedbackNoteCount = 0, pins = [], onTogglePin, pinNotice, shopCount = 0, nav = [], onEditNav }) {
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
