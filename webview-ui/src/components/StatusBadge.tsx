interface StatusBadgeProps {
  status: "thinking" | "done" | "error";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    thinking: { label: "thinking", className: "status-thinking" },
    done: { label: "done", className: "status-done" },
    error: { label: "error", className: "status-error" },
  }[status];

  return <span className={`status-badge ${config.className}`}>{config.label}</span>;
}
