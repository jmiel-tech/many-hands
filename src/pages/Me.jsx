import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { COMMUNITY_NAME } from '../firebase.config.js';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { TopBar } from '../components/Layout.jsx';
import { IssueCard, MyTaskCard } from '../components/cards.jsx';
import { Avatar, ErrorNote, Icons, ThemeSwitch, firstName } from '../components/ui.jsx';
import { useAction } from '../lib/errors.js';
import { useTheme } from '../lib/theme.jsx';
import { DetailRows } from './MemberProfile.jsx';
import { bySoonestDue } from '../lib/dates.js';

// Red button, then an "are you sure" box that also asks for the password, so it can't happen by accident.
function DeleteAccount({ unfinishedTaskIds }) {
  const { deleteAccount } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const { busy, error, setError, run } = useAction();
  const held = unfinishedTaskIds.length;

  const cancel = () => {
    setConfirming(false);
    setPassword('');
    setError('');
  };

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      try {
        await deleteAccount(password, unfinishedTaskIds);
      } catch (err) {
        if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          throw Object.assign(new Error('wrong password'), { friendly: "That password isn't right. Try again." });
        }
        throw err;
      }
    });
  };

  if (!confirming) {
    return (
      <button type="button" className="pill pill-danger center" onClick={() => setConfirming(true)}>Delete account</button>
    );
  }

  return (
    <form role="alertdialog" aria-label="Delete your account?" className="confirm center" onSubmit={submit}>
      <span className="confirm-q">Are you sure you want to delete your account?</span>
      <span>
        This can't be undone. Your profile and login are deleted.
        {held ? ` Your ${held} unfinished ${held === 1 ? 'task goes' : 'tasks go'} back to Unclaimed.` : ''}
        {' '}Issues you started and comments you wrote stay, under "A former member".
      </span>
      <label className="lbl">Enter your password to confirm
        <input className="field" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <ErrorNote>{error}</ErrorNote>
      <div className="confirm-actions">
        <button type="submit" className="pill pill-danger pill-sm" disabled={busy || !password}>{busy ? 'Deleting…' : 'Yes, delete my account'}</button>
        <button type="button" className="pill pill-plain pill-sm" onClick={cancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

export default function Me() {
  const { user, member, isAdmin, logOut } = useAuth();
  const { dark, toggle } = useTheme();
  const { issues, tasks } = useData();
  const myIssues = issues.filter((i) => i.ownerId === user.uid);
  const myTasks = tasks.filter((t) => t.assigneeId === user.uid).sort(bySoonestDue);

  return (
    <>
      <TopBar>Me</TopBar>
      <section className="hero enter">
        <Avatar id={user.uid} name={member.name} size={96} />
        <h1 className="display">Hi, {firstName(member.name)}.</h1>
        <p className="lede">Thanks for pitching in with {COMMUNITY_NAME}.</p>
        <div className="hero-actions">
          <Link to="/me/edit" className="pill">Edit profile</Link>
        </div>
      </section>
      <section className="band band-tight" aria-label="My details">
        <div className="band-inner narrow stack-md">
          <DetailRows member={member} />
          <ThemeSwitch dark={dark} onToggle={toggle} />
          {isAdmin && <Link to="/admin" className="textlink center">Open the admin page<Icons.chevron /></Link>}
        </div>
      </section>
      <section className="band band-alt" aria-labelledby="h-my-issues">
        <div className="band-inner stack-md">
          <h2 id="h-my-issues" className="headline-sm">My issues.</h2>
          {myIssues.length ? (
            <div className="grid grid-issues">{myIssues.map((i) => <IssueCard key={i.id} issue={i} />)}</div>
          ) : (
            <p className="empty">You haven't started an issue yet. <Link to="/issues/new">Start one</Link>.</p>
          )}
        </div>
      </section>
      <section className="band" aria-labelledby="h-my-tasks">
        <div className="band-inner stack-md">
          <h2 id="h-my-tasks" className="headline-sm">My tasks.</h2>
          {myTasks.length ? (
            <div className="grid grid-issues">{myTasks.map((t) => <MyTaskCard key={t.id} task={t} />)}</div>
          ) : (
            <p className="empty">Nothing on your plate. <Link to="/">See open tasks</Link>.</p>
          )}
          <button type="button" className="textlink center muted-link" onClick={logOut}>Log out</button>
          <DeleteAccount unfinishedTaskIds={myTasks.filter((t) => t.status !== 'done').map((t) => t.id)} />
        </div>
      </section>
      <Outlet />
    </>
  );
}
