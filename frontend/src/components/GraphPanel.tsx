import { EDGE_TYPE_CONFIG } from "../lib/memoryConfig";
import type { GraphSnapshot } from "../types";

interface GraphPanelProps {
  snapshot: GraphSnapshot | null;
}

export function GraphPanel({ snapshot }: GraphPanelProps) {
  if (!snapshot) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <div className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted animate-pulse">
          Loading knowledge graph
        </div>
      </div>
    );
  }

  const topicCount = snapshot.nodes.length;
  const memoryCount = snapshot.memories.length;
  const edgeCount = snapshot.edges.length;

  if (topicCount === 0 && memoryCount === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-bg text-sm text-muted">
        Your knowledge graph will appear here
      </div>
    );
  }

  return (
    <section className="flex h-full flex-col bg-bg p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Knowledge graph</h2>
          <p className="mt-1 text-xs text-muted">
            {topicCount} topics · {memoryCount} memories · {edgeCount} edges
          </p>
        </div>
        <span className="rounded-md border border-accent/30 bg-accent/10 px-2 py-1 text-xs text-accent">
          D3 in Phase 3
        </span>
      </div>

      <div className="mt-4 grid flex-1 grid-cols-2 gap-3 overflow-hidden">
        <div className="min-h-0 rounded-md border border-border bg-surface p-3">
          <h3 className="text-xs font-semibold uppercase text-muted">Topics</h3>
          <div className="mt-2 max-h-full space-y-2 overflow-y-auto pr-1">
            {snapshot.nodes.slice(0, 6).map((node) => (
              <div key={node.id} className="text-xs leading-5">
                <div className="font-medium text-white">{node.label}</div>
                <div className="line-clamp-2 text-muted">{node.summary}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="min-h-0 rounded-md border border-border bg-surface p-3">
          <h3 className="text-xs font-semibold uppercase text-muted">
            Edge types
          </h3>
          <div className="mt-3 space-y-2">
            {Object.entries(EDGE_TYPE_CONFIG).map(([type, config]) => (
              <div key={type} className="flex items-center gap-2 text-xs">
                <span
                  className="h-0.5 w-8"
                  style={{
                    backgroundColor: config.color,
                    borderTop:
                      config.dash === "none"
                        ? undefined
                        : `2px dashed ${config.color}`,
                  }}
                />
                <span className="text-muted">{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
