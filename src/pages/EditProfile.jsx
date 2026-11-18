import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteField } from 'firebase/firestore';
import { auth } from '../firebase.js';
import { useAuth } from '../lib/auth.jsx';
import { friendlyError, useAction } from '../lib/errors.js';
import { updateMember } from '../lib/api.js';
import { formatPhone } from '../lib/phone.js';
import { makeProfilePhoto, photoProblem } from '../lib/photo.js';
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
  // The picture shown in the preview. null means no picture. It's only saved when Save is pressed.
  const [photo, setPhoto] = useState(member.photo ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInput = useRef(null);
  const { busy, error, setError, run } = useAction();

  const close = () => navigate('/me');

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so picking the same file again still triggers a change
    if (!file) return;
    const problem = photoProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setPhotoBusy(true);
    try {
      setPhoto(await makeProfilePhoto(file));
    } catch (err) {
      console.error(err);
      setError("We couldn't read that picture. Try a JPG or PNG.");
    } finally {
      setPhotoBusy(false);
    }
  };

  // Only send the photo when it changed. Removing it deletes the field from the profile.
  const photoPatch = () => {
    if (photo === (member.photo ?? null)) return {};
    return { photo: photo ?? deleteField() };
  };

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
      await updateMember(user.uid, { name: name.trim(), phone: phone.trim(), email: auth.currentUser.email, ...photoPatch() });
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
        <Avatar id={user.uid} name={member.name} size={72} photo={photo} />
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickPhoto} />
        <div className="photo-actions">
          <button type="button" className="pill pill-sm pill-plain" disabled={busy || photoBusy} onClick={() => fileInput.current?.click()}>
            {photoBusy ? 'Loading…' : photo ? 'Change photo' : 'Upload photo'}
          </button>
          {photo && (
            <button type="button" className="pill pill-sm pill-plain" disabled={busy || photoBusy} onClick={() => setPhoto(null)}>
              Remove photo
            </button>
          )}
        </div>
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
