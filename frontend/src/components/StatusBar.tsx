interface StatusBarProps {
  remaining: number;
  limit: number;
}

export function StatusBar({ remaining, limit }: StatusBarProps) {
  const statusColor =
    remaining === 0
      ? "text-danger"
      : remaining <= 3
        ? "text-warning"
        : "text-success";

  return (
    <header className="h-12 shrink-0 border-b border-border bg-bg px-4">
      <div className="flex h-full items-center justify-between gap-4">
        <div className="min-w-0 text-sm font-semibold text-white">
          Developer Memory Assistant
        </div>
        <div className="hidden items-center gap-2 text-xs text-muted sm:flex">
          <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_12px_rgba(63,185,80,0.6)]" />
          <span>Active session</span>
        </div>
        <div className={`shrink-0 text-right text-xs font-medium ${statusColor}`}>
          {remaining}/{limit} messages today
        </div>
      </div>
    </header>
  );
}
