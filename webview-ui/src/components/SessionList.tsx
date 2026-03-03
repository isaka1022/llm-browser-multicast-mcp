import type { SessionMeta } from "../types";

interface SessionListProps {
  sessions: SessionMeta[];
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onRefresh: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  council: "\u{1f3db}",
  roundtable: "\u{1f5e3}",
  debate: "\u{2694}",
};

export function SessionList({ sessions, activeSessionId, onSelect, onRefresh }: SessionListProps) {
  return (
    <div className="session-list">
      <div className="session-list-header">
        <span className="session-list-title">Sessions</span>
        <button className="refresh-btn" onClick={onRefresh} title="Refresh">
          &#x21bb;
        </button>
      </div>
      {sessions.length === 0 ? (
        <div className="session-list-empty">
          No sessions yet. Run a council/roundtable/debate to see results here.
        </div>
      ) : (
        <ul className="session-items">
          {sessions.map((s) => (
            <li
              key={s.sessionId}
              className={`session-item ${s.sessionId === activeSessionId ? "active" : ""} ${s.completed ? "" : "live"}`}
              onClick={() => onSelect(s.sessionId)}
            >
              <span className="session-type-icon">
                {TYPE_ICONS[s.discussionType] ?? "\u{1f4ac}"}
              </span>
              <div className="session-item-info">
                <div className="session-item-question">
                  {s.question.slice(0, 60)}{s.question.length > 60 ? "..." : ""}
                </div>
                <div className="session-item-meta">
                  {s.discussionType} &middot; {s.models.length} models
                  {!s.completed && <span className="live-indicator"> &middot; LIVE</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
