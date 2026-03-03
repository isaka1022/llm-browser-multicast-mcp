import { useSessionEvents } from "./hooks/useSessionEvents";
import { SessionList } from "./components/SessionList";
import { Timeline } from "./components/Timeline";
import "./styles/timeline.css";

export default function App() {
  const { sessions, activeSessionId, events, selectSession, refresh } =
    useSessionEvents();

  return (
    <div className="app">
      <SessionList
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={selectSession}
        onRefresh={refresh}
      />
      <div className="main-content">
        {events.length > 0 ? (
          <Timeline events={events} />
        ) : (
          <div className="empty-state">
            <p>Select a session or start a new discussion</p>
          </div>
        )}
      </div>
    </div>
  );
}
