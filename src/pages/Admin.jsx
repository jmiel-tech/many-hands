import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { friendlyError, useAction } from '../lib/errors.js';
import { adminDeleteIssue, kickMember, unbanMember } from '../lib/api.js';
import { openConversation } from '../lib/chat.js';
import { TopBar } from '../components/Layout.jsx';
import { Avatar, ConfirmRow, ErrorNote, StatusBadge, formatWhen } from '../components/ui.jsx';

// Only admins can read these two collections' full lists, so they load here rather than in DataProvider.
function useCollectionIds(name) {
  const [rows, setRows] = useState(null);
  useEffect(() => onSnapshot(
    collection(db, name),
    (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.error(error);
      setRows([]);
    },
  ), [name]);
  return rows;
}

function useSupportTickets() {
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => onSnapshot(
    collection(db, 'supportTickets'),
    (snapshot) => {
      setTickets(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setError('');
    },
    (reason) => {
      console.error(reason);
      setError(friendlyError(reason));
    },
  ), []);
  return { tickets, error };
}

function MemberRow({ member, isSelf, isOtherAdmin, heldTaskIds }) {
  const { user } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const { busy, error, run } = useAction();
  const held = heldTaskIds.length;

  return (
    <li className="admin-row">
      <Link to={isSelf ? '/me' : `/members/${member.id}`} className="admin-row-main">
        <Avatar id={member.id} name={member.name} size={40} />
        <span className="admin-row-text">
          <strong>{member.name}</strong>
          <span className="wrap">{member.email}</span>
        </span>
      </Link>
      <div className="admin-row-actions">
        {isSelf && <span className="badge tone-accent">You</span>}
        {isOtherAdmin && <span className="badge tone-orphan">Admin</span>}
        {!isSelf && !isOtherAdmin && !confirming && (
          <button type="button" className="textlink danger" onClick={() => setConfirming(true)}>Kick</button>
        )}
      </div>
      {confirming && (
        <ConfirmRow
          question={`Remove ${member.name}? They won't be able to use the app.${held ? ` Their ${held} ${held === 1 ? 'task goes' : 'tasks go'} back to Unclaimed.` : ''}`}
          confirmLabel="Kick"
          cancelLabel="Cancel"
          busy={busy}
          onConfirm={() => run(() => kickMember(user.uid, member, heldTaskIds))}
          onCancel={() => setConfirming(false)}
        />
      )}
      <ErrorNote>{error}</ErrorNote>
    </li>
  );
}

function BanRow({ ban }) {
  const { busy, error, run } = useAction();
  return (
    <li className="admin-row">
      <div className="admin-row-main">
        <Avatar id={ban.id} name={ban.name} size={40} />
        <span className="admin-row-text">
          <strong>{ban.name || 'Unknown member'}</strong>
          <span className="wrap">{ban.email}</span>
          <span>Removed {formatWhen(ban.createdAt).toLowerCase()}</span>
        </span>
      </div>
      <div className="admin-row-actions">
        <button type="button" className="textlink" disabled={busy} onClick={() => run(() => unbanMember(ban))}>
          {busy ? 'Letting back in…' : 'Let back in'}
        </button>
      </div>
      <ErrorNote>{error}</ErrorNote>
    </li>
  );
}

function IssueRow({ issue, taskIds, ownerName }) {
  const [confirming, setConfirming] = useState(false);
  const { busy, error, run } = useAction();
  const count = taskIds.length;

  return (
    <li className="admin-row">
      <Link to={`/issues/${issue.id}`} className="admin-row-main">
        <span className="admin-row-text">
          <strong>{issue.title}</strong>
          <span>By {ownerName} · {count} {count === 1 ? 'task' : 'tasks'}</span>
        </span>
      </Link>
      <div className="admin-row-actions">
        <StatusBadge status={issue.status} />
        {!confirming && (
          <>
            <Link to={`/issues/${issue.id}/edit`} className="textlink">Edit</Link>
            <button type="button" className="textlink danger" onClick={() => setConfirming(true)}>Delete</button>
          </>
        )}
      </div>
      {confirming && (
        <ConfirmRow
          question={count ? `Delete this issue and its ${count} ${count === 1 ? 'task' : 'tasks'} for everyone?` : 'Delete this issue for everyone?'}
          busy={busy}
          onConfirm={() => run(() => adminDeleteIssue(issue.id, taskIds))}
          onCancel={() => setConfirming(false)}
        />
      )}
      <ErrorNote>{error}</ErrorNote>
    </li>
  );
}

function SupportTicketRow({ ticket, nameOf, memberById }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { busy, error, run } = useAction();
  const requester = memberById.get(ticket.ownerId);
  const requesterName = ticket.ownerId ? nameOf(ticket.ownerId) : 'Signed-out visitor';
  const requesterEmail = ticket.email || requester?.email;

  const messageRequester = () => run(async () => {
    const conversationId = await openConversation(user.uid, ticket.ownerId);
    navigate(`/messages/${conversationId}`);
  });

  return (
    <li className="admin-row support-ticket">
      <div className="admin-row-main">
        <span className="admin-row-text">
          <strong>{ticket.subject}</strong>
          <span>{requesterName} · {ticket.category} · {formatWhen(ticket.createdAt)}</span>
          {requesterEmail && <a href={`mailto:${requesterEmail}`}>{requesterEmail}</a>}
          <span className="support-ticket-details">{ticket.details}</span>
        </span>
      </div>
      <div className="admin-row-actions">
        <span className="badge tone-open">Open</span>
        {requester && ticket.ownerId !== user.uid ? (
          <button type="button" className="textlink" onClick={messageRequester} disabled={busy}>
            {busy ? 'Opening…' : 'Message'}
          </button>
        ) : requesterEmail ? (
          <a className="textlink" href={`mailto:${requesterEmail}`}>Email</a>
        ) : null}
      </div>
      {!requester && ticket.ownerId && <span className="hint">The requester is no longer an active member.</span>}
      <ErrorNote>{error}</ErrorNote>
    </li>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const { members, issues, tasks, nameOf, memberById } = useData();
  const admins = useCollectionIds('admins');
  const bans = useCollectionIds('bans');
  const { tickets, error: ticketsError } = useSupportTickets();
  const adminIds = new Set((admins || []).map((a) => a.id));

  return (
    <>
      <TopBar>Admin</TopBar>
      <section className="hero enter">
        <p className="eyebrow">Admin</p>
        <h1 className="display">Keep things tidy.</h1>
        <p className="lede">Remove members who shouldn't be here, and edit or delete any issue. Other admins can't be removed from here.</p>
      </section>

      <section className="band band-alt" aria-labelledby="h-admin-members">
        <div className="band-inner narrow stack-md">
          <h2 id="h-admin-members" className="headline-sm">Members.</h2>
          <ul className="admin-list">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isSelf={m.id === user.uid}
                isOtherAdmin={m.id !== user.uid && adminIds.has(m.id)}
                heldTaskIds={tasks.filter((t) => t.assigneeId === m.id).map((t) => t.id)}
              />
            ))}
          </ul>
        </div>
      </section>

      <section className="band" aria-labelledby="h-admin-removed">
        <div className="band-inner narrow stack-md">
          <h2 id="h-admin-removed" className="headline-sm">Removed.</h2>
          {bans === null ? (
            <p className="empty">Loading…</p>
          ) : bans.length ? (
            <ul className="admin-list">{bans.map((b) => <BanRow key={b.id} ban={b} />)}</ul>
          ) : (
            <p className="empty">Nobody has been removed.</p>
          )}
        </div>
      </section>

      <section className="band band-alt" aria-labelledby="h-admin-issues">
        <div className="band-inner narrow stack-md">
          <h2 id="h-admin-issues" className="headline-sm">All issues.</h2>
          {issues.length ? (
            <ul className="admin-list">
              {issues.map((i) => (
                <IssueRow
                  key={i.id}
                  issue={i}
                  ownerName={i.ownerId === user.uid ? 'you' : nameOf(i.ownerId)}
                  taskIds={tasks.filter((t) => t.issueId === i.id).map((t) => t.id)}
                />
              ))}
            </ul>
          ) : (
            <p className="empty">No issues yet.</p>
          )}
        </div>
      </section>

      <section className="band" aria-labelledby="h-admin-support">
        <div className="band-inner narrow stack-md">
          <h2 id="h-admin-support" className="headline-sm">Support tickets.</h2>
          <ErrorNote>{ticketsError}</ErrorNote>
          {tickets === null ? (
            !ticketsError && <p className="empty">Loading…</p>
          ) : tickets.length ? (
            <ul className="admin-list">
              {[...tickets].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)).map((ticket) => (
                <SupportTicketRow key={ticket.id} ticket={ticket} nameOf={nameOf} memberById={memberById} />
              ))}
            </ul>
          ) : (
            <p className="empty">No support tickets yet.</p>
          )}
        </div>
      </section>
    </>
  );
}
