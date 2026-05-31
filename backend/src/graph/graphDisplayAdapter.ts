import type { GraftRegistryEntry, GraphSnapshot } from "memo-grafter";
import { cosineSimilarity } from "./similarity.js";

const EDGE_DISPLAY_PRIORITY: Record<string, number> = {
  grafted: 4,
  semantic: 3,
  reentry: 2,
  temporal: 1,
};

export function createSessionLocalDisplaySnapshot(
  snapshot: GraphSnapshot,
  registry: GraftRegistryEntry[],
): GraphSnapshot {
  const graftedSources = createGraftedSourceMap(registry);

  return {
    ...snapshot,
    edges: createDisplayEdges(snapshot.nodes, snapshot.edges, graftedSources),
    capturedAt: new Date().toISOString(),
  };
}

function createGraftedSourceMap(
  registry: GraftRegistryEntry[],
): Map<string, string> {
  return new Map(
    registry.map((entry) => [entry.nodeId, entry.sourceNodeId] as const),
  );
}

function createDisplayEdges(
  nodes: GraphSnapshot["nodes"],
  edges: GraphSnapshot["edges"],
  graftedSources: Map<string, string>,
): GraphSnapshot["edges"] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edgeByPair = new Map<string, GraphSnapshot["edges"][number]>();

  for (const [graftedNodeId] of graftedSources) {
    const graftedNode = nodeById.get(graftedNodeId);

    if (!graftedNode) {
      continue;
    }

    const closestNode = findClosestTopic(graftedNode, nodes);
    if (!closestNode) {
      continue;
    }

    upsertDisplayEdge(edgeByPair, {
      srcId: graftedNode.id,
      dstId: closestNode.id,
      weight: cosineSimilarity(graftedNode.embedding, closestNode.embedding),
      type: "grafted",
    });
  }

  for (const edge of edges) {
    if (edge.type !== "grafted") {
      if (nodeById.has(edge.srcId) && nodeById.has(edge.dstId)) {
        upsertDisplayEdge(edgeByPair, edge);
      }
      continue;
    }

    const localNode = nodeById.get(edge.srcId);
    if (!localNode) {
      continue;
    }

    const closestNode = findClosestTopic(localNode, nodes);
    if (!closestNode) {
      continue;
    }

    upsertDisplayEdge(edgeByPair, {
      srcId: localNode.id,
      dstId: closestNode.id,
      weight: cosineSimilarity(localNode.embedding, closestNode.embedding),
      type: "grafted",
    });
  }

  return [...edgeByPair.values()];
}

function upsertDisplayEdge(
  edgeByPair: Map<string, GraphSnapshot["edges"][number]>,
  edge: GraphSnapshot["edges"][number],
): void {
  const pairKey = createPairKey(edge.srcId, edge.dstId);
  const existing = edgeByPair.get(pairKey);

  if (!existing || edgePriority(edge) > edgePriority(existing)) {
    edgeByPair.set(pairKey, edge);
  }
}

function createPairKey(srcId: string, dstId: string): string {
  return [srcId, dstId].sort().join(":");
}

function edgePriority(edge: GraphSnapshot["edges"][number]): number {
  return EDGE_DISPLAY_PRIORITY[edge.type] ?? 0;
}

function findClosestTopic(
  source: GraphSnapshot["nodes"][number],
  nodes: GraphSnapshot["nodes"],
): GraphSnapshot["nodes"][number] | null {
  let closest: GraphSnapshot["nodes"][number] | null = null;
  let closestScore = -Infinity;

  for (const candidate of nodes) {
    if (candidate.id === source.id) {
      continue;
    }

    const score = cosineSimilarity(source.embedding, candidate.embedding);
    if (score > closestScore) {
      closest = candidate;
      closestScore = score;
    }
  }

  return closest;
}
