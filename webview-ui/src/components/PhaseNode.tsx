import type { ReactNode } from "react";

interface PhaseNodeProps {
  label: string;
  active?: boolean;
  completed?: boolean;
  children?: ReactNode;
}

export function PhaseNode({ label, active, completed, children }: PhaseNodeProps) {
  const dotClass = completed ? "phase-dot completed" : active ? "phase-dot active" : "phase-dot";

  return (
    <div className="phase-node">
      <div className="phase-header">
        <div className={dotClass} />
        <span className="phase-label">{label}</span>
      </div>
      {children && <div className="phase-content">{children}</div>}
    </div>
  );
}
