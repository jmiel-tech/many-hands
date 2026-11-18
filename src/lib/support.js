const SUPPORT_EMAIL_ENDPOINT = (
  import.meta.env.VITE_SUPPORT_EMAIL_ENDPOINT
  || import.meta.env.VITE_CHAT_ENDPOINT
  || 'https://many-hands-chat.jmielk92.workers.dev'
).trim();

export async function sendSupportEmail({ email, subject, message }) {
  if (navigator.onLine === false) {
    throw Object.assign(new Error('offline'), { code: 'app/offline' });
  }

  let response;
  try {
    response = await fetch(`${SUPPORT_EMAIL_ENDPOINT.replace(/\/+$/, '')}/support-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, subject, message }),
    });
  } catch (error) {
    throw Object.assign(new Error('Could not reach the email service.'), {
      code: 'support/unavailable',
      cause: error,
    });
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw Object.assign(new Error('The email service returned an invalid response.'), {
      code: 'support/unavailable',
    });
  }

  if (!response.ok) {
    const code = response.status === 429
      ? 'support/rate-limited'
      : response.status === 400
        ? 'support/invalid'
        : 'support/unavailable';
    throw Object.assign(new Error(result.error || 'Could not deliver the email.'), { code });
  }
}
