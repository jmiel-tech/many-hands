import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useData, useIssueComments } from '../lib/data.jsx';
import { useAction } from '../lib/errors.js';
import { addIssueComment, deleteIssueComment, updateIssueComment } from '../lib/api.js';
import { Avatar, ConfirmRow, ErrorNote, formatWhen } from './ui.jsx';

// Discussion about an issue as a whole. Task comments live on each task's panel.
// Ids here are prefixed "issue-" so they never clash with a task panel open on top of the issue.

function IssueComment({ comment }) {
  const { user, isAdmin } = useAuth();
  const { nameOf } = useData();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState(comment.text);
  const { busy, error, run } = useAction();
  const mine = comment.authorId === user.uid;
  const canDelete = mine || isAdmin;
  const name = nameOf(comment.authorId);

  const save = (e) => {
    e.preventDefault();
    run(async () => {
      await updateIssueComment(comment.id, text.trim());
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
        {canDelete && !editing && !confirming && (
          <span className="comment-actions">
            {mine && <button type="button" className="textlink small" onClick={() => { setText(comment.text); setEditing(true); }}>Edit</button>}
            <button type="button" className="textlink small danger" onClick={() => setConfirming(true)}>Delete</button>
          </span>
        )}
      </div>
      {editing ? (
        <form className="comment-edit" aria-label="Edit comment" onSubmit={save}>
          <label className="sr-only" htmlFor={`issue-edit-${comment.id}`}>Comment</label>
          <textarea id={`issue-edit-${comment.id}`} className="field" rows={3} required maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row-gap">
            <button type="submit" className="pill pill-sm" disabled={busy || !text.trim()}>Save</button>
            <button type="button" className="textlink small" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <p className="comment-text">{comment.text}</p>
      )}
      {confirming && (
        <ConfirmRow
          question={mine ? 'Delete this comment?' : `Delete ${name}'s comment as an admin?`}
          busy={busy}
          onConfirm={() => run(() => deleteIssueComment(comment.id))}
          onCancel={() => setConfirming(false)}
        />
      )}
      <ErrorNote>{error}</ErrorNote>
    </li>
  );
}

export default function IssueComments({ issueId }) {
  const { user } = useAuth();
  const comments = useIssueComments(issueId);
  const [draft, setDraft] = useState('');
  const { busy, error, run } = useAction();

  const post = (e) => {
    e.preventDefault();
    run(async () => {
      await addIssueComment(user.uid, issueId, draft.trim());
      setDraft('');
    });
  };

  const count = comments?.length ?? 0;
  return (
    <section aria-labelledby="h-issue-comments" className="issue-comments-wrap">
      <div className="comments issue-comments">
        <div className="row-baseline">
          <h2 id="h-issue-comments">Discussion</h2>
          <span className="muted">{count} {count === 1 ? 'comment' : 'comments'}</span>
        </div>
        <p className="muted-sm">Talk about this issue as a whole. For a single task, open the task and comment there.</p>
        {comments && count > 0 && (
          <ul className="comment-list">
            {comments.map((c) => <IssueComment key={c.id} comment={c} />)}
          </ul>
        )}
        <form className="comment-form" aria-label="Add a comment on this issue" onSubmit={post}>
          <label className="sr-only" htmlFor="new-issue-comment">Add a comment on this issue</label>
          <input id="new-issue-comment" className="field" type="text" required maxLength={2000} placeholder="Add to the discussion" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <button type="submit" className="pill" disabled={busy || !draft.trim()}>Post</button>
        </form>
        <ErrorNote>{error}</ErrorNote>
        <span className="muted-sm">Everyone can comment. Only the author can edit their comment.</span>
      </div>
    </section>
  );
}
