import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import { ChatPanel } from "./components/ChatPanel";
import { GraphPanel } from "./components/GraphPanel";
import { StatusBar } from "./components/StatusBar";
import { fetchHistory, fetchSnapshot, sendMessage } from "./lib/api";
import type { GraphSnapshot, Message } from "./types";

const DAILY_LIMIT = parseInt(import.meta.env.VITE_DAILY_LIMIT ?? "10", 10);

interface RateLimitError {
  error: string;
  remaining: number;
  resetAt: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [remaining, setRemaining] = useState(DAILY_LIMIT);
  const [resetAt, setResetAt] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.allSettled([fetchSnapshot(), fetchHistory()])
      .then(([snapshotResult, historyResult]) => {
        if (snapshotResult.status === "fulfilled") {
          setSnapshot(snapshotResult.value);
        } else {
          setSnapshot({
            sessionId: "",
            nodes: [],
            edges: [],
            memories: [],
            capturedAt: new Date().toISOString(),
          });
        }

        if (historyResult.status === "fulfilled") {
          setMessages(historyResult.value);
        }
      })
      .catch(() => {
        setSnapshot({
          sessionId: "",
          nodes: [],
          edges: [],
          memories: [],
          capturedAt: new Date().toISOString(),
        });
      });
  }, []);

  async function handleSend(message: string) {
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    try {
      const result = await sendMessage(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.response,
        },
      ]);
      setSnapshot(result.snapshot);
      setRemaining(result.remaining);
      setResetAt(result.resetAt);
    } catch (err) {
      if (
        err instanceof AxiosError &&
        err.response?.status === 429 &&
        err.response.data
      ) {
        const data = err.response.data as RateLimitError;
        setRemaining(0);
        setResetAt(data.resetAt);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "You've reached your daily message limit. Come back tomorrow.",
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              "I couldn't reach the backend. Check that it is running and try again.",
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-white">
      <StatusBar remaining={remaining} limit={DAILY_LIMIT} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="min-h-[28rem] flex-1 border-b border-border lg:w-2/3 lg:border-b-0 lg:border-r">
          <GraphPanel snapshot={snapshot} />
        </div>

        <div className="min-h-0 flex-1 lg:w-1/3">
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            remaining={remaining}
            resetAt={resetAt}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}
