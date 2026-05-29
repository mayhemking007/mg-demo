import {
  MemoGrafterAgent,
  OpenAIEmbedAdapter,
  OpenAILLMAdapter,
  type GraftRegistryEntry,
  type GraphSnapshot,
  type Message,
  type TopicNode,
} from "memo-grafter";

const sessions = new Map<string, MemoGrafterAgent>();
const EDGE_DISPLAY_PRIORITY: Record<string, number> = {
  grafted: 4,
  semantic: 3,
  reentry: 2,
  temporal: 1,
};

interface AgentInternals {
  sessionId: string;
  history: Message[];
  pendingIngest: Promise<void>;
  core: {
    store: {
      getBufferMessages(
        sessionId: string,
        start: number,
        end: number,
        maxChars?: number,
      ): Promise<Message[]>;
    };
  };
}

export async function getOrCreateAgent(
  sessionId: string,
): Promise<MemoGrafterAgent> {
  if (sessions.has(sessionId)) {
    return sessions.get(sessionId)!;
  }

  const agent = new MemoGrafterAgent({
    db: {
      connectionString: process.env.DATABASE_URL!,
    },
    llm: new OpenAILLMAdapter("gpt-4o"),
    embedder: new OpenAIEmbedAdapter("text-embedding-3-small"),
    systemPrompt: `You are MemoGrafter Playground, a conversational memory
assistant for exploring how memories become a knowledge graph. Help people
remember and reflect on music, food, films, preferences, plans, questions, and
small personal notes. Be concise and precise. When the person mentions a useful
fact, preference, question, reference, task, or insight, acknowledge it clearly
so they know it has been remembered.`,
    drift: {
      mode: "intent",
      driftSensitivity: "high",
      minSegmentMessages: 3,
      reentryDetection: true,
    },
    inject: {
      tokenBudget: 4000,
      recentWindowSize: 20,
      recallLimit: 6,
      recallMinSimilarity: 0.45,
    },
  });

  const internals = agent as unknown as AgentInternals;
  internals.sessionId = sessionId;
  await agent.initialize();
  internals.history = await internals.core.store.getBufferMessages(
    sessionId,
    0,
    1000,
    4000,
  );
  sessions.set(sessionId, agent);
  return agent;
}

export async function closeAgent(sessionId: string): Promise<void> {
  const agent = sessions.get(sessionId);

  if (agent) {
    await agent.close();
    sessions.delete(sessionId);
  }
}

export async function graftTopicsWithMemories(
  sourceSessionId: string,
  targetSessionId: string,
  topicIds: string[],
): Promise<TopicNode[]> {
  const sourceAgent = await getOrCreateAgent(sourceSessionId);
  const targetAgent = await getOrCreateAgent(targetSessionId);

  return targetAgent.absorbFromAgent(sourceAgent, { topicIds });
}

export async function clearPersistedSession(sessionId: string): Promise<void> {
  const agent = await getOrCreateAgent(sessionId);

  await agent.clearSession();
  await agent.close();
  sessions.delete(sessionId);
}

export async function getSessionHistory(sessionId: string): Promise<Message[]> {
  const agent = (await getOrCreateAgent(sessionId)) as unknown as AgentInternals;
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

export async function getPersistedSnapshot(
  sessionId: string,
): Promise<GraphSnapshot> {
  const agent = await getOrCreateAgent(sessionId);
  const [snapshot, registry] = await Promise.all([
    agent.getGraphSnapshot(),
    agent.getGraftRegistry(),
  ]);
  const graftedSources = createGraftedSourceMap(registry);

  return {
    ...snapshot,
    sessionId,
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

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;

  for (let index = 0; index < a.length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    dot += av * bv;
    aMagnitude += av * av;
    bMagnitude += bv * bv;
  }

  if (aMagnitude === 0 || bMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(aMagnitude) * Math.sqrt(bMagnitude));
}
