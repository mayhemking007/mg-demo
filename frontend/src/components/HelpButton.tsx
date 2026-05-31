import { useState } from "react";

interface HelpButtonProps {
  pulse: boolean;
  onClick: () => void;
}

export function HelpButton({ pulse, onClick }: HelpButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`flex h-9 items-center gap-2 rounded-full border border-accent/60 bg-accent/10 px-3 text-sm font-semibold text-accent transition hover:bg-accent/20 ${
          pulse ? "animate-pulse shadow-[0_0_20px_rgba(88,166,255,0.45)]" : ""
        }`}
        aria-label="Open playground help"
      >
        <span className="grid h-5 w-5 place-items-center rounded-full border border-accent/50 text-xs font-bold leading-none">
          ?
        </span>
        <span className="hidden sm:inline">How it works</span>
      </button>
      {hovered ? (
        <div className="absolute left-1/2 top-10 z-20 w-44 -translate-x-1/2 rounded-md border border-border bg-surface px-2 py-1.5 text-center text-[11px] font-medium text-muted shadow-xl">
          Click to know how it works
        </div>
      ) : null}
    </div>
  );
}
