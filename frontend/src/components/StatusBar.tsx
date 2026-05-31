import { useCallback, useState } from "react";
import { hasSeenHelp, markHelpSeen } from "../lib/helpState";
import { HelpButton } from "./HelpButton";
import { HelpModal } from "./HelpModal";

interface StatusBarProps {
  remaining: number;
  limit: number;
  rateLimitEnabled: boolean;
}

export function StatusBar({
  remaining,
  limit,
  rateLimitEnabled,
}: StatusBarProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpSeen, setHelpSeen] = useState(hasSeenHelp);
  const statusColor =
    remaining === 0
      ? "text-danger"
      : remaining <= 3
        ? "text-warning"
        : "text-success";

  const openHelp = useCallback(() => {
    markHelpSeen();
    setHelpSeen(true);
    setHelpOpen(true);
  }, []);

  return (
    <header className="h-16 shrink-0 border-b border-border bg-bg px-5">
      <div className="grid h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
        <div className="min-w-0">
          <div className="barriecito-memografter text-4xl leading-none tracking-wide text-[#e6edf3]">
            MemoGrafter Playground
          </div>
          <div className="mt-1 h-1 w-24 rounded-full bg-[#bc8cff]" />
        </div>
        <div className="justify-self-center">
          <HelpButton pulse={!helpSeen} onClick={openHelp} />
        </div>
        <div className="justify-self-end">
          <div
            className={`rounded-full border border-border bg-surface px-3 py-1.5 text-right text-xs font-semibold ${statusColor}`}
          >
            {rateLimitEnabled
              ? `${remaining}/${limit} messages today`
              : "Message limit off"}
          </div>
        </div>
      </div>
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </header>
  );
}
