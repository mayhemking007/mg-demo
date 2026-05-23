import {
  MemoGrafterAgent,
  OpenAIEmbedAdapter,
  OpenAILLMAdapter,
} from "memo-grafter";

const sessions = new Map<string, MemoGrafterAgent>();

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

  await agent.initialize();
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
