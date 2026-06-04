import {
  ConflictDetectionPass,
  DecayScoringPass,
  MemoGrafterCrawler,
  VersioningPass,
  type CrawlerReport,
  type GraphSnapshot,
  type IngestTextOptions,
  type MemoryEdge,
  type MemoryNode,
  type Message,
  type RetrievalResult,
  type TopicNode,
} from "memo-grafter";
import { createSessionLocalDisplaySnapshot } from "../graph/graphDisplayAdapter.js";
import {
  closeAgent,
  forgetAgent,
  getOrCreateAgent,
} from "./agentRegistry.js";
import { asHydratedAgent } from "./sessionHydration.js";
import {
  createSessionMaintenanceStore,
  getSessionMaintenanceState,
} from "./maintenanceStore.js";

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

export interface MaintenanceResult {
  snapshot: GraphSnapshot;
  detected: DetectedSummary;
  report: CrawlerReport;
}

export async function sendChatMessage(
  sessionId: string,
  message: string,
): Promise<{ response: string; snapshot: GraphSnapshot }> {
  const agent = await getOrCreateAgent(sessionId);
  const response = await agent.invoke(message);
  const snapshot = await getSessionSnapshot(sessionId);

  return { response, snapshot };
}

export async function recallMemories(
  sessionId: string,
  query: string,
): Promise<RetrievalResult> {
  const agent = await getOrCreateAgent(sessionId);

  return agent.recall(query, {
    limit: 8,
    minSimilarity: 0.4,
  });
}

export async function ingestPlainText(
  sessionId: string,
  text: string,
  options?: IngestTextOptions,
): Promise<GraphSnapshot> {
  const agent = await getOrCreateAgent(sessionId);

  await agent.ingestText(text, options);
  return getSessionSnapshot(sessionId);
}

export async function graftTopics(
  sourceSessionId: string,
  targetSessionId: string,
  topicIds: string[],
): Promise<{ graftedNodes: TopicNode[]; snapshot: GraphSnapshot }> {
  const sourceAgent = await getOrCreateAgent(sourceSessionId);
  const targetAgent = await getOrCreateAgent(targetSessionId);
  const graftedNodes = await targetAgent.absorbFromAgent(sourceAgent, {
    topicIds,
  });
  const snapshot = await getSessionSnapshot(targetSessionId);

  return { graftedNodes, snapshot };
}

export async function runMaintenance(
  sessionId: string,
): Promise<MaintenanceResult> {
  const agent = asHydratedAgent(await getOrCreateAgent(sessionId));
  const crawler = new MemoGrafterCrawler({
    store: createSessionMaintenanceStore(agent, sessionId),
    passes: [
      new ConflictDetectionPass(),
      new VersioningPass(),
      new DecayScoringPass({ updateConfidence: true }),
    ],
  });
  const report = await crawler.runOnce();
  const snapshot = await getSessionSnapshot(sessionId);
  const maintenanceState = await getSessionMaintenanceState(agent, sessionId);

  return {
    snapshot,
    detected: createDetectedSummary(maintenanceState),
    report,
  };
}

export async function getSessionSnapshot(
  sessionId: string,
): Promise<GraphSnapshot> {
  const agent = await getOrCreateAgent(sessionId);
  const [snapshot, registry] = await Promise.all([
    agent.getGraphSnapshot(),
    agent.getGraftRegistry(),
  ]);

  return createSessionLocalDisplaySnapshot(
    { ...snapshot, sessionId },
    registry,
  );
}

export async function clearSession(sessionId: string): Promise<void> {
  const agent = await getOrCreateAgent(sessionId);

  await agent.clearSession();
  await closeAgent(sessionId);
  forgetAgent(sessionId);
}

export async function getSessionHistory(sessionId: string): Promise<Message[]> {
  const agent = asHydratedAgent(await getOrCreateAgent(sessionId));
  const storedMessages = await agent.core.store.getBufferMessages(
    sessionId,
    0,
    1000,
    4000,
  );

  return storedMessages.filter(
    (message: Message) =>
      message.role === "user" || message.role === "assistant",
  );
}

function createDetectedSummary(input: {
  memories: MemoryNode[];
  memoryEdges: MemoryEdge[];
}): DetectedSummary {
  const memoryById = new Map(input.memories.map((memory) => [memory.id, memory]));
  const decayed = input.memories
    .filter((memory) => memory.decayed)
    .map(toDetectedMemoryNode);
  const conflicts = input.memoryEdges
    .filter(
      (edge) =>
        edge.edgeType === "conflicts" &&
        shouldIncludeDetectedRelation(edge, memoryById),
    )
    .map((edge) => toDetectedRelation(edge, memoryById))
    .filter((relation): relation is DetectedMemoryRelation =>
      Boolean(relation),
    );
  const versions = input.memoryEdges
    .filter(
      (edge) =>
        edge.edgeType === "updates" &&
        shouldIncludeDetectedRelation(edge, memoryById),
    )
    .map((edge) => toDetectedRelation(edge, memoryById))
    .filter((relation): relation is DetectedMemoryRelation =>
      Boolean(relation),
    );

  return { decayed, conflicts, versions };
}

function shouldIncludeDetectedRelation(
  edge: MemoryEdge,
  memoryById: Map<string, MemoryNode>,
): boolean {
  const source = memoryById.get(edge.sourceId);
  const target = memoryById.get(edge.targetId);

  if (!source || !target) {
    return false;
  }

  if (edge.edgeType === "conflicts") {
    return isActiveMemory(source) && isActiveMemory(target);
  }

  if (edge.edgeType === "updates") {
    return isActiveMemory(source);
  }

  return false;
}

function isActiveMemory(memory: MemoryNode): boolean {
  return !memory.decayed && !memory.supersededBy;
}

function toDetectedRelation(
  edge: MemoryEdge,
  memoryById: Map<string, MemoryNode>,
): DetectedMemoryRelation | null {
  const source = memoryById.get(edge.sourceId);
  const target = memoryById.get(edge.targetId);

  if (!source || !target) {
    return null;
  }

  return {
    source: toDetectedMemoryNode(source),
    target: toDetectedMemoryNode(target),
    edgeType: edge.edgeType,
  };
}

function toDetectedMemoryNode(memory: MemoryNode): DetectedMemoryNode {
  return {
    id: memory.id,
    topicNodeId: memory.topicNodeId,
    memoryType: memory.memoryType,
    subject: memory.subject,
    predicate: memory.predicate,
    value: memory.value,
  };
}
