import { bySoonestDue } from './dates.js';

// Issue list filtering: a status view plus a text search over title and description.
export const ISSUE_VIEWS = { active: 'Active', resolved: 'Resolved', all: 'All' };

// Issue list sorting. 'newest' matches the order the list has always used.
export const ISSUE_SORTS = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  due: 'Due date',
  title: 'Title (A–Z)',
  status: 'Status',
};

// A brand-new issue has no server timestamp until the write lands, so treat it as the newest.
const createdMillis = (issue) => issue.createdAt?.toMillis?.() ?? Infinity;
const newestFirst = (a, b) => {
  const am = createdMillis(a);
  const bm = createdMillis(b);
  return am === bm ? 0 : am > bm ? -1 : 1;
};
const STATUS_ORDER = { open: 0, in_progress: 1, resolved: 2 };
const statusRank = (issue) => STATUS_ORDER[issue.status] ?? 3;
const titleCompare = (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base', numeric: true });

const COMPARE = {
  newest: newestFirst,
  oldest: (a, b) => newestFirst(b, a),
  // Dated issues first, soonest first. Ties and undated issues fall back to newest first.
  due: (a, b) => bySoonestDue(a, b) || newestFirst(a, b),
  title: (a, b) => titleCompare(a, b) || newestFirst(a, b),
  // Open, then in progress, then resolved. Within a status, newest first.
  status: (a, b) => statusRank(a) - statusRank(b) || newestFirst(a, b),
};

// Returns a new array, so the shared list from useData() is never reordered in place.
export function sortIssues(issues, sort = 'newest') {
  return [...issues].sort(COMPARE[sort] || COMPARE.newest);
}

export function filterIssues(issues, { view = 'active', search = '' } = {}) {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return issues.filter((issue) => {
    if (view === 'active' && issue.status === 'resolved') return false;
    if (view === 'resolved' && issue.status !== 'resolved') return false;
    const text = `${issue.title || ''} ${issue.description || ''}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
