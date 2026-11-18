import { useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useComments, useData } from '../lib/data.jsx';
import { useAction } from '../lib/errors.js';
import { addComment, deleteComment, deleteTask, leaveTask, setTaskAssignees, updateComment, updateTask } from '../lib/api.js';
import { GROUP_MAX, holderIds, holds, isGroupTask, joinNames } from '../lib/assignees.js';
import { TakeButton } from '../components/cards.jsx';
import { Avatar, ConfirmRow, DueBadge, ErrorNote, Icons, LockNote, Modal, Segmented, StatusBadge, TASK_STATUS, firstName, formatWhen, workloadLabel } from '../components/ui.jsx';

function Comment({ comment }) {
  const { user } = useAuth();
  const { nameOf } = useData();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState(comment.text);
  const { busy, error, run } = useAction();
  const mine = comment.authorId === user.uid;
  const name = nameOf(comment.authorId);

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      await updateComment(comment.id, text.trim());
      setEditing(false);
    });
  };

  return (
    <li className="comment">
      <div className="comment-head">
        <Avatar id={comment.authorId} name={name} size={32} />
        <span className="comment-who">
          <strong>{name}{mine && ' (you)'}</strong>
          <span>{formatWhen(comment.createdAt)}</span>
        </span>
        {mine && !editing && !confirming && (
          <span className="comment-actions">
            <button type="button" className="textlink small" onClick={() => { setText(comment.text); setEditing(true); }}>Edit</button>
            <button type="button" className="textlink small danger" onClick={() => setConfirming(true)}>Delete</button>
          </span>
        )}
      </div>
      {editing ? (
        <form className="comment-edit" aria-label="Edit comment" onSubmit={save}>
          <label className="sr-only" htmlFor={`edit-${comment.id}`}>Comment</label>
          <textarea id={`edit-${comment.id}`} className="field" rows={3} required maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row-gap">
            <button type="submit" className="pill pill-sm" disabled={busy}>Save</button>
            <button type="button" className="textlink small" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <p className="comment-text">{comment.text}</p>
      )}
      {confirming && (
        <ConfirmRow
          question="Delete this comment?"
          busy={busy}
          onConfirm={() => run(() => deleteComment(comment.id))}
          onCancel={() => setConfirming(false)}
        />
      )}
      <ErrorNote>{error}</ErrorNote>
    </li>
  );
}

function Comments({ taskId }) {
  const { user } = useAuth();
  const comments = useComments(taskId);
  const [draft, setDraft] = useState('');
  const { busy, error, run } = useAction();

  const post = (e) => {
    e.preventDefault();
    run(async () => {
      await addComment(user.uid, taskId, draft.trim());
      setDraft('');
    });
  };

  const count = comments?.length ?? 0;
  return (
    <section aria-labelledby="h-comments" className="comments">
      <div className="row-baseline">
        <h2 id="h-comments">Comments</h2>
        <span className="muted">{count} {count === 1 ? 'comment' : 'comments'}</span>
      </div>
      {comments && count > 0 && (
        <ul className="comment-list">
          {comments.map((c) => <Comment key={c.id} comment={c} />)}
        </ul>
      )}
      <form className="comment-form" aria-label="Add a comment" onSubmit={post}>
        <label className="sr-only" htmlFor="new-comment">Add a comment</label>
        <input id="new-comment" className="field" type="text" required maxLength={2000} placeholder="Add a comment" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" className="pill" disabled={busy || !draft.trim()}>Post</button>
      </form>
      <ErrorNote>{error}</ErrorNote>
      <span className="muted-sm">Everyone can comment. Only the author can edit or delete their comment.</span>
    </section>
  );
}

export default function TaskPanel() {
  const { issueId, taskId } = useParams();
  const { user } = useAuth();
  const { tasks, issues, members, nameOf, activeTaskCount } = useData();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const { busy, error, run } = useAction();

  const close = () => navigate(`/issues/${issueId}`);
  const task = tasks.find((t) => t.id === taskId);
  const issue = issues.find((i) => i.id === issueId);

  if (!task) {
    return (
      <Modal title="Task" variant="panel" closeLabel="‹ Back" onClose={close}>
        <div className="panel-body gone">
          <h1>This task is gone.</h1>
          <p className="muted">It's no longer on the board.</p>
        </div>
      </Modal>
    );
  }

  // Group tasks: everyone in the group holds the task and can change it.
  const ids = holderIds(task);
  const group = isGroupTask(task);
  const mine = holds(task, user.uid);
  const issueOwner = issue?.ownerId === user.uid;
  const assigneeName = task.assigneeId ? nameOf(task.assigneeId) : null;
  const lockWho = group ? joinNames(ids.map((id) => firstName(nameOf(id)))) : firstName(assigneeName);

  const setStatus = (status) => run(() => updateTask(task.id, { status }));
  // In a group, giving it back takes you out of the group and the others keep it.
  const giveBack = () => run(() => leaveTask(task, user.uid));
  const reassign = (e) => run(() => setTaskAssignees(task.id, e.target.value ? [e.target.value] : []));
  const toggleGroupMember = (id) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    if (next.length > GROUP_MAX) return;
    run(() => setTaskAssignees(task.id, next));
  };
  const remove = () => run(async () => {
    await deleteTask(task.id);
    close();
  });

  return (
    <Modal title={task.title} variant="panel" closeLabel="‹ Back" onClose={close}>
      <div className="panel-body">
        <section aria-label="Task" className="stack">
          <div className="row-badges">
            <StatusBadge status={task.status} />
            <DueBadge item={task} />
          </div>
          <h1>{task.title}</h1>
          {group ? (
            <div className="stack-xs">
              <span className="field-label">Group task · {ids.length} people</span>
              <div className="row-gap">
                {ids.map((id) => (
                  <Link key={id} to={id === user.uid ? '/me' : `/members/${id}`} className="assignee-chip">
                    <Avatar id={id} name={nameOf(id)} size={36} />
                    {id === user.uid ? 'You' : nameOf(id)}
                  </Link>
                ))}
              </div>
            </div>
          ) : task.assigneeId ? (
            <Link to={mine ? '/me' : `/members/${task.assigneeId}`} className="assignee-chip">
              <Avatar id={task.assigneeId} name={assigneeName} size={36} />
              Assigned to {mine ? 'you' : assigneeName}
            </Link>
          ) : (
            <div className="take-box">
              <span className="muted">No one yet. Take it and it's yours.</span>
              <TakeButton taskId={task.id} />
            </div>
          )}
          <div className="desc-card">
            <span className="field-label">Description</span>
            <p className="preline">{task.description || 'No description yet.'}</p>
            <span className="muted-sm">
              Part of <Link to={`/issues/${issueId}`}>{issue?.title || 'this issue'}</Link> · created by {nameOf(task.createdBy)}
            </span>
          </div>

          {mine && (
            <div className="owner-box">
              <Segmented label="Update status" name="task-status" options={TASK_STATUS} value={task.status} onChange={setStatus} disabled={busy} />
              {!confirming ? (
                <div className="row-gap">
                  <Link to="edit" className="textlink">Edit task<Icons.chevron /></Link>
                  <button type="button" className="textlink" onClick={giveBack} disabled={busy}>{group ? 'Leave the group' : 'Give it back'}</button>
                  <button type="button" className="textlink danger" onClick={() => setConfirming(true)}>Delete</button>
                </div>
              ) : (
                <ConfirmRow question="Delete this task for everyone?" busy={busy} onConfirm={remove} onCancel={() => setConfirming(false)} />
              )}
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
          {issueOwner && !mine && (
            <div className="owner-box">
              {group ? (
                <fieldset className="assign">
                  <legend className="field-label">In the group</legend>
                  <div className="assign-list">
                    {members.map((m) => (
                      <label className="assign-row" key={m.id}>
                        <input
                          type="checkbox"
                          checked={ids.includes(m.id)}
                          disabled={busy || (!ids.includes(m.id) && ids.length >= GROUP_MAX)}
                          onChange={() => toggleGroupMember(m.id)}
                        />
                        <Avatar id={m.id} name={m.name} size={34} />
                        <span className="assign-name">
                          {/* Member Workload Indicator */}
                          {m.id === user.uid ? `${m.name} (you)` : m.name} {workloadLabel(activeTaskCount(m.id))}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <label className="lbl">
                  Assigned to
                  <select className="field select" value={task.assigneeId ?? ''} onChange={reassign} disabled={busy}>
                    <option value="">Unassigned</option>
                    {/* Member Workload Indicator */}
                    {members.map((m) => <option key={m.id} value={m.id}>{m.id === user.uid ? `${m.name} (you)` : m.name} {workloadLabel(activeTaskCount(m.id))}</option>)}
                  </select>
                </label>
              )}
              {!confirming ? (
                <div className="row-gap">
                  <button type="button" className="textlink danger" onClick={() => setConfirming(true)}>Delete</button>
                </div>
              ) : (
                <ConfirmRow question="Delete this task for everyone?" busy={busy} onConfirm={remove} onCancel={() => setConfirming(false)} />
              )}
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
          {!issueOwner && !mine && task.assigneeId && (
            <div className="lock-box"><LockNote>Only {lockWho} can edit, update or delete this task.</LockNote></div>
          )}
          {!issueOwner && !task.assigneeId && (
            <div className="lock-box"><LockNote>Whoever takes this task can edit or delete it.</LockNote></div>
          )}
        </section>
        <Comments taskId={task.id} />
      </div>
      <Outlet />
    </Modal>
  );
}
