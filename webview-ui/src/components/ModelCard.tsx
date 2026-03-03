import { useState } from "react";
import { StatusBadge } from "./StatusBadge";

// Consistent color per model name
const MODEL_COLORS = [
  "#4fc3f7", "#81c784", "#ffb74d", "#f06292",
  "#ba68c8", "#4dd0e1", "#aed581", "#ff8a65",
];

function getModelColor(model: string): string {
  let hash = 0;
  for (const ch of model) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  return MODEL_COLORS[Math.abs(hash) % MODEL_COLORS.length];
}

function getModelShortName(model: string): string {
  // "gemini-cli/default" → "gemini-cli"
  return model.split("/")[0];
}

interface ModelCardProps {
  model: string;
  content?: string;
  durationMs?: number;
  status: "thinking" | "done" | "error";
  error?: string;
  role?: "participant" | "chairman";
}

export function ModelCard({ model, content, durationMs, status, error, role }: ModelCardProps) {
  const [expanded, setExpanded] = useState(false);
  const color = getModelColor(model);
  const shortName = getModelShortName(model);

  const displayContent = content ?? error ?? "";
  const preview = displayContent.slice(0, 120) + (displayContent.length > 120 ? "..." : "");

  return (
    <div
      className={`model-card ${status}`}
      style={{ borderLeftColor: color }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="model-card-header">
        <span className="model-avatar" style={{ backgroundColor: color }}>
          {role === "chairman" ? "\u{1f451}" : shortName[0].toUpperCase()}
        </span>
        <span className="model-name">{shortName}</span>
        {durationMs != null && (
          <span className="model-duration">{(durationMs / 1000).toFixed(1)}s</span>
        )}
        <StatusBadge status={status} />
      </div>
      <div className={`model-card-body ${expanded ? "expanded" : ""}`}>
        {expanded ? (
          <pre className="model-content-full">{displayContent}</pre>
        ) : (
          <p className="model-content-preview">{preview}</p>
        )}
      </div>
    </div>
  );
}
