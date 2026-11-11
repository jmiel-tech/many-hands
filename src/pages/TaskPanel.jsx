import { useState } from 'react';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useComments, useData } from '../lib/data.jsx';
import { useAction } from '../lib/errors.js';
import { addComment, deleteComment, deleteTask, updateComment, updateTask } from '../lib/api.js';
import { TakeButton } from '../components/cards.jsx';
import { Avatar, ConfirmRow, ErrorNote, Icons, LockNote, Modal, Segmented, StatusBadge, TASK_STATUS, firstName, formatWhen } from '../components/ui.jsx';

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
  const { tasks, issues, nameOf } = useData();
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

  const mine = task.assigneeId === user.uid;
  const assigneeName = task.assigneeId ? nameOf(task.assigneeId) : null;

  const setStatus = (status) => run(() => updateTask(task.id, { status }));
  const giveBack = () => run(() => updateTask(task.id, { assigneeId: null, status: 'todo' }));
  const remove = () => run(async () => {
    await deleteTask(task.id);
    close();
  });

  return (
    <Modal title={task.title} variant="panel" closeLabel="‹ Back" onClose={close}>
      <div className="panel-body">
        <section aria-label="Task" className="stack">
          <StatusBadge status={task.status} />
          {issue && (
            <div className="meta-row">
              <span className="muted">Issue owner: {issue.ownerId === user.uid ? 'you' : nameOf(issue.ownerId)}</span>
              {issue.ownerId === user.uid && <Link to={`/issues/${issueId}/access`} className="pill pill-plain pill-sm">Edit access…</Link>}
            </div>
          )}
          <h1>{task.title}</h1>
          {task.assigneeId ? (
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
                  <button type="button" className="textlink" onClick={giveBack} disabled={busy}>Give it back</button>
                  <button type="button" className="textlink danger" onClick={() => setConfirming(true)}>Delete</button>
                </div>
              ) : (
                <ConfirmRow question="Delete this task for everyone?" busy={busy} onConfirm={remove} onCancel={() => setConfirming(false)} />
              )}
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
          {!mine && task.assigneeId && (
            <div className="lock-box"><LockNote>Only {firstName(assigneeName)} can edit, update or delete this task.</LockNote></div>
          )}
          {!task.assigneeId && (
            <div className="lock-box"><LockNote>Whoever takes this task can edit or delete it.</LockNote></div>
          )}
        </section>
        <Comments taskId={task.id} />
      </div>
      <Outlet />
    </Modal>
  );
}
