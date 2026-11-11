// Issue list filtering: a status view plus a text search over title and description.
export const ISSUE_VIEWS = { active: 'Active', resolved: 'Resolved', all: 'All' };

export function filterIssues(issues, { view = 'active', search = '' } = {}) {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return issues.filter((issue) => {
    if (view === 'active' && issue.status === 'resolved') return false;
    if (view === 'resolved' && issue.status !== 'resolved') return false;
    const text = `${issue.title || ''} ${issue.description || ''}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
