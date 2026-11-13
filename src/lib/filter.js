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

// Member search over name, email and phone. Case-insensitive, and every word must match.
// A word made only of digits and phone punctuation also matches by digits, so
// "5551234", "555-1234" and "(555) 123" all find (555) 123-4567.
const PHONE_WORD = /^[\d()+\-.]+$/;
const digitsOf = (value = '') => String(value).replace(/\D/g, '');

export function filterMembers(members, search = '') {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return members;
  return members.filter((member) => {
    const text = `${member.name || ''} ${member.email || ''} ${member.phone || ''}`.toLowerCase();
    const phoneDigits = digitsOf(member.phone);
    return words.every((word) => {
      if (text.includes(word)) return true;
      const wordDigits = PHONE_WORD.test(word) ? digitsOf(word) : '';
      return wordDigits !== '' && phoneDigits.includes(wordDigits);
    });
  });
}
