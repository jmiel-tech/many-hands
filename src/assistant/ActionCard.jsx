import { Link } from 'react-router-dom';
import { taskPath } from './tools.js';
import { Ban, Check, Chevron } from './icons.jsx';

// One proposed change: Confirm / Cancel first, then a "Done" note with Undo, or the reason it can't be done.
export default function ActionCard({ action, online, onConfirm, onCancel, onUndo, onAlternative, onOpenTask }) {
  const { status } = action;
  const openTask = action.taskId && (
    <Link className="textlink small" to={taskPath({ id: action.taskId, issueId: action.issueId })} onClick={onOpenTask}>
      Open task<Chevron />
    </Link>
  );

  if (status === 'refused') {
    return (
      <div className="action-card action-refused" role="group" aria-label="Can't do that">
        <p className="action-head"><Ban /><strong>I can't do that.</strong></p>
        <p className="action-detail">{action.reason}</p>
        {action.alternative && (
          <button type="button" className="textlink small" onClick={() => onAlternative(action.alternative)}>
            {action.alternative.label}<Chevron />
          </button>
        )}
      </div>
    );
  }

  if (status === 'pending' || status === 'working') {
    const working = status === 'working';
    return (
      <div className="action-card action-confirm" role="group" aria-label="Confirm this change">
        <p className="action-head"><strong>{action.summary}</strong></p>
        <p className="action-detail preline">{action.detail}</p>
        <div className="action-buttons">
          <button type="button" className="pill pill-sm" onClick={onConfirm} disabled={working || !online}>
            {working ? 'Working…' : 'Confirm'}
          </button>
          <button type="button" className="textlink small" onClick={onCancel} disabled={working}>Cancel</button>
        </div>
        {!online && <p className="action-detail">You're offline. Confirm works again once you're back online.</p>}
      </div>
    );
  }

  if (status === 'done' || status === 'undoing') {
    return (
      <div className="action-card action-done" role="status">
        <p className="action-head"><Check /><strong>Done.</strong> {action.done}</p>
        <div className="action-buttons">
          <button type="button" className="textlink small" onClick={onUndo} disabled={status === 'undoing' || !online}>
            {status === 'undoing' ? 'Undoing…' : 'Undo'}
          </button>
          {openTask}
        </div>
        {action.error && <p className="action-error" role="alert">{action.error}</p>}
      </div>
    );
  }

  if (status === 'undone') {
    return (
      <div className="action-card action-muted" role="status">
        <p className="action-head"><strong>Undone.</strong> It's back the way it was.</p>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="action-card action-muted">
        <p className="action-head">Cancelled. Nothing changed.</p>
      </div>
    );
  }

  // failed
  return (
    <div className="action-card action-failed" role="alert">
      <p className="action-head"><Ban /><strong>That didn't go through.</strong></p>
      <p className="action-detail">{action.error}</p>
      {openTask}
    </div>
  );
}
