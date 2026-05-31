import type { GraphSnapshot, Message, RetrievalResult, TopicNode } from "memo-grafter";
import { createSessionLocalDisplaySnapshot } from "../graph/graphDisplayAdapter.js";
import {
  closeAgent,
  forgetAgent,
  getOrCreateAgent,
} from "./agentRegistry.js";
import { asHydratedAgent } from "./sessionHydration.js";

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
