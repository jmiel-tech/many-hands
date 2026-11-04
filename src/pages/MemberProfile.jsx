import { Link, Navigate, useParams } from 'react-router-dom';
import { COMMUNITY_NAME } from '../firebase.config.js';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { TopBar } from '../components/Layout.jsx';
import { IssueCard, MyTaskCard } from '../components/cards.jsx';
import { Avatar, Icons, LockNote, firstName } from '../components/ui.jsx';

export function DetailRows({ member }) {
  return (
    <div className="detail-rows">
      <div><span>Name</span><span>{member.name}</span></div>
      <div><span>Email</span><a href={`mailto:${member.email}`}>{member.email}</a></div>
      <div><span>Phone</span><a href={`tel:${member.phone}`}>{member.phone}</a></div>
    </div>
  );
}

export default function MemberProfile() {
  const { memberId } = useParams();
  const { user } = useAuth();
  const { memberById, issues, tasks } = useData();
  const member = memberById.get(memberId);

  if (memberId === user.uid) return <Navigate to="/me" replace />;
  if (!member) {
    return (
      <section className="hero">
        <h1 className="display-sm">We can't find that member.</h1>
        <Link to="/members" className="textlink">Back to members<Icons.chevron /></Link>
      </section>
    );
  }

  const first = firstName(member.name);
  const theirIssues = issues.filter((i) => i.ownerId === member.id);
  const theirTasks = tasks.filter((t) => t.assigneeId === member.id);

  return (
    <>
      <TopBar>
        <Link to="/members" className="topbar-back">‹ Members</Link>
        <span className="topbar-title">{member.name}</span>
      </TopBar>
      <section className="hero enter">
        <Avatar id={member.id} name={member.name} size={96} />
        <h1 className="display">{member.name}.</h1>
        <p className="lede">Member of {COMMUNITY_NAME}</p>
        <LockNote>Only {first} can edit this profile.</LockNote>
      </section>
      <section className="band band-tight" aria-label={`${first}'s details`}>
        <div className="band-inner narrow"><DetailRows member={member} /></div>
      </section>
      <section className="band band-alt" aria-labelledby="h-their-issues">
        <div className="band-inner stack-md">
          <h2 id="h-their-issues" className="headline-sm">{first}'s issues.</h2>
          {theirIssues.length ? (
            <div className="grid grid-issues">{theirIssues.map((i) => <IssueCard key={i.id} issue={i} />)}</div>
          ) : <p className="empty">No issues yet.</p>}
        </div>
      </section>
      <section className="band" aria-labelledby="h-their-tasks">
        <div className="band-inner stack-md">
          <h2 id="h-their-tasks" className="headline-sm">{first}'s tasks.</h2>
          {theirTasks.length ? (
            <div className="grid grid-issues">{theirTasks.map((t) => <MyTaskCard key={t.id} task={t} />)}</div>
          ) : <p className="empty">No tasks yet.</p>}
          <p className="muted center-text">You can comment on {first}'s tasks, but only {first} can change them.</p>
        </div>
      </section>
    </>
  );
}
