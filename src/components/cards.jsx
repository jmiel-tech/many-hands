import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { useAction } from '../lib/errors.js';
import { issueHealth } from '../lib/health.js';
import { takeTask } from '../lib/api.js';
import { ErrorNote, HealthBadge, ISSUE_STATUS, LockNote, StatusBadge, firstName } from './ui.jsx';

const BAR_COLOR = { Covered: 'var(--covered-fg)', Thin: '#C98A1B', 'At risk': 'var(--risk-fg)', Orphaned: 'var(--orphan-fg)' };

export function TakeButton({ taskId }) {
  const { user } = useAuth();
  const { busy, error, run } = useAction();
  return (
    <>
      <button type="button" className="pill pill-sm take" disabled={busy} onClick={() => run(() => takeTask(taskId, user.uid))}>
        {busy ? 'Taking…' : 'Take this task'}
      </button>
      <ErrorNote>{error}</ErrorNote>
    </>
  );
}

export const taskPath = (task) => `/issues/${task.issueId}/tasks/${task.id}`;

// Unclaimed task card, as used on Home and at the top of the board.
export function OpenTaskCard({ task, issueTitle, large }) {
  return (
    <article className={`card task-card${large ? ' task-card-lg' : ''}`}>
      {issueTitle && <span className="muted-sm">{issueTitle}</span>}
      <h3><Link to={taskPath(task)} className="stretched">{task.title}</Link></h3>
      {task.description && <p className="clamp muted">{task.description}</p>}
      <div className="task-card-foot">
        <StatusBadge status={task.status} />
        <span className="muted-sm">No one yet</span>
        <TakeButton taskId={task.id} />
      </div>
    </article>
  );
}

// Task somebody holds: who holds it, and who can change it.
export function HeldTaskCard({ task }) {
  const { user } = useAuth();
  const { nameOf } = useData();
  const mine = task.assigneeId === user.uid;
  const name = nameOf(task.assigneeId);
  return (
    <article className={`card task-card${mine ? ' is-mine' : ''}`}>
      <div className="row-between">
        <h3><Link to={taskPath(task)} className="stretched">{task.title}</Link></h3>
        {mine ? <span className="badge tone-accent">Yours</span> : <StatusBadge status={task.status} />}
      </div>
      {mine ? (
        <>
          <span className="muted">{TASK_LABEL[task.status]}</span>
          <span className="accent-text">Open, edit or comment ›</span>
        </>
      ) : (
        <>
          <span className="muted">{name}</span>
          <LockNote>Only {firstName(name)} can edit this.</LockNote>
        </>
      )}
    </article>
  );
}

const TASK_LABEL = { todo: 'To do', doing: 'Doing', done: 'Done' };

export function IssueCard({ issue, selected, tinted }) {
  const { user } = useAuth();
  const { tasksFor, nameOf } = useData();
  const health = issueHealth(tasksFor(issue.id));
  const owner = issue.ownerId === user.uid ? 'you' : nameOf(issue.ownerId);
  const percent = health.total ? (health.assigned / health.total) * 100 : 0;
  return (
    <Link
      to={`/issues/${issue.id}`}
      aria-current={selected ? 'true' : undefined}
      className={`card issue-card${tinted ? ' is-tinted' : ''}${selected ? ' is-selected' : ''}`}
    >
      <div className="row-between">
        <div className="stack-xs">
          <h3>{issue.title}</h3>
          <span className="muted">Owner: {owner} · {ISSUE_STATUS[issue.status]}</span>
        </div>
        <HealthBadge label={health.label} />
      </div>
      <div className="bar" aria-hidden="true">
        <div style={{ width: `${percent}%`, background: BAR_COLOR[health.label] }} />
      </div>
      <span className="muted">{health.assigned} of {health.total} {health.total === 1 ? 'task has' : 'tasks have'} someone</span>
    </Link>
  );
}

export function MyTaskCard({ task }) {
  const { issues } = useData();
  const issue = issues.find((i) => i.id === task.issueId);
  return (
    <Link to={taskPath(task)} className="card my-task">
      <div className="row-between">
        <h3>{task.title}</h3>
        <StatusBadge status={task.status} />
      </div>
      <span className="muted">{issue?.title || 'Issue removed'}</span>
    </Link>
  );
}
