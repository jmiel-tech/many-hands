import { useEffect, useId, useRef } from 'react';

export const TASK_STATUS = { todo: 'To do', doing: 'Doing', done: 'Done' };
export const ISSUE_STATUS = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved' };

export const firstName = (name = '') => name.trim().split(/\s+/)[0];

export function formatWhen(timestamp) {
  const date = timestamp?.toDate?.();
  if (!date) return 'Just now';
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const Icons = {
  home: (p) => (<svg width="24" height="24" strokeWidth="1.8" {...svgProps} {...p}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>),
  issues: (p) => (<svg width="24" height="24" strokeWidth="1.8" {...svgProps} {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8" /><path d="M8 13h8" /><path d="M8 17h5" /></svg>),
  members: (p) => (<svg width="24" height="24" strokeWidth="1.8" {...svgProps} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14.6c2.4.3 4.2 2 5 5.4" /></svg>),
  me: (p) => (<svg width="24" height="24" strokeWidth="1.8" {...svgProps} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>),
  chevron: (p) => (<svg width="16" height="16" strokeWidth="2.2" {...svgProps} {...p}><path d="M9 6l6 6-6 6" /></svg>),
  lock: (p) => (<svg width="14" height="14" strokeWidth="2" {...svgProps} {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>),
  offline: (p) => (<svg width="16" height="16" strokeWidth="2" {...svgProps} {...p}><path d="M3 3l18 18" /><path d="M8.5 16.5a5 5 0 0 1 7 0" /><path d="M5 12.5a10 10 0 0 1 5-2.7" /><path d="M19 12.5a10 10 0 0 0-3-2" /><circle cx="12" cy="20" r="0.5" /></svg>),
};

export function Logo({ size = 26 }) {
  return (
    <span className="logo" style={{ width: size, height: size, borderRadius: size / 3.2 }} aria-hidden="true">
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V10" />
        <path d="M10 10V5a1.5 1.5 0 0 1 3 0v5" />
        <path d="M13 10V6a1.5 1.5 0 0 1 3 0v7" />
        <path d="M7 11a1.5 1.5 0 0 0-3 0v2a8 8 0 0 0 8 8h1a5 5 0 0 0 5-5v-3" />
      </svg>
    </span>
  );
}

const AVATAR_COLORS = [
  ['#F9E1D0', '#7A3410'],
  ['#DCEBF7', '#1E4A73'],
  ['#E5F1DD', '#2F5A1E'],
  ['#EDE3F6', '#4F2C73'],
  ['#FCEFC9', '#6B4A00'],
];

export function Avatar({ id = '', name = '', size = 36 }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  const hash = [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const [background, color] = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, background, color, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </span>
  );
}

const HEALTH_TONE = { Covered: 'covered', Thin: 'thin', 'At risk': 'risk', Orphaned: 'orphan', Unclaimed: 'open' };

function HealthGlyph({ label }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (label === 'Covered') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></svg>;
  if (label === 'Thin') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /></svg>;
  if (label === 'At risk') return <svg {...common}><path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17v.01" /></svg>;
  if (label === 'Orphaned') return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>;
  return <svg {...common} strokeDasharray="3.2 3"><circle cx="12" cy="12" r="9" /></svg>;
}

// Always carries the label as text, so the meaning never depends on color alone.
export function HealthBadge({ label }) {
  return (
    <span className={`badge badge-icon tone-${HEALTH_TONE[label]}`}>
      <HealthGlyph label={label} />
      {label}
    </span>
  );
}

const STATUS_TONE = { todo: 'todo', doing: 'open', done: 'covered', open: 'open', in_progress: 'thin', resolved: 'covered' };

export function StatusBadge({ status }) {
  return (
    <span className={`badge tone-${STATUS_TONE[status]}`}>{TASK_STATUS[status] || ISSUE_STATUS[status]}</span>
  );
}

export function LockNote({ children }) {
  return (
    <span className="lock">
      <Icons.lock />
      {children}
    </span>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return <div role="alert" className="error-note">{children}</div>;
}

export function Loading() {
  return <div className="loading" role="status">Loading…</div>;
}

// Real radio inputs, so arrow keys and focus work for free.
export function Segmented({ label, name, options, value, onChange, disabled }) {
  const id = useId();
  return (
    <div className="seg-wrap">
      <span id={id} className="field-label">{label}</span>
      <div role="radiogroup" aria-labelledby={id} className="seg" style={{ gridTemplateColumns: `repeat(${Object.keys(options).length}, minmax(0, 1fr))` }}>
        {Object.entries(options).map(([key, text]) => (
          <label key={key} className={`seg-item${value === key ? ' is-on' : ''}`}>
            <input type="radio" name={name} value={key} checked={value === key} disabled={disabled} onChange={() => onChange(key)} />
            <span>{text}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// Asks once more before anything is deleted.
export function ConfirmRow({ question, onConfirm, onCancel, busy }) {
  return (
    <div role="alertdialog" aria-label={question} className="confirm">
      <span className="confirm-q">{question}</span>
      <div className="confirm-actions">
        <button type="button" className="pill pill-danger pill-sm" onClick={onConfirm} disabled={busy}>Delete</button>
        <button type="button" className="pill pill-plain pill-sm" onClick={onCancel} disabled={busy}>Keep it</button>
      </div>
    </div>
  );
}

// Native <dialog>: focus trap, Esc, and backdrop come from the browser. CSS makes it a
// full-screen page under 900px, and a centered card or a side panel at 900px and up.
export function Modal({ title, variant = 'form', closeLabel = 'Cancel', onClose, children }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal modal-${variant}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (e.target === ref.current) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-inner">
        <header className="modal-bar">
          <button type="button" className="modal-close" onClick={onClose}>{closeLabel}</button>
          <span id={titleId} className="modal-title">{title}</span>
          <span className="modal-spacer" aria-hidden="true" />
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function FormHead({ title, subtitle }) {
  return (
    <div className="form-head">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}
