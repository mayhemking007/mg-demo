import type { MemoGrafterAgent } from "memo-grafter";
import { createMemoGrafterAgent } from "./createAgent.js";
import { hydrateAgentSession } from "./sessionHydration.js";

const agents = new Map<string, MemoGrafterAgent>();

export async function getOrCreateAgent(
  sessionId: string,
): Promise<MemoGrafterAgent> {
  if (agents.has(sessionId)) {
    return agents.get(sessionId)!;
  }

  const agent = createMemoGrafterAgent();
  await agent.initialize();
  await hydrateAgentSession(agent, sessionId);
  agents.set(sessionId, agent);
  return agent;
}

export async function closeAgent(sessionId: string): Promise<void> {
  const agent = agents.get(sessionId);

  if (!agent) {
    return;
  }

  await agent.close();
  agents.delete(sessionId);
}

export function forgetAgent(sessionId: string): void {
  agents.delete(sessionId);
}
