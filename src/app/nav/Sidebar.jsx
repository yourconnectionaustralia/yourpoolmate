import { SEASONAL_TIPS_LABEL } from '../data/season.js';
import { Icon } from '../icons.jsx';

// ─────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────
export function Sidebar({ activeView, onNav, pendingActions, shopCount = 0, onHelp, onFeedback, feedbackNoteCount = 0 }) {
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
