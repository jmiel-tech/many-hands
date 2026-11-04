import { Link, Outlet, useMatch } from 'react-router-dom';
import { COMMUNITY_NAME } from '../firebase.config.js';
import { useData } from '../lib/data.jsx';
import { TopBar } from '../components/Layout.jsx';
import { IssueCard } from '../components/cards.jsx';

// Master-detail from 900px up. Under 900px, the list and the detail are separate full pages.
export default function IssuesPage() {
  const { issues } = useData();
  const match = useMatch('/issues/:issueId/*');
  const selectedId = match?.params.issueId;
  const hasDetail = selectedId && selectedId !== 'new';

  return (
    <div className={`md${hasDetail ? ' md-has-detail' : ''}`}>
      <div className="md-list">
        <TopBar>Issues</TopBar>
        <section className="hero hero-list enter">
          <p className="eyebrow">{COMMUNITY_NAME}</p>
          <h1 className="display">Issues.</h1>
          <p className="lede">Everything the group is working on right now.</p>
          <div className="hero-actions">
            <Link to="/issues/new" className="pill">New issue</Link>
          </div>
        </section>
        <div className="md-cards">
          {issues.length ? (
            issues.map((issue) => <IssueCard key={issue.id} issue={issue} selected={issue.id === selectedId} />)
          ) : (
            <p className="empty">No issues yet. Start the first one.</p>
          )}
        </div>
      </div>
      <div className="md-detail">
        {!hasDetail && <p className="md-empty">Select an issue to see who's on what.</p>}
        <Outlet />
      </div>
    </div>
  );
}
