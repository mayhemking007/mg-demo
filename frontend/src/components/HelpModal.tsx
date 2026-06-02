import { useEffect, useState } from "react";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const HELP_CARDS = [
  {
    title: "Two Sessions",
    body: "Chat in Session A and Session B separately. Each side builds its own memory graph.",
  },
  {
    title: "Memory Graph",
    body: "Messages become topic nodes, memory nodes, and relationship edges as memo-grafter ingests the conversation.",
  },
  {
    title: "Grafting",
    body: "Click a topic node, then graft it into the other session. The target session can use that memory later.",
  },
  {
    title: "Maintenance",
    body: "After enough topics exist, run maintenance to detect conflicts, decay, and version updates in the graph.",
  },
  {
    title: "Conflicts And Versions",
    body: "A conflict edge means two active memories disagree and need clarification. A version edge means a newer memory has replaced an older one.",
  },
  {
    title: "What To Try",
    body: "Use Auto generate to create sample memories, or type changing preferences to see updates and conflicts appear.",
  },
];

export function HelpModal({ open, onClose }: HelpModalProps) {
  const [index, setIndex] = useState(0);
  const card = HELP_CARDS[index];
  const isLast = index === HELP_CARDS.length - 1;

  useEffect(() => {
    if (!open) {
      return;
    }

    setIndex(0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open || !card) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 px-4 backdrop-blur-sm"
      onMouseDown={onClose}
      role="presentation"
    >
      <section
        className="w-full max-w-md rounded-md border border-border bg-surface p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase text-muted">
              How it works
            </div>
            <h2 id="help-title" className="mt-1 text-xl font-bold text-white">
              {card.title}
            </h2>
          </div>
          <div className="rounded-md border border-border px-2 py-1 text-xs text-muted">
            {index + 1} / {HELP_CARDS.length}
          </div>
        </div>

        <p className="min-h-24 text-sm leading-6 text-muted">{card.body}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted transition hover:border-danger/60 hover:text-danger"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted transition hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() =>
                isLast ? onClose() : setIndex((value) => value + 1)
              }
              className="rounded-md border border-accent/50 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent transition hover:bg-accent/20"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
