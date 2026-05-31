import {
  MemoGrafterAgent,
  OpenAIEmbedAdapter,
  OpenAILLMAdapter,
} from "memo-grafter";

export function createMemoGrafterAgent(): MemoGrafterAgent {
  return new MemoGrafterAgent({
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
}
