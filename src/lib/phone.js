// US phone numbers, always stored and shown as (555) 123-4567.
export const PHONE_PLACEHOLDER = '(555) 123-4567';
// For the input's pattern attribute. Firestore rules check the same shape.
export const PHONE_PATTERN = '\\(\\d{3}\\) \\d{3}-\\d{4}';

// Up to 10 digits. Drops a leading 1 (country code), since US area codes never start with 1.
export function phoneDigits(value = '') {
  return String(value).replace(/\D/g, '').replace(/^1/, '').slice(0, 10);
}

// Formats as the user types, so partial input looks right too: (555, (555) 12, (555) 123-4.
export function formatPhone(value = '') {
  const d = phoneDigits(value);
  if (!d) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export const isValidPhone = (value) => new RegExp(`^${PHONE_PATTERN}$`).test(value);

// For display: older entries saved before formatting get cleaned up if they have 10 digits.
export function displayPhone(value = '') {
  return phoneDigits(value).length === 10 ? formatPhone(value) : value;
}

export function phoneHref(value = '') {
  const d = phoneDigits(value);
  return d.length === 10 ? `tel:+1${d}` : `tel:${value}`;
}
