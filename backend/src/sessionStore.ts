import {
  MemoGrafterAgent,
  OpenAIEmbedAdapter,
  OpenAILLMAdapter,
  type GraphSnapshot,
  type MemoryNode,
  type Message,
  type TopicNode,
} from "memo-grafter";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

const sessions = new Map<string, MemoGrafterAgent>();

interface AgentInternals {
  sessionId: string;
  history: Message[];
  core: {
    store: {
      getBufferMessages(
        sessionId: string,
        start: number,
        end: number,
        maxChars?: number,
      ): Promise<Message[]>;
      getNodesBySession(sessionId: string): Promise<GraphSnapshot["nodes"]>;
      getEdgesBySession(sessionId: string): Promise<GraphSnapshot["edges"]>;
      getMemoriesBySession(
        sessionId: string,
      ): Promise<GraphSnapshot["memories"]>;
      getMemoriesByTopic(topicNodeId: string): Promise<GraphSnapshot["memories"]>;
      insertMemories(nodes: Omit<MemoryNode, "createdAt">[]): Promise<void>;
      buildMemoryEdges(
        topicNodeId: string,
        sessionId: string,
        threshold: number,
      ): Promise<void>;
      getTopicNode(
        topicNodeId: string,
        sessionId?: string,
      ): Promise<GraphSnapshot["nodes"][number] | null>;
      clearSession(sessionId: string): Promise<void>;
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
    },
  });

  (agent as unknown as AgentInternals).sessionId = sessionId;
  await agent.initialize();
  const internals = agent as unknown as AgentInternals;
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
  const sourceAgent = (await getOrCreateAgent(
    sourceSessionId,
  )) as unknown as AgentInternals;
  const targetAgent = await getOrCreateAgent(targetSessionId);
  const topicIdSet = new Set(topicIds);
  const sourceNodes = (
    await sourceAgent.core.store.getNodesBySession(sourceSessionId)
  ).filter((node) => topicIdSet.has(node.id));

  const graftedNodes = await targetAgent.absorbFromAgent(
    sourceAgent as unknown as MemoGrafterAgent,
    {
      topicIds,
    },
  );

  const targetStore = (targetAgent as unknown as AgentInternals).core.store;

  for (const [index, sourceNode] of sourceNodes.entries()) {
    const graftedNode = graftedNodes[index];

    if (!graftedNode) {
      continue;
    }

    const sourceMemories = await sourceAgent.core.store.getMemoriesByTopic(
      sourceNode.id,
    );
    const copiedMemories = sourceMemories.map((memory) => ({
      ...memory,
      id: randomUUID(),
      segmentId: graftedNode.segmentId,
      topicNodeId: graftedNode.id,
      sessionId: targetSessionId,
      agentId: graftedNode.agentId,
      agentColor: graftedNode.agentColor,
      fleetId: graftedNode.fleetId,
      supersededBy: null,
    }));

    await targetStore.insertMemories(copiedMemories);
    await targetStore.buildMemoryEdges(graftedNode.id, targetSessionId, 0.65);
  }

  return graftedNodes;
}

export async function clearPersistedSession(sessionId: string): Promise<void> {
  const agent = (await getOrCreateAgent(sessionId)) as unknown as AgentInternals;

  await agent.core.store.clearSession(sessionId);
  await deleteMessageBuffer(sessionId);
  agent.history = [];

  const cachedAgent = sessions.get(sessionId);
  if (cachedAgent) {
    await cachedAgent.close();
    sessions.delete(sessionId);
  }
}

async function deleteMessageBuffer(sessionId: string): Promise<void> {
  const sql = postgres(process.env.DATABASE_URL!, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });

  try {
    await sql`
      DELETE FROM mg_message_buffer
      WHERE session_id = ${sessionId}
    `;
  } finally {
    await sql.end();
  }
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
  const agent = (await getOrCreateAgent(sessionId)) as unknown as AgentInternals;
  const [nodes, edges, memories] = await Promise.all([
    agent.core.store.getNodesBySession(sessionId),
    agent.core.store.getEdgesBySession(sessionId),
    agent.core.store.getMemoriesBySession(sessionId),
  ]);
  const displayEdges = createDisplayEdges(nodes, edges);

  return {
    sessionId,
    nodes,
    edges: displayEdges,
    memories,
    capturedAt: new Date().toISOString(),
  };
}

function createDisplayEdges(
  nodes: GraphSnapshot["nodes"],
  edges: GraphSnapshot["edges"],
): GraphSnapshot["edges"] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const displayEdges: GraphSnapshot["edges"] = [];
  const seen = new Set<string>();

  for (const edge of edges) {
    if (edge.type !== "grafted") {
      if (nodeById.has(edge.srcId) && nodeById.has(edge.dstId)) {
        const key = `${edge.srcId}:${edge.dstId}:${edge.type}`;
        if (!seen.has(key)) {
          seen.add(key);
          displayEdges.push(edge);
        }
      }
      continue;
    }

    const localNode = nodeById.get(edge.srcId) ?? nodeById.get(edge.dstId);
    if (!localNode) {
      continue;
    }

    const closestNode = findClosestTopic(localNode, nodes);
    if (!closestNode) {
      continue;
    }

    const key = `${localNode.id}:${closestNode.id}:grafted`;
    if (!seen.has(key)) {
      seen.add(key);
      displayEdges.push({
        srcId: localNode.id,
        dstId: closestNode.id,
        weight: cosineSimilarity(localNode.embedding, closestNode.embedding),
        type: "grafted",
      });
    }
  }

  return displayEdges;
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
