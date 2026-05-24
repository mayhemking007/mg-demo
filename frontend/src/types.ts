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
  subject: string;
  predicate: string;
  value: string;
  confidence: number;
  topicNodeId: string;
  decayed: boolean;
  supersededBy: string | null;
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

export interface GraphSnapshot {
  sessionId: string;
  nodes: TopicNode[];
  edges: TopicEdge[];
  memories: MemoryNode[];
  capturedAt: string;
}

export interface ChatResponse {
  response: string;
  snapshot: GraphSnapshot;
  remaining: number;
  resetAt: string;
}
