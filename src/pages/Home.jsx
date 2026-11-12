import { Link } from 'react-router-dom';
import { COMMUNITY_NAME } from '../firebase.config.js';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { TopBar } from '../components/Layout.jsx';
import { IssueCard, MyTaskCard, OpenTaskCard } from '../components/cards.jsx';
import { HealthBadge, Icons, firstName } from '../components/ui.jsx';
import { bySoonestDue, isOverdue } from '../lib/dates.js';

function timeOfDay(date) {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export default function Home() {
  const { user, member } = useAuth();
  const { issues, tasks } = useData();
  const now = new Date();
  const part = timeOfDay(now);
  const weekday = now.toLocaleDateString([], { weekday: 'long' });

  const active = issues.filter((i) => i.status !== 'resolved').sort(bySoonestDue);
  const issueTitle = (id) => issues.find((i) => i.id === id)?.title;
  // Skips tasks left behind by a deleted issue, since nobody can open those.
  const open = tasks.filter((t) => t.status === 'todo' && !t.assigneeId && issueTitle(t.issueId)).sort(bySoonestDue);
  // What you're holding and haven't finished. Done tasks stay on the Me page.
  const mine = tasks.filter((t) => t.assigneeId === user.uid && t.status !== 'done' && issueTitle(t.issueId)).sort(bySoonestDue);
  const overdue = mine.filter((t) => isOverdue(t)).length;

  const scrollToOpen = () => document.getElementById('h-open')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      <TopBar>{COMMUNITY_NAME}</TopBar>
      <section className="hero enter">
        <p className="eyebrow">{weekday} {part}</p>
        <h1 className="display">Good {part}, {firstName(member.name)}.</h1>
        <p className="lede">
          {open.length ? "Glad you're here. A few tasks are still looking for someone." : "Glad you're here. Every open task has someone right now."}
        </p>
        <div className="hero-actions">
          <button type="button" className="pill" onClick={scrollToOpen}>See open tasks</button>
          <Link to="/issues" className="textlink">All issues<Icons.chevron /></Link>
        </div>
      </section>

      {mine.length > 0 && (
        <section aria-labelledby="h-mine" className="band band-tight">
          <div className="band-inner">
            <div className="section-head">
              <h2 id="h-mine" className="headline">Your tasks.</h2>
              <p className="sub">
                {mine.length} on your plate{overdue > 0 && `, ${overdue} overdue`}. Soonest due first.
              </p>
            </div>
            <div className="grid grid-issues">
              {mine.map((task) => <MyTaskCard key={task.id} task={task} />)}
            </div>
            <p className="center-text more-link"><Link to="/me" className="textlink">Everything you're on, including finished tasks<Icons.chevron /></Link></p>
          </div>
        </section>
      )}

      <section aria-labelledby="h-open" className="band band-alt">
        <div className="band-inner">
          <div className="section-head">
            <HealthBadge label="Unclaimed" />
            <h2 id="h-open" className="headline">Tasks that need someone.</h2>
            <p className="sub">Take one and it's assigned to you.</p>
          </div>
          {open.length ? (
            <div className="grid grid-tasks">
              {open.map((task) => <OpenTaskCard key={task.id} task={task} issueTitle={issueTitle(task.issueId)} large />)}
            </div>
          ) : (
            <p className="empty">Nothing is waiting for someone right now.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="h-issues" className="band">
        <div className="band-inner">
          <div className="section-head">
            <h2 id="h-issues" className="headline">What we're working on.</h2>
            <p className="sub">{active.length} active {active.length === 1 ? 'issue' : 'issues'}</p>
          </div>
          {active.length ? (
            <div className="grid grid-issues">
              {active.map((issue) => <IssueCard key={issue.id} issue={issue} tinted />)}
            </div>
          ) : (
            <p className="empty">No active issues. <Link to="/issues/new">Start one</Link>.</p>
          )}
        </div>
      </section>
    </>
  );
}
