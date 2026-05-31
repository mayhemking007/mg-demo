import type { DetectedMemoryNode, DetectedSummary, TopicNode } from "../types";
import { getTopicDisplayNumberById } from "./GraphPanel";

interface DetectedPanelProps {
  detected: DetectedSummary | null;
  topics: TopicNode[];
}

function truncate(value: string, maxLength = 58): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function getNodeLabel(
  memory: DetectedMemoryNode,
  topicDisplayNumberById: Map<string, number>,
): string {
  return `Node ${topicDisplayNumberById.get(memory.topicNodeId) ?? "?"}`;
}

export function DetectedPanel({ detected, topics }: DetectedPanelProps) {
  const topicDisplayNumberById = getTopicDisplayNumberById(topics);
  const hasResults = Boolean(
    detected &&
      (detected.decayed.length > 0 ||
        detected.conflicts.length > 0 ||
        detected.versions.length > 0),
  );

  if (!detected) {
    return null;
  }

  return (
    <div className="absolute bottom-3 left-3 max-h-48 w-72 overflow-hidden rounded-md border border-border bg-surface/95 px-3 py-2 shadow-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase text-white">
          Detected
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>

      {hasResults ? (
        <div className="max-h-36 space-y-2 overflow-y-auto pr-1 text-[11px] leading-4 text-muted">
          {detected.conflicts.length > 0 ? (
            <section>
              <div className="mb-1 font-semibold text-danger">Conflicts</div>
              <div className="space-y-1">
                {detected.conflicts.map((conflict) => (
                  <div key={`${conflict.source.id}:${conflict.target.id}`}>
                    {getNodeLabel(conflict.source, topicDisplayNumberById)} {"<->"}{" "}
                    {getNodeLabel(conflict.target, topicDisplayNumberById)} -{" "}
                    {truncate(conflict.source.subject)}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {detected.decayed.length > 0 ? (
            <section>
              <div className="mb-1 font-semibold text-muted">Decay</div>
              <div className="space-y-1">
                {detected.decayed.map((memory) => (
                  <div key={memory.id}>
                    {getNodeLabel(memory, topicDisplayNumberById)} -{" "}
                    {truncate(memory.value)}
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {detected.versions.length > 0 ? (
            <section>
              <div className="mb-1 font-semibold text-warning">Versions</div>
              <div className="space-y-1">
                {detected.versions.map((version) => (
                  <div key={`${version.source.id}:${version.target.id}`}>
                    <div>
                      {getNodeLabel(version.source, topicDisplayNumberById)} updates{" "}
                      {getNodeLabel(version.target, topicDisplayNumberById)}
                    </div>
                    <div className="text-warning">
                      New: {truncate(version.source.value, 48)}
                    </div>
                    <div>Old: {truncate(version.target.value, 48)}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="text-[11px] leading-4 text-muted">
          No decay, conflicts, or versions detected.
        </div>
      )}
    </div>
  );
}
