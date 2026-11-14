import { navOption } from '../../lib/navSlots.js';
import { Icon, NAV_ICONS } from '../icons.jsx';

// ─────────────────────────────────────────────────────────────────
// MOBILE BOTTOM NAV
// ─────────────────────────────────────────────────────────────────
export function MobileNav({ activeView, onNav, pendingActions, onMore, onLogTest, nav }) {
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
