import { useState } from 'react';
import { Link, Outlet, useMatch } from 'react-router-dom';
import { COMMUNITY_NAME } from '../firebase.config.js';
import { useData } from '../lib/data.jsx';
import { ISSUE_VIEWS, filterIssues } from '../lib/filter.js';
import { TopBar } from '../components/Layout.jsx';
import { IssueCard } from '../components/cards.jsx';
import { Segmented } from '../components/ui.jsx';

// Master-detail from 900px up. Under 900px, the list and the detail are separate full pages.
export default function IssuesPage() {
  const { issues } = useData();
  const match = useMatch('/issues/:issueId/*');
  const selectedId = match?.params.issueId;
  const hasDetail = selectedId && selectedId !== 'new';

  // Resolved issues are hidden by default so the list shows what still needs work.
  const [view, setView] = useState('active');
  const [search, setSearch] = useState('');
  const shown = filterIssues(issues, { view, search });
  const filtering = view !== 'all' || search.trim();

  const emptyText = () => {
    if (!issues.length) return 'No issues yet. Start the first one.';
    if (search.trim()) return `No ${view === 'all' ? '' : `${ISSUE_VIEWS[view].toLowerCase()} `}issues match "${search.trim()}".`;
    if (view === 'resolved') return 'Nothing has been resolved yet.';
    return 'No active issues. Everything is resolved.';
  };

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
        {issues.length > 0 && (
          <div className="list-tools" role="search">
            <label className="sr-only" htmlFor="issue-search">Search issues</label>
            <input
              id="issue-search"
              type="search"
              className="field"
              placeholder="Search issues"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Segmented label="Show" name="issue-view" options={ISSUE_VIEWS} value={view} onChange={setView} />
            <p className="muted-sm" aria-live="polite">
              {filtering ? `Showing ${shown.length} of ${issues.length}` : `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}`}
            </p>
          </div>
        )}
        <div className="md-cards">
          {shown.length ? (
            shown.map((issue) => <IssueCard key={issue.id} issue={issue} selected={issue.id === selectedId} />)
          ) : (
            <p className="empty">
              {emptyText()}
              {filtering && issues.length > 0 && (
                <> <button type="button" className="textlink" onClick={() => { setSearch(''); setView('all'); }}>Show all issues</button></>
              )}
            </p>
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
