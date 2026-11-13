import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { COMMUNITY_NAME } from '../firebase.config.js';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { filterMembers } from '../lib/filter.js';
import { TopBar } from '../components/Layout.jsx';
import { Avatar } from '../components/ui.jsx';
import { displayPhone } from '../lib/phone.js';

export default function Members() {
  const { user } = useAuth();
  const { members } = useData();
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);
  const query = search.trim();
  const shown = filterMembers(members, search);

  // Clearing puts focus back in the box, ready for the next search.
  const clearSearch = () => {
    setSearch('');
    searchRef.current?.focus();
  };

  return (
    <>
      <TopBar>Members</TopBar>
      <section className="hero enter">
        <p className="eyebrow">{COMMUNITY_NAME}</p>
        <h1 className="display">Members.</h1>
        <p className="lede">{members.length} {members.length === 1 ? 'person' : 'people'} pitching in. Select anyone to see their profile.</p>
      </section>
      <section className="band band-alt band-fill" aria-label="All members">
        <div className="band-inner">
          {members.length > 0 && (
            <div className="list-tools member-tools" role="search">
              <label className="sr-only" htmlFor="member-search">Search members by name, email or phone</label>
              <input
                id="member-search"
                ref={searchRef}
                type="search"
                className="field"
                placeholder="Search by name, email or phone"
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <p className="muted-sm" aria-live="polite">
                {query ? `Showing ${shown.length} of ${members.length}` : `${members.length} ${members.length === 1 ? 'member' : 'members'}`}
                {query && shown.length > 0 && (
                  <> · <button type="button" className="textlink small" onClick={clearSearch}>Clear search</button></>
                )}
              </p>
            </div>
          )}
          {shown.length ? (
            <ul className="grid grid-members">
              {shown.map((m) => {
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
                        <span className="muted">{displayPhone(m.phone)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : query ? (
            <p className="empty">
              No members match "{query}". Check the spelling, or try part of a name, an email, or a phone number.{' '}
              <button type="button" className="textlink" onClick={clearSearch}>Clear search</button>
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}
