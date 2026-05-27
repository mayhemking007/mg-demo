import {
  MemoGrafterAgent,
  OpenAIEmbedAdapter,
  OpenAILLMAdapter,
  type GraphSnapshot,
  type MemoryNode,
  type Message,
  type TopicEdge,
  type TopicNode,
  type TopicSegment,
} from "memo-grafter";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

const sessions = new Map<string, MemoGrafterAgent>();
const graftedTopicSources = new Map<string, Map<string, string>>();
const appSql = postgres(process.env.DATABASE_URL!, {
  max: 2,
  idle_timeout: 30,
  connect_timeout: 10,
});
let graftTableReady: Promise<void> | null = null;
const EDGE_DISPLAY_PRIORITY: Record<string, number> = {
  grafted: 4,
  semantic: 3,
  reentry: 2,
  temporal: 1,
};
const GRAFT_SEGMENT_BASE_INDEX = 1_000_000;

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
      saveSegment(segment: TopicSegment): Promise<TopicSegment>;
      saveNode(node: TopicNode): Promise<void>;
      saveEdge(edge: TopicEdge): Promise<void>;
      clearSession(sessionId: string): Promise<void>;
    };
  };
}

interface StoredTopicNode extends Omit<TopicNode, "createdAt"> {
  createdAt: string;
}

interface StoredMemoryNode extends Omit<MemoryNode, "createdAt"> {
  createdAt: string;
}

interface GraftRecord {
  id: string;
  targetSessionId: string;
  sourceSessionId: string;
  sourceTopicId: string;
  targetTopicId: string;
  targetSegmentId: string;
  topicPayload: StoredTopicNode;
  memoriesPayload: StoredMemoryNode[];
  createdAt: Date;
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
  const targetGrafts =
    graftedTopicSources.get(targetSessionId) ?? new Map<string, string>();
  graftedTopicSources.set(targetSessionId, targetGrafts);

  for (const [index, sourceNode] of sourceNodes.entries()) {
    const graftedNode = graftedNodes[index];

    if (!graftedNode) {
      continue;
    }

    targetGrafts.set(graftedNode.id, sourceNode.id);

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
    await saveGraftRecord({
      sourceSessionId,
      targetSessionId,
      sourceTopicId: sourceNode.id,
      targetTopicId: graftedNode.id,
      targetSegmentId: graftedNode.segmentId,
      topic: graftedNode,
      memories: copiedMemories,
    });
  }

  return graftedNodes;
}

export async function clearPersistedSession(sessionId: string): Promise<void> {
  const agent = (await getOrCreateAgent(sessionId)) as unknown as AgentInternals;

  await agent.core.store.clearSession(sessionId);
  await deleteGraftRecordsForTarget(sessionId);
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
  await waitForAgentIngest(agent);
  await restoreGraftsForSession(sessionId);

  const [nodes, edges, memories] = await Promise.all([
    agent.core.store.getNodesBySession(sessionId),
    agent.core.store.getEdgesBySession(sessionId),
    agent.core.store.getMemoriesBySession(sessionId),
  ]);
  const displayEdges = createDisplayEdges(
    nodes,
    edges,
    graftedTopicSources.get(sessionId),
  );

  return {
    sessionId,
    nodes,
    edges: displayEdges,
    memories,
    capturedAt: new Date().toISOString(),
  };
}

export async function restoreGraftsForSession(sessionId: string): Promise<void> {
  const agent = (await getOrCreateAgent(sessionId)) as unknown as AgentInternals;
  await waitForAgentIngest(agent);
  await ensureGraftTable();

  const records = await getGraftRecords(sessionId);
  const targetGrafts = new Map<string, string>();
  graftedTopicSources.set(sessionId, targetGrafts);

  if (records.length === 0) {
    return;
  }

  const store = agent.core.store;
  const nodes = await store.getNodesBySession(sessionId);
  const nodeIds = new Set(nodes.map((node) => node.id));

  for (const record of records) {
    targetGrafts.set(record.targetTopicId, record.sourceTopicId);

    if (!nodeIds.has(record.targetTopicId)) {
      const segment = toTopicSegment(record);
      await store.saveSegment(segment);
      await store.saveNode(toTopicNode(record.topicPayload, segment.id));
      nodeIds.add(record.targetTopicId);
    }

    await restoreMissingMemories(record);
    await store.buildMemoryEdges(record.targetTopicId, sessionId, 0.65);
  }
}

async function waitForAgentIngest(agent: AgentInternals): Promise<void> {
  await agent.pendingIngest;
}

async function ensureGraftTable(): Promise<void> {
  graftTableReady ??= appSql`
    CREATE TABLE IF NOT EXISTS dma_grafts (
      id UUID PRIMARY KEY,
      target_session_id TEXT NOT NULL,
      source_session_id TEXT NOT NULL,
      source_topic_id TEXT NOT NULL,
      target_topic_id TEXT NOT NULL,
      target_segment_id TEXT NOT NULL,
      topic_payload JSONB NOT NULL,
      memories_payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (target_session_id, source_topic_id)
    )
  `.then(async () => {
    await appSql`
      CREATE INDEX IF NOT EXISTS dma_grafts_target_session_idx
      ON dma_grafts (target_session_id)
    `;
  });

  await graftTableReady;
}

async function saveGraftRecord(input: {
  sourceSessionId: string;
  targetSessionId: string;
  sourceTopicId: string;
  targetTopicId: string;
  targetSegmentId: string;
  topic: TopicNode;
  memories: Omit<MemoryNode, "createdAt">[];
}): Promise<void> {
  await ensureGraftTable();

  await appSql`
    INSERT INTO dma_grafts (
      id,
      target_session_id,
      source_session_id,
      source_topic_id,
      target_topic_id,
      target_segment_id,
      topic_payload,
      memories_payload
    )
    VALUES (
      ${randomUUID()},
      ${input.targetSessionId},
      ${input.sourceSessionId},
      ${input.sourceTopicId},
      ${input.targetTopicId},
      ${input.targetSegmentId},
      ${appSql.json(serializeTopic(input.topic) as never)},
      ${appSql.json(input.memories.map(serializeMemoryInsert) as never)}
    )
    ON CONFLICT (target_session_id, source_topic_id)
    DO UPDATE SET
      target_topic_id = EXCLUDED.target_topic_id,
      target_segment_id = EXCLUDED.target_segment_id,
      topic_payload = EXCLUDED.topic_payload,
      memories_payload = EXCLUDED.memories_payload,
      created_at = NOW()
  `;
}

async function getGraftRecords(sessionId: string): Promise<GraftRecord[]> {
  await ensureGraftTable();

  const rows = await appSql`
    SELECT *
    FROM dma_grafts
    WHERE target_session_id = ${sessionId}
    ORDER BY created_at ASC
  `;

  return rows.map((row) => ({
    id: row.id,
    targetSessionId: row.target_session_id,
    sourceSessionId: row.source_session_id,
    sourceTopicId: row.source_topic_id,
    targetTopicId: row.target_topic_id,
    targetSegmentId: row.target_segment_id,
    topicPayload: row.topic_payload,
    memoriesPayload: row.memories_payload,
    createdAt: row.created_at,
  }));
}

async function deleteGraftRecordsForTarget(sessionId: string): Promise<void> {
  await ensureGraftTable();
  await appSql`
    DELETE FROM dma_grafts
    WHERE target_session_id = ${sessionId}
  `;
  graftedTopicSources.delete(sessionId);
}

async function restoreMissingMemories(record: GraftRecord): Promise<void> {
  if (record.memoriesPayload.length === 0) {
    return;
  }

  const existingRows = await appSql`
    SELECT id
    FROM mg_memory_nodes
    WHERE id::text = ANY(${appSql.array(record.memoriesPayload.map((memory) => memory.id))})
  `;
  const existingIds = new Set(existingRows.map((row) => String(row.id)));
  const missingMemories = record.memoriesPayload
    .filter((memory) => !existingIds.has(memory.id))
    .map((memory) => ({
      ...toMemoryInsert(memory, record.targetSegmentId, record.targetTopicId),
      segmentId: record.targetSegmentId,
      topicNodeId: record.targetTopicId,
      sessionId: record.targetSessionId,
    }));

  if (missingMemories.length === 0) {
    return;
  }

  const agent = (await getOrCreateAgent(
    record.targetSessionId,
  )) as unknown as AgentInternals;
  await agent.core.store.insertMemories(missingMemories);
}

function toTopicSegment(record: GraftRecord): TopicSegment {
  const topic = record.topicPayload;
  const createdAt = parseStoredDate(topic.createdAt);
  const baseRange = Math.abs(hashText(record.targetTopicId)) % 100_000;
  const startIndex = GRAFT_SEGMENT_BASE_INDEX + baseRange;

  return {
    id: record.targetSegmentId,
    sessionId: record.targetSessionId,
    startIndex,
    endIndex: startIndex + 1,
    topicOrder: topic.topicOrder,
    driftScore: topic.driftScore,
    createdAt,
  };
}

function toTopicNode(topic: StoredTopicNode, segmentId: string): TopicNode {
  return {
    ...topic,
    segmentId,
    createdAt: parseStoredDate(topic.createdAt),
  };
}

function toMemoryInsert(
  memory: StoredMemoryNode,
  segmentId: string,
  topicNodeId: string,
): Omit<MemoryNode, "createdAt"> {
  const { createdAt: _createdAt, ...insert } = memory;

  return {
    ...insert,
    segmentId,
    topicNodeId,
  };
}

function serializeTopic(topic: TopicNode): StoredTopicNode {
  return {
    ...topic,
    createdAt: topic.createdAt.toISOString(),
  };
}

function serializeMemoryInsert(
  memory: Omit<MemoryNode, "createdAt">,
): StoredMemoryNode {
  return {
    ...memory,
    createdAt: new Date().toISOString(),
  };
}

function parseStoredDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function hashText(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return hash;
}

function createDisplayEdges(
  nodes: GraphSnapshot["nodes"],
  edges: GraphSnapshot["edges"],
  graftedSources?: Map<string, string>,
): GraphSnapshot["edges"] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edgeByPair = new Map<string, GraphSnapshot["edges"][number]>();

  for (const [graftedNodeId, sourceNodeId] of graftedSources ?? []) {
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
