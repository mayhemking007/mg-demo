import axios from "axios";
import type {
  ChatResponse,
  GraphSnapshot,
  IngestTextOptions,
  IngestTextResponse,
  MaintenanceResponse,
  Message,
} from "../types";
import { getBrowserId, getSessionId, type SessionSlot } from "./session";

const client = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001",
});

export async function sendMessage(
  message: string,
  slot: SessionSlot = "a",
): Promise<ChatResponse> {
  const { data } = await client.post<ChatResponse>("/chat", {
    message,
    sessionId: getSessionId(slot),
    browserId: getBrowserId(),
  });

  return data;
}

export async function fetchSnapshot(
  slot: SessionSlot = "a",
): Promise<GraphSnapshot> {
  const { data } = await client.get<GraphSnapshot>("/snapshot", {
    params: { sessionId: getSessionId(slot) },
  });

  return data;
}

export async function fetchHistory(slot: SessionSlot = "a"): Promise<Message[]> {
  const { data } = await client.get<{ messages: Message[] }>("/history", {
    params: { sessionId: getSessionId(slot) },
  });

  return data.messages;
}

export async function fetchRecall(query: string): Promise<unknown> {
  const { data } = await client.get("/recall", {
    params: { q: query, sessionId: getSessionId() },
  });

  return data;
}

export async function graftTopics(
  sourceSlot: SessionSlot,
  targetSlot: SessionSlot,
  topicIds: string[],
): Promise<GraphSnapshot> {
  const { data } = await client.post<{ snapshot: GraphSnapshot }>("/graft", {
    sourceSessionId: getSessionId(sourceSlot),
    targetSessionId: getSessionId(targetSlot),
    topicIds,
  });

  return data.snapshot;
}

export async function clearSession(slot: SessionSlot): Promise<void> {
  await client.delete("/session", {
    params: { sessionId: getSessionId(slot) },
  });
}

export async function runMaintenance(
  slot: SessionSlot,
): Promise<MaintenanceResponse> {
  const { data } = await client.post<MaintenanceResponse>("/maintenance", {
    sessionId: getSessionId(slot),
  });

  return data;
}

export async function ingestText(
  text: string,
  slot: SessionSlot,
  options?: IngestTextOptions,
): Promise<IngestTextResponse> {
  const { data } = await client.post<IngestTextResponse>("/ingest-text", {
    sessionId: getSessionId(slot),
    text,
    options,
  });

  return data;
}
