// Unsaved-changes detection for the issue and task forms.
// Values are compared the way the forms save them: text is trimmed, and
// empty, null and undefined all mean "nothing", so a field that was only
// touched (typed into and erased, or given trailing spaces) doesn't count.
const normalize = (value) => (value == null ? '' : String(value).trim());

export function hasUnsavedChanges(initial = {}, current = {}) {
  const keys = new Set([...Object.keys(initial), ...Object.keys(current)]);
  return [...keys].some((key) => normalize(initial[key]) !== normalize(current[key]));
}
