import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useAction } from '../lib/errors.js';
import { sendSupportEmail } from '../lib/support.js';
import { TopBar } from '../components/Layout.jsx';
import { ErrorNote } from '../components/ui.jsx';

const SUPPORT_EMAIL = 'jamielke@svsu.edu';

export default function EmailSupport() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useAction();

  const send = (event) => {
    event.preventDefault();
    run(async () => {
      await sendSupportEmail({
        email: user?.email || email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubject('');
      setMessage('');
      setEmail('');
      setSent(true);
    });
  };

  return (
    <>
      <TopBar>
        <Link to="/help" className="topbar-back">‹ Help</Link>
        Email support
      </TopBar>
      <section className="hero enter">
        <p className="eyebrow">New email</p>
        <h1 className="display">Write to support.</h1>
        <p className="lede">Write your message here and send it directly to the support team.</p>
      </section>
      <section className="band band-alt" aria-labelledby="h-email-support">
        <div className="band-inner narrow stack-md">
          <h2 id="h-email-support" className="headline-sm">Your message.</h2>
          <div className="detail-rows">
            <div><span>To</span><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></div>
          </div>
          {sent && <div className="saved-note" role="status">Your email was sent to support.</div>}
          <form className="help-ticket-form" onSubmit={send}>
            {!user && (
              <label className="lbl">Your email
                <input
                  className="field"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setSent(false);
                  }}
                  placeholder="you@example.com"
                />
              </label>
            )}
            <label className="lbl">Subject
              <input
                className="field"
                required
                maxLength={160}
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  setSent(false);
                }}
                placeholder="How can we help?"
              />
            </label>
            <label className="lbl">Message
              <textarea
                className="field"
                required
                rows={7}
                maxLength={5000}
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setSent(false);
                }}
                placeholder="Describe what you need help with."
              />
            </label>
            <ErrorNote>{error}</ErrorNote>
            <button type="submit" className="pill pill-lg" disabled={busy}>
              {busy ? 'Sending…' : 'Send email'}
            </button>
            <p className="muted center-text">Replies will be sent to {user?.email || email || 'the email address you provide'}.</p>
          </form>
        </div>
      </section>
    </>
  );
}
