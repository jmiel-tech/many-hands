import { useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { useAction } from '../lib/errors.js';
import { groupTasks, healthSentence, issueHealth } from '../lib/health.js';
import { deleteIssue } from '../lib/api.js';
import { TopBar } from '../components/Layout.jsx';
import { HeldTaskCard, OpenTaskCard } from '../components/cards.jsx';
import { Avatar, ConfirmRow, ErrorNote, HealthBadge, Icons, LockNote, StatusBadge, firstName } from '../components/ui.jsx';

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

function HealthRing({ assigned, total }) {
  const circumference = 2 * Math.PI * 88;
  const dash = total ? (assigned / total) * circumference : 0;
  const text = `${assigned} of ${total} ${total === 1 ? 'task has' : 'tasks have'} someone`;
  return (
    <div className="ring" role="img" aria-label={text}>
      <svg width="100%" height="100%" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="88" fill="none" stroke="#3a3a3c" strokeWidth="10" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="#7FD8B8" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${circumference}`} transform="rotate(-90 100 100)" />
      </svg>
      <div className="ring-text">
        <span className="ring-number">{assigned}</span>
        <span>of {total} {total === 1 ? 'task has' : 'tasks have'} someone</span>
      </div>
    </div>
  );
}

function Group({ id, title, chip, tasks, empty, open }) {
  return (
    <div id={id} className="group">
      <div className="group-head">
        <h3>{title} <span className="group-count">{tasks.length}</span></h3>
        <HealthBadge label={chip} />
      </div>
      {tasks.length ? (
        tasks.map((task) => (open ? <OpenTaskCard key={task.id} task={task} /> : <HeldTaskCard key={task.id} task={task} />))
      ) : (
        <p className="group-empty">{empty}</p>
      )}
    </div>
  );
}

export default function IssueDetail() {
  const { issueId } = useParams();
  const { user } = useAuth();
  const { issues, tasksFor, nameOf } = useData();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const { busy, error, run } = useAction();

  const issue = issues.find((i) => i.id === issueId);
  if (!issue) {
    return (
      <section className="hero">
        <h1 className="display-sm">This issue is gone.</h1>
        <p className="lede">It may have been deleted by its owner.</p>
        <Link to="/issues" className="textlink">Back to issues<Icons.chevron /></Link>
      </section>
    );
  }

  const tasks = tasksFor(issue.id);
  const health = issueHealth(tasks);
  const groups = groupTasks(tasks);
  const isOwner = issue.ownerId === user.uid;
  const ownerName = nameOf(issue.ownerId);
  const started = groups.doing.length + groups.done.length;

  const askDelete = () => setConfirming(true);
  const doDelete = () => run(async () => {
    await deleteIssue(issue.id);
    navigate('/issues');
  });

  return (
    <div className="issue-detail">
      <TopBar>
        <Link to="/issues" className="topbar-back">‹ Issues</Link>
        <span className="topbar-title">{issue.title}</span>
      </TopBar>

      <section className="hero hero-issue enter">
        <h1 className="display-sm">{issue.title.replace(/[.!?]$/, '')}.</h1>
        {issue.description && <p className="lede preline">{issue.description}</p>}
        <div className="meta-row">
          <StatusBadge status={issue.status} />
          <Link to={isOwner ? '/me' : `/members/${issue.ownerId}`} className="owner-link">
            <Avatar id={issue.ownerId} name={ownerName} size={28} />
            Owner: {isOwner ? 'you' : ownerName}
          </Link>
          {!isOwner && <LockNote>Only {firstName(ownerName)} can edit this issue.</LockNote>}
        </div>
        <div className="hero-actions hero-actions-row">
          <Link to={`/issues/${issue.id}/tasks/new`} className="pill">Add a task</Link>
          {groups.unclaimed.length > 0 && (
            <button type="button" className="textlink" onClick={() => scrollTo('group-unclaimed')}>See what still needs someone<Icons.chevron /></button>
          )}
        </div>
        {isOwner && !confirming && (
          <div className="owner-actions">
            <Link to={`/issues/${issue.id}/edit`} className="textlink">Edit</Link>
            <button type="button" className="textlink danger" onClick={askDelete}>Delete</button>
          </div>
        )}
        {isOwner && confirming && tasks.length > 0 && (
          <div role="alert" className="blocked">
            <strong>This issue still has {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}.</strong>
            <span>Delete its tasks first. Only a task's assignee can delete it, so take any unclaimed ones or ask the people holding them.</span>
            <button type="button" className="pill pill-plain pill-sm" onClick={() => setConfirming(false)}>OK</button>
          </div>
        )}
        {isOwner && confirming && tasks.length === 0 && (
          <ConfirmRow question="Delete this issue for everyone?" busy={busy} onConfirm={doDelete} onCancel={() => setConfirming(false)} />
        )}
        <ErrorNote>{error}</ErrorNote>
      </section>

      <section aria-label="How this issue is doing" className="dark-band">
        <HealthRing assigned={health.assigned} total={health.total} />
        <div className="dark-copy">
          <HealthBadge label={health.label} />
          <p className="dark-sentence">{healthSentence(health)}</p>
          <div className="tiles">
            <button type="button" className="tile" onClick={() => scrollTo('group-doing')}><span className="tile-n">{started}</span><span>Covered</span></button>
            <button type="button" className="tile" onClick={() => scrollTo('group-todo')}><span className="tile-n">{groups.todo.length}</span><span>Thin</span></button>
            <button type="button" className="tile" onClick={() => scrollTo('group-unclaimed')}><span className="tile-n">{groups.unclaimed.length}</span><span>Unclaimed</span></button>
          </div>
        </div>
      </section>

      <section aria-label="Tasks by status" className="board">
        <div className="section-head">
          <h2 className="headline">Who's on what.</h2>
          <p className="sub">Take a task and it's yours. After that, only you can change it.</p>
        </div>
        <div className="board-grid">
          <Group id="group-unclaimed" title="Unclaimed" chip="Unclaimed" tasks={groups.unclaimed} open empty="Nothing here. Every task has someone." />
          <Group id="group-todo" title="To do" chip="Thin" tasks={groups.todo} empty="Nobody is waiting to start." />
          <Group id="group-doing" title="Doing" chip="Covered" tasks={groups.doing} empty="Nothing underway yet." />
          <Group id="group-done" title="Done" chip="Covered" tasks={groups.done} empty="Nothing finished yet." />
        </div>
      </section>

      <details className="legend">
        <summary className="textlink">How these labels work</summary>
        <div className="legend-grid">
          <div><HealthBadge label="Covered" /><span>Every task has someone. On the board, it marks tasks that are underway or done.</span></div>
          <div><HealthBadge label="Thin" /><span>Some tasks still need someone. On the board, it marks tasks someone holds but hasn't started.</span></div>
          <div><HealthBadge label="At risk" /><span>Most tasks still need someone.</span></div>
          <div><HealthBadge label="Orphaned" /><span>The issue has no tasks yet.</span></div>
        </div>
      </details>

      <Outlet />
    </div>
  );
}
