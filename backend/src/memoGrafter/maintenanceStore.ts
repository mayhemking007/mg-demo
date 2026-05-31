import type {
  CrawlerMaintenanceStore,
  MemoryEdge,
  MemoryNode,
} from "memo-grafter";
import type { HydratedMemoGrafterAgent } from "./sessionHydration.js";

export function createSessionMaintenanceStore(
  agent: HydratedMemoGrafterAgent,
  sessionId: string,
): CrawlerMaintenanceStore {
  const store = agent.core.store;

  return {
    listMemoryNodesForMaintenance: () => store.getMemoriesBySession(sessionId),
    markMemoryNodesConflicting: (memoryNodeIds) =>
      store.markMemoryNodesConflicting(memoryNodeIds),
    markMemoryNodeSuperseded: (memoryNodeId, supersededBy) =>
      store.markMemoryNodeSuperseded(memoryNodeId, supersededBy),
    markMemoryNodeDecayed: (memoryNodeId) =>
      store.markMemoryNodeDecayed(memoryNodeId),
    updateMemoryNodeConfidence: store.updateMemoryNodeConfidence
      ? (memoryNodeId, confidence) =>
          store.updateMemoryNodeConfidence!(memoryNodeId, confidence)
      : undefined,
    upsertMemoryEdge: (edge) => store.upsertMemoryEdge(edge),
  };
}

export async function getSessionMaintenanceState(
  agent: HydratedMemoGrafterAgent,
  sessionId: string,
): Promise<{ memories: MemoryNode[]; memoryEdges: MemoryEdge[] }> {
  const [memories, memoryEdges] = await Promise.all([
    agent.core.store.getMemoriesBySession(sessionId),
    agent.core.store.getMemoryEdgesBySession(sessionId),
  ]);
  const memoryIds = new Set(memories.map((memory) => memory.id));

  return {
    memories,
    memoryEdges: memoryEdges.filter(
      (edge) => memoryIds.has(edge.sourceId) && memoryIds.has(edge.targetId),
    ),
  };
}
