import { Link, useSearchParams } from 'react-router-dom';
import { COMMUNITY_NAME } from '../firebase.config.js';
import { useAuth } from '../lib/auth.jsx';
import { useData } from '../lib/data.jsx';
import { isISODate, isMonthKey, isOverdue, monthDays, parseLocal, shiftMonth, todayISO } from '../lib/dates.js';
import { TopBar } from '../components/Layout.jsx';
import { taskPath } from '../components/cards.jsx';
import { Icons, StatusBadge } from '../components/ui.jsx';

// Jan 1 2023 was a Sunday, so these come out Sun to Sat in the viewer's language.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i));

const FINISHED = new Set(['done', 'resolved']);

function chipTone(entry) {
  if (isOverdue(entry.item)) return 'tone-risk';
  if (FINISHED.has(entry.item.status)) return 'tone-todo is-finished';
  return entry.kind === 'issue' ? 'tone-open' : 'tone-todo';
}

// Every dated issue and task, grouped by day. Tasks of a deleted issue are skipped, since nobody can open them.
function useDueEntries() {
  const { issues, tasks } = useData();
  const issueById = new Map(issues.map((i) => [i.id, i]));
  const byDay = new Map();
  let undated = 0;
  const add = (day, entry) => {
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(entry);
  };
  for (const issue of issues) {
    if (issue.dueDate) add(issue.dueDate, { kind: 'issue', item: issue, to: `/issues/${issue.id}` });
    else undated += 1;
  }
  for (const task of tasks) {
    const issue = issueById.get(task.issueId);
    if (!issue) continue;
    if (task.dueDate) add(task.dueDate, { kind: 'task', item: task, issue, to: taskPath(task) });
    else undated += 1;
  }
  return { byDay, undated };
}

function DayCell({ day, entries, inMonth, isToday, isSelected, onSelect }) {
  const date = parseLocal(day);
  const label = date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
    + (entries.length ? `, ${entries.length} due` : '');
  return (
    <button
      type="button"
      className={`cal-day${inMonth ? '' : ' is-out'}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
      aria-pressed={isSelected}
      aria-label={label}
      onClick={() => onSelect(day)}
    >
      <span className="cal-num">{date.getDate()}</span>
      {entries.length > 0 && (
        <>
          <span className="cal-items" aria-hidden="true">
            {entries.slice(0, 3).map((e) => (
              <span key={`${e.kind}-${e.item.id}`} className={`cal-chip ${chipTone(e)}`}>{e.item.title}</span>
            ))}
            {entries.length > 3 && <span className="cal-more">+{entries.length - 3} more</span>}
          </span>
          <span className="cal-dots" aria-hidden="true">
            {entries.slice(0, 3).map((e) => <span key={`${e.kind}-${e.item.id}`} className={`cal-dot ${chipTone(e)}`} />)}
          </span>
        </>
      )}
    </button>
  );
}

function AgendaRow({ entry }) {
  const { user } = useAuth();
  const { nameOf } = useData();
  const { kind, item, issue, to } = entry;
  const who = (id) => (id === user.uid ? 'you' : nameOf(id));
  const detail = kind === 'issue'
    ? `Owner: ${who(item.ownerId)}`
    : `Part of ${issue.title} · ${item.assigneeId ? `Assigned to ${who(item.assigneeId)}` : 'No one yet'}`;
  return (
    <li>
      <Link to={to} className="card agenda-row">
        <span className="row-badges">
          <span className={`badge ${kind === 'issue' ? 'tone-open' : 'tone-todo'}`}>{kind === 'issue' ? 'Issue' : 'Task'}</span>
          <StatusBadge status={item.status} />
          {isOverdue(item) && <span className="badge tone-risk">Overdue</span>}
        </span>
        <h3>{item.title}</h3>
        <span className="muted">{detail}</span>
      </Link>
    </li>
  );
}

export default function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const { byDay, undated } = useDueEntries();
  const today = todayISO();
  const selected = isISODate(params.get('d')) ? params.get('d') : today;
  const month = isMonthKey(params.get('m')) ? params.get('m') : selected.slice(0, 7);
  const days = monthDays(month);

  const select = (day) => setParams({ m: day.slice(0, 7), d: day }, { replace: true });
  // Moving to another month selects today if it's in view, otherwise the 1st.
  const showMonth = (key) => select(today.startsWith(key) ? today : `${key}-01`);

  const monthTitle = parseLocal(`${month}-01`).toLocaleDateString([], { month: 'long', year: 'numeric' });
  const selectedDate = parseLocal(selected).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const dayEntries = byDay.get(selected) || [];

  return (
    <>
      <TopBar>Calendar</TopBar>
      <section className="hero enter">
        <p className="eyebrow">{COMMUNITY_NAME}</p>
        <h1 className="display">Calendar.</h1>
        <p className="lede">Every issue and task with a due date. Select a day to see what's due.</p>
      </section>

      <section className="band band-alt" aria-label="Calendar">
        <div className="band-inner">
          <div className="cal-head">
            <h2 className="cal-title" aria-live="polite">{monthTitle}</h2>
            <button type="button" className="cal-nav" aria-label="Previous month" onClick={() => showMonth(shiftMonth(month, -1))}><Icons.chevronLeft /></button>
            <button type="button" className="pill pill-plain pill-sm" onClick={() => select(today)}>Today</button>
            <button type="button" className="cal-nav" aria-label="Next month" onClick={() => showMonth(shiftMonth(month, 1))}><Icons.chevron /></button>
          </div>

          <div className="cal-grid">
            {WEEKDAYS.map((d) => (
              <span key={d.getDay()} className="cal-wd" aria-hidden="true">
                {d.toLocaleDateString([], { weekday: 'short' })}
              </span>
            ))}
            {days.map((day) => (
              <DayCell
                key={day}
                day={day}
                entries={byDay.get(day) || []}
                inMonth={day.startsWith(month)}
                isToday={day === today}
                isSelected={day === selected}
                onSelect={select}
              />
            ))}
          </div>

          <div className="cal-agenda">
            <h2 className="headline-sm">{selected === today ? `Today, ${selectedDate}` : selectedDate}.</h2>
            {dayEntries.length ? (
              <ul className="agenda">
                {dayEntries.map((e) => <AgendaRow key={`${e.kind}-${e.item.id}`} entry={e} />)}
              </ul>
            ) : (
              <p className="empty">Nothing is due {selected === today ? 'today' : 'this day'}.</p>
            )}
            {undated > 0 && (
              <p className="muted-sm">
                {undated} {undated === 1 ? 'issue or task has' : 'issues and tasks have'} no due date, so {undated === 1 ? "it isn't" : "they aren't"} on the calendar.
              </p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
