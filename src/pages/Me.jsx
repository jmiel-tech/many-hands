import { Link, Outlet } from 'react-router-dom';
import { COMMUNITY_NAME } from '../firebase.config.js';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { TopBar } from '../components/Layout.jsx';
import { IssueCard, MyTaskCard } from '../components/cards.jsx';
import { Avatar, Icons, ThemeSwitch, firstName } from '../components/ui.jsx';
import { useTheme } from '../lib/theme.jsx';
import { DetailRows } from './MemberProfile.jsx';

export default function Me() {
  const { user, member, isAdmin, logOut } = useAuth();
  const { dark, toggle } = useTheme();
  const { issues, tasks } = useData();
  const myIssues = issues.filter((i) => i.ownerId === user.uid);
  const myTasks = tasks.filter((t) => t.assigneeId === user.uid);

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
        </div>
      </section>
      <Outlet />
    </>
  );
}
