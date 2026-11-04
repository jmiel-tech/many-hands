import { useState } from 'react';
import { COMMUNITY_NAME } from '../firebase.config.js';
import { useAuth } from '../lib/auth.jsx';
import { useAction } from '../lib/errors.js';
import { saveNewMember } from '../lib/api.js';
import { ErrorNote, FormHead, Logo } from '../components/ui.jsx';

export default function AuthPage() {
  const { logIn, signUp, resetPassword } = useAuth();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [notice, setNotice] = useState('');
  const { busy, error, setError, run } = useAction();
  const isLogin = tab === 'login';

  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
    required: true,
  });

  const switchTab = (next) => {
    setTab(next);
    setError('');
    setNotice('');
  };

  const submit = (e) => {
    e.preventDefault();
    setNotice('');
    const email = form.email.trim();
    if (isLogin) {
      run(() => logIn(email, form.password));
      return;
    }
    if (form.password.length < 8) {
      setError('That password is too short. Use at least 8 characters.');
      return;
    }
    run(() => signUp({ name: form.name.trim(), phone: form.phone.trim(), email, password: form.password }));
  };

  const forgot = () => {
    const email = form.email.trim();
    if (!email) {
      setError('Enter your email above first, and we can send you a reset link.');
      return;
    }
    run(async () => {
      await resetPassword(email);
      setNotice(`If ${email} has an account, a reset link is on its way.`);
    });
  };

  return (
    <div className="auth-page">
      <div className="auth-card enter">
        <div className="form-head">
          <Logo size={64} />
          <h1>{isLogin ? 'Welcome back.' : 'Join Many Hands.'}</h1>
          <p>{COMMUNITY_NAME}</p>
        </div>
        <div role="tablist" aria-label="Choose" className="seg seg-two">
          <button type="button" role="tab" aria-selected={isLogin} className={`seg-tab${isLogin ? ' is-on' : ''}`} onClick={() => switchTab('login')}>Log in</button>
          <button type="button" role="tab" aria-selected={!isLogin} className={`seg-tab${!isLogin ? ' is-on' : ''}`} onClick={() => switchTab('signup')}>Sign up</button>
        </div>
        <form className="form" aria-label={isLogin ? 'Log in' : 'Sign up'} onSubmit={submit}>
          {!isLogin && (
            <label className="lbl">Your name
              <input className="field" type="text" autoComplete="name" maxLength={80} {...field('name')} />
            </label>
          )}
          <label className="lbl">Email
            <input className="field" type="email" autoComplete="email" maxLength={254} {...field('email')} />
          </label>
          {!isLogin && (
            <label className="lbl">Phone
              <input className="field" type="tel" autoComplete="tel" maxLength={30} {...field('phone')} />
            </label>
          )}
          <label className="lbl">Password
            <input className="field" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} {...field('password')} />
            {!isLogin && <span className="hint">At least 8 characters.</span>}
          </label>
          <ErrorNote>{error}</ErrorNote>
          {error.startsWith('That email already') && (
            <button type="button" className="textlink center" onClick={() => switchTab('login')}>Log in instead</button>
          )}
          {notice && <div role="status" className="saved-note">{notice}</div>}
          <button type="submit" className="pill pill-lg" disabled={busy}>
            {busy ? 'One moment…' : isLogin ? 'Log in' : 'Create account'}
          </button>
          {isLogin ? (
            <button type="button" className="textlink center" onClick={forgot}>Forgot your password?</button>
          ) : (
            <p className="hint center-text">Other members will see your name, email and phone. Only you can change them.</p>
          )}
        </form>
      </div>
    </div>
  );
}

// Safety net: the login worked, but the profile doc didn't get saved at sign-up.
export function FinishProfile() {
  const { user, logOut } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const { busy, error, run } = useAction();

  const submit = (e) => {
    e.preventDefault();
    run(() => saveNewMember(user.uid, { name: name.trim(), phone: phone.trim(), email: user.email }));
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <FormHead title="Almost there." subtitle="Add your name and phone to finish setting up your profile." />
        <form className="form" aria-label="Finish your profile" onSubmit={submit}>
          <label className="lbl">Your name
            <input className="field" type="text" autoComplete="name" maxLength={80} required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="lbl">Phone
            <input className="field" type="tel" autoComplete="tel" maxLength={30} required value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <ErrorNote>{error}</ErrorNote>
          <button type="submit" className="pill pill-lg" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          <button type="button" className="textlink center muted-link" onClick={logOut}>Log out</button>
        </form>
      </div>
    </div>
  );
}
