import axios from "axios";
import type { ChatResponse, GraphSnapshot } from "../types";
import { getBrowserId, getSessionId } from "./session";

const client = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001",
});

export async function sendMessage(message: string): Promise<ChatResponse> {
  const { data } = await client.post<ChatResponse>("/chat", {
    message,
    sessionId: getSessionId(),
    browserId: getBrowserId(),
  });

  return data;
}

export async function fetchSnapshot(): Promise<GraphSnapshot> {
  const { data } = await client.get<GraphSnapshot>("/snapshot", {
    params: { sessionId: getSessionId() },
  });

  return data;
}

export async function fetchRecall(query: string): Promise<unknown> {
  const { data } = await client.get("/recall", {
    params: { q: query, sessionId: getSessionId() },
  });

  return data;
}
