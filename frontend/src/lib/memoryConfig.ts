export const MEMORY_TYPE_CONFIG = {
  fact: {
    label: "Fact",
    color: "text-accent border-accent/30 bg-accent/10",
    dot: "bg-accent",
    graphColor: "#58a6ff",
  },
  task: {
    label: "Task",
    color: "text-warning border-warning/30 bg-warning/10",
    dot: "bg-warning",
    graphColor: "#d29922",
  },
  question: {
    label: "Question",
    color: "text-purple-400 border-purple-400/30 bg-purple-400/10",
    dot: "bg-purple-400",
    graphColor: "#bc8cff",
  },
  insight: {
    label: "Insight",
    color: "text-success border-success/30 bg-success/10",
    dot: "bg-success",
    graphColor: "#3fb950",
  },
  reference: {
    label: "Reference",
    color: "text-muted border-border bg-surface",
    dot: "bg-muted",
    graphColor: "#8b949e",
  },
} as const;

export const EDGE_TYPE_CONFIG = {
  temporal: { color: "#58a6ff", dash: "none", label: "Temporal" },
  semantic: { color: "#3fb950", dash: "4,4", label: "Semantic" },
  reentry: { color: "#d29922", dash: "none", label: "Reentry" },
  grafted: { color: "#bc8cff", dash: "4,4", label: "Grafted" },
} as const;
