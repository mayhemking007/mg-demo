export interface Message {
  role: "user" | "assistant";
  content: string;
  recalledFacts?: RecalledFact[];
}

export interface RecalledFact {
  subject: string;
  predicate: string;
  value: string;
  similarity: number;
  memoryType: string;
}

export interface MemoryNode {
  id: string;
  memoryType: "fact" | "insight" | "question" | "task" | "reference";
  sourceType?: "conversation" | "note" | "document" | "code";
  subject: string;
  predicate: string;
  value: string;
  confidence: number;
  topicNodeId: string;
  decayed: boolean;
  supersededBy: string | null;
  hasConflict?: boolean;
}

export interface TopicNode {
  id: string;
  label: string;
  summary: string;
  topicOrder: number;
  driftScore: number;
}

export interface TopicEdge {
  srcId: string;
  dstId: string;
  weight: number;
  type: "semantic" | "temporal" | "grafted" | "reentry";
}

export interface MemoryEdge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: "semantic" | "conflicts" | "updates" | "related";
  weight: number;
  createdAt: string;
}

export interface GraftOrigin {
  sourceSessionId: string;
  sourceNodeId: string;
  graftedAt: string;
}

export interface GraphSnapshotNode {
  node: TopicNode;
  graftOrigin?: GraftOrigin;
}

export interface GraphSnapshot {
  sessionId: string;
  nodes: TopicNode[];
  snapshotNodes?: GraphSnapshotNode[];
  edges: TopicEdge[];
  memories: MemoryNode[];
  memoryEdges?: MemoryEdge[];
  capturedAt: string;
}

export interface ChatResponse {
  response: string;
  snapshot: GraphSnapshot;
  remaining: number;
  resetAt: string;
}

export interface DetectedMemoryNode {
  id: string;
  topicNodeId: string;
  memoryType: MemoryNode["memoryType"];
  subject: string;
  predicate: string;
  value: string;
}

export interface DetectedMemoryRelation {
  source: DetectedMemoryNode;
  target: DetectedMemoryNode;
  edgeType: MemoryEdge["edgeType"];
}

export interface DetectedSummary {
  decayed: DetectedMemoryNode[];
  conflicts: DetectedMemoryRelation[];
  versions: DetectedMemoryRelation[];
}

export interface MaintenanceResponse {
  snapshot: GraphSnapshot;
  detected: DetectedSummary;
}
