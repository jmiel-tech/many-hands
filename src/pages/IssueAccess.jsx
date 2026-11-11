import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { useAction } from '../lib/errors.js';
import { updateIssue } from '../lib/api.js';
import { Avatar, ErrorNote, FormHead, LockNote, Modal, firstName } from '../components/ui.jsx';

export function EditorPicker({ people, selected, onToggle }) {
  return (
    <fieldset className="assign">
      <legend className="field-label">People who can edit</legend>
      <div className="assign-list">
        {people.map((p) => (
          <label className="assign-row" key={p.id}>
            <input type="checkbox" checked={selected.includes(p.id)} onChange={() => onToggle(p.id)} />
            <Avatar id={p.id} name={p.name} size={34} />
            <span className="assign-name">{p.name}{selected.includes(p.id) && <small>Can edit and add tasks</small>}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function IssueAccess() {
  const { issueId } = useParams();
  const { user } = useAuth();
  const { issues, members, nameOf } = useData();
  const navigate = useNavigate();
  const issue = issues.find((i) => i.id === issueId);
  const [editorIds, setEditorIds] = useState(() => (issue?.editorIds || []).filter((id) => id !== issue?.ownerId));
  const { busy, error, run } = useAction();

  const close = () => navigate(`/issues/${issueId}`);

  if (!issue || issue.ownerId !== user.uid) {
    return (
      <Modal title="Edit access" onClose={close}>
        <FormHead title="Not yours to manage." />
        <div className="form"><LockNote>Only {firstName(nameOf(issue?.ownerId))} can change who has edit access to this issue.</LockNote></div>
      </Modal>
    );
  }

  const others = members.filter((m) => m.id !== issue.ownerId);
  const toggle = (id) => setEditorIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      await updateIssue(issue.id, { editorIds: [issue.ownerId, ...editorIds] });
      close();
    });
  };

  return (
    <Modal title="Edit access" onClose={close}>
      <FormHead title="Edit access." subtitle={`Choose who can edit "${issue.title}" and add tasks to it. Everyone can still read it.`} />
      <form className="form" aria-label="Edit access" onSubmit={submit}>
        {others.length > 0 ? (
          <EditorPicker people={others} selected={editorIds} onToggle={toggle} />
        ) : (
          <p className="note-box">No other members have joined yet.</p>
        )}
        <p className="note-box">You're the owner, so you always have edit access and are the only one who can delete this issue or change who can edit it.</p>
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" className="pill pill-lg" disabled={busy}>{busy ? 'Saving…' : 'Save access'}</button>
      </form>
    </Modal>
  );
}
