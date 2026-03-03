import { useEffect, useState, useCallback, useRef } from "react";
import type { SessionMeta, SessionEvent, ExtToWebviewMessage } from "../types";

// VSCode webview か standalone browser かを判定
const IS_VSCODE = typeof (globalThis as Record<string, unknown>)["acquireVsCodeApi"] === "function";

const vscode = IS_VSCODE
  ? (globalThis as Record<string, unknown>)["acquireVsCodeApi"] as () => { postMessage(msg: unknown): void }
  : null;

const vsApi = IS_VSCODE && vscode ? (vscode as () => { postMessage(msg: unknown): void })() : null;

export function useSessionEvents() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeSessionId;

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setEvents([]);
    if (vsApi) {
      vsApi.postMessage({ type: "load_session", sessionId });
    } else {
      fetch(`/api/sessions/${sessionId}`)
        .then((r) => r.json())
        .then((evts: SessionEvent[]) => setEvents(evts))
        .catch(console.error);
    }
  }, []);

  const refresh = useCallback(() => {
    if (vsApi) {
      vsApi.postMessage({ type: "refresh_sessions" });
    } else {
      fetch("/api/sessions")
        .then((r) => r.json())
        .then((s: SessionMeta[]) => setSessions(s))
        .catch(console.error);
    }
  }, []);

  useEffect(() => {
    function dispatch(msg: ExtToWebviewMessage) {
      switch (msg.type) {
        case "session_list":
          setSessions(msg.sessions);
          if (!activeRef.current && msg.sessions.length > 0) {
            const active = msg.sessions.find((s) => !s.completed) ?? msg.sessions[0];
            selectSession(active.sessionId);
          }
          break;
        case "session_loaded":
          if (msg.sessionId === activeRef.current) {
            setEvents(msg.events);
          }
          break;
        case "session_event":
          if (msg.sessionId === activeRef.current) {
            setEvents((prev) => [...prev, msg.event]);
          }
          if (msg.event.type === "session_start") {
            // 新しいセッション開始 → 自動切り替え
            setActiveSessionId(msg.sessionId);
            setEvents([msg.event]);
          }
          break;
      }
    }

    if (vsApi) {
      // VSCode webview モード
      const handler = (e: MessageEvent<ExtToWebviewMessage>) => dispatch(e.data);
      window.addEventListener("message", handler);
      vsApi.postMessage({ type: "webview_ready" });
      return () => window.removeEventListener("message", handler);
    } else {
      // Standalone ブラウザモード: SSE
      const es = new EventSource("/api/events");
      es.onmessage = (e) => {
        try { dispatch(JSON.parse(e.data)); } catch { /* ignore */ }
      };
      return () => es.close();
    }
  }, [selectSession]);

  return { sessions, activeSessionId, events, selectSession, refresh };
}
