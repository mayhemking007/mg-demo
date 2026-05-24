import {
  MemoGrafterAgent,
  OpenAIEmbedAdapter,
  OpenAILLMAdapter,
  type GraphSnapshot,
  type Message,
} from "memo-grafter";

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
    systemPrompt: `You are a developer memory assistant. You help developers
remember and reflect on their technical decisions, bugs, architecture choices,
and project progress. Be concise and precise. When the developer mentions a
decision, bug, task, or insight, acknowledge it clearly so they know it has
been remembered.`,
    drift: {
      mode: "intent",
      driftSensitivity: "medium",
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

  return {
    sessionId,
    nodes,
    edges,
    memories,
    capturedAt: new Date().toISOString(),
  };
}
