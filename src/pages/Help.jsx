import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useAction } from '../lib/errors.js';
import { createSupportTicket } from '../lib/api.js';
import { TopBar } from '../components/Layout.jsx';
import { ErrorNote } from '../components/ui.jsx';
import EmailSupport from './EmailSupport.jsx';

const SUPPORT_EMAIL = 'jamielke@svsu.edu';

const FAQS = [
  {
    question: 'How do I volunteer for an issue?',
    answer: 'Open Issues, choose an issue, and take an unclaimed task. Your tasks appear on your home page and calendar.',
  },
  {
    question: 'How do I create an issue or task?',
    answer: 'Choose Issues, then New issue. Once it is created, open it and add tasks for others to take.',
  },
  {
    question: 'How do private messages work?',
    answer: 'Open a member profile and choose Message to start a private conversation. Your conversations are listed under Messages.',
  },
  {
    question: 'Can I change my profile or email?',
    answer: 'Open Me to update your profile. You can change your email from the profile editor after confirming your password.',
  },
  {
    question: 'What if I forgot my password?',
    answer: 'Sign out if needed, then choose Forgot password on the sign-in screen and follow the email instructions.',
  },
];

export default function Help() {
  const { user, member } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('other');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { busy: ticketBusy, error: ticketError, errorCode: ticketErrorCode, run: runTicket } = useAction();

  if (searchParams.get('compose') === 'email') return <EmailSupport />;

  const submitTicket = (event) => {
    event.preventDefault();
    const values = {
      email: user?.email || email.trim(),
      subject: subject.trim(),
      category,
      details: details.trim(),
    };
    runTicket(async () => {
      await createSupportTicket(user?.uid, values);
      setEmail('');
      setSubject('');
      setCategory('other');
      setDetails('');
      setSubmitted(true);
    });
  };

  return (
    <>
      <TopBar>Help</TopBar>
      <section className="hero enter">
        <p className="eyebrow">Help & support</p>
        <h1 className="display">How can we help?</h1>
        <p className="lede">Find an answer, email support, or send a ticket—even if you don't have an account.</p>
      </section>

      <section className="band band-alt" aria-labelledby="h-help-faq">
        <div className="band-inner help-section">
          <div className="section-head">
            <h2 id="h-help-faq" className="headline-sm">Sample FAQs.</h2>
            <p className="sub">Quick answers to common questions about Many Hands.</p>
          </div>
          <div className="help-faqs">
            {FAQS.map(({ question, answer }) => (
              <details className="help-faq" key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="h-help-contact">
        <div className="band-inner narrow stack-md">
          <div className="section-head">
            <h2 id="h-help-contact" className="headline-sm">Contact support.</h2>
            <p className="sub">Email the support contact directly and include any helpful details.</p>
          </div>
          <Link className="pill pill-lg center" to="/help?compose=email">Email {SUPPORT_EMAIL}</Link>
        </div>
      </section>

      <section className="band band-alt" aria-labelledby="h-help-ticket">
        <div className="band-inner narrow stack-md">
          <div className="section-head">
            <h2 id="h-help-ticket" className="headline-sm">Submit a support ticket.</h2>
            <p className="sub">Tell us what happened and the support team will follow up.</p>
          </div>
          {submitted && (
            <div className="saved-note" role="status">Your support ticket was submitted. Thank you for letting us know.</div>
          )}
          <form className="help-ticket-form" onSubmit={submitTicket}>
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
                    setSubmitted(false);
                  }}
                  placeholder="you@example.com"
                />
              </label>
            )}
            <label className="lbl">Subject
              <input
                className="field"
                required
                maxLength={120}
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  setSubmitted(false);
                }}
                placeholder="A short summary"
              />
            </label>
            <label className="lbl">What do you need help with?
              <select className="field select" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="bug">Something isn't working</option>
                <option value="account">My account</option>
                <option value="other">Something else</option>
              </select>
            </label>
            <label className="lbl">Details
              <textarea
                className="field"
                required
                rows={5}
                maxLength={3000}
                value={details}
                onChange={(event) => {
                  setDetails(event.target.value);
                  setSubmitted(false);
                }}
                placeholder="Describe what happened and what you expected."
              />
              <span className="hint">Please don't include passwords or other sensitive information.</span>
            </label>
            <ErrorNote>
              {ticketErrorCode === 'permission-denied'
                ? 'Ticket submission is blocked by the live Firebase security rules. The project administrator needs to publish the latest firestore.rules.'
                : ticketError}
            </ErrorNote>
            <button type="submit" className="pill pill-lg" disabled={ticketBusy}>
              {ticketBusy ? 'Submitting…' : 'Submit ticket'}
            </button>
          </form>
          {member && <p className="muted center-text">We'll associate this ticket with your account, {member.name.split(/\s+/)[0]}.</p>}
          {user ? (
            <p className="muted center-text"><Link to="/messages">View your messages</Link></p>
          ) : (
            <p className="muted center-text"><Link to="/">Sign in</Link> or create an account to access the community.</p>
          )}
        </div>
      </section>
    </>
  );
}
