import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase.js';
import { useAuth } from '../lib/auth.jsx';
import { friendlyError, useAction } from '../lib/errors.js';
import { updateMember } from '../lib/api.js';
import { formatPhone } from '../lib/phone.js';
import { Avatar, ErrorNote, FormHead, Modal, PhoneInput } from '../components/ui.jsx';

export default function EditProfile() {
  const { user, member, changeEmail } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email);
  const [phone, setPhone] = useState(formatPhone(member.phone));
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const { busy, error, setError, run } = useAction();

  const close = () => navigate('/me');

  const submit = (e) => {
    e.preventDefault();
    setNotice('');
    const newEmail = email.trim();
    run(async () => {
      let emailResult = 'unchanged';
      if (newEmail.toLowerCase() !== auth.currentUser.email.toLowerCase()) {
        try {
          emailResult = await changeEmail(newEmail, needsPassword ? password : undefined);
        } catch (err) {
          // Firebase wants a recent login before an email change. Ask for the password, right here.
          if (err.code === 'auth/requires-recent-login') {
            setNeedsPassword(true);
            setError('For your security, enter your password to change your email.');
            return;
          }
          if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            setError("That password isn't right. Try again.");
            return;
          }
          setError(friendlyError(err));
          return;
        }
      }
      await updateMember(user.uid, { name: name.trim(), phone: phone.trim(), email: auth.currentUser.email });
      if (emailResult === 'verification-sent') {
        setNeedsPassword(false);
        setPassword('');
        setEmail(auth.currentUser.email);
        setNotice(`Saved. We sent a link to ${newEmail}. Your email changes after you click it and log in again.`);
        return;
      }
      close();
    });
  };

  return (
    <Modal title="Edit profile" onClose={close}>
      <div className="form-head">
        <Avatar id={user.uid} name={member.name} size={72} />
      </div>
      <FormHead title="Your details." subtitle="Only you can change these. Other members see them in the directory." />
      <form className="form" aria-label="Edit profile" onSubmit={submit}>
        <label className="lbl">Name
          <input className="field" type="text" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="lbl">Email
          <input className="field" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
          <span className="hint">You also use this to log in. It has to be one nobody else uses.</span>
        </label>
        <PhoneInput value={phone} onChange={setPhone} />
        {needsPassword && (
          <label className="lbl">Password
            <input className="field" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        <ErrorNote>{error}</ErrorNote>
        {notice && <div role="status" className="saved-note">{notice}</div>}
        <button type="submit" className="pill pill-lg" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </form>
    </Modal>
  );
}
