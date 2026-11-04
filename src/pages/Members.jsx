import { Link } from 'react-router-dom';
import { COMMUNITY_NAME } from '../firebase.config.js';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { TopBar } from '../components/Layout.jsx';
import { Avatar } from '../components/ui.jsx';

export default function Members() {
  const { user } = useAuth();
  const { members } = useData();
  return (
    <>
      <TopBar>Members</TopBar>
      <section className="hero enter">
        <p className="eyebrow">{COMMUNITY_NAME}</p>
        <h1 className="display">Members.</h1>
        <p className="lede">{members.length} {members.length === 1 ? 'person' : 'people'} pitching in. Select anyone to see their profile.</p>
      </section>
      <section className="band band-alt band-fill" aria-label="All members">
        <ul className="band-inner grid grid-members">
          {members.map((m) => {
            const isMe = m.id === user.uid;
            return (
              <li key={m.id}>
                <Link to={isMe ? '/me' : `/members/${m.id}`} className="card member-card">
                  <div className="row-between">
                    <Avatar id={m.id} name={m.name} size={52} />
                    {isMe && <span className="badge tone-accent">You</span>}
                  </div>
                  <h2>{m.name}</h2>
                  <span className="stack-xs">
                    <span className="muted wrap">{m.email}</span>
                    <span className="muted">{m.phone}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
