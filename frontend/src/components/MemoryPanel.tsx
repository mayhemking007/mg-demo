import { MEMORY_TYPE_CONFIG } from "../lib/memoryConfig";
import type { MemoryNode } from "../types";

interface MemoryPanelProps {
  memories: MemoryNode[];
}

const MEMORY_TYPES: MemoryNode["memoryType"][] = [
  "fact",
  "task",
  "question",
  "insight",
  "reference",
];

export function MemoryPanel({ memories }: MemoryPanelProps) {
  if (memories.length === 0) {
    return (
      <div className="flex h-full min-h-36 items-center justify-center text-center text-sm text-muted">
        No memories yet. Start a conversation to build your knowledge graph.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {MEMORY_TYPES.map((type) => {
        const items = memories.filter((memory) => memory.memoryType === type);
        const config = MEMORY_TYPE_CONFIG[type];

        if (items.length === 0) {
          return null;
        }

        return (
          <section key={type}>
            <div
              className={`mb-2 inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-semibold ${config.color}`}
            >
              <span className={`h-2 w-2 rounded-full ${config.dot}`} />
              {config.label}
              <span className="text-muted">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((memory) => {
                const confidence = Math.round(memory.confidence * 100);

                return (
                  <article
                    key={memory.id}
                    className={`rounded-md border border-border bg-surface p-3 ${
                      memory.decayed ? "opacity-40" : ""
                    }`}
                  >
                    <div className="text-sm leading-6 text-white">
                      <span className="font-medium">{memory.subject}</span>
                      <span className="px-1 text-muted">·</span>
                      <span className="text-muted">{memory.predicate}</span>
                      <span className="px-1 text-muted">·</span>
                      <span className={memory.decayed ? "line-through" : ""}>
                        {memory.value}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                        <div
                          className={`h-full rounded-full ${config.dot}`}
                          style={{ width: `${confidence}%` }}
                        />
                      </div>
                      <span className="w-9 text-right text-[11px] text-muted">
                        {confidence}%
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
