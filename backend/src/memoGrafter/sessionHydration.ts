import type { MemoGrafterAgent, Message } from "memo-grafter";

export interface HydratedMemoGrafterAgent {
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

export function asHydratedAgent(
  agent: MemoGrafterAgent,
): HydratedMemoGrafterAgent {
  return agent as unknown as HydratedMemoGrafterAgent;
}

export async function hydrateAgentSession(
  agent: MemoGrafterAgent,
  sessionId: string,
): Promise<void> {
  const hydratedAgent = asHydratedAgent(agent);

  // The browser owns the stable session id. MemoGrafterAgent generates one
  // internally, so this demo hydrates the private session/history fields to
  // reconnect localStorage sessions to memo-grafter's persisted message buffer.
  hydratedAgent.sessionId = sessionId;
  hydratedAgent.history = await hydratedAgent.core.store.getBufferMessages(
    sessionId,
    0,
    1000,
    4000,
  );
}
