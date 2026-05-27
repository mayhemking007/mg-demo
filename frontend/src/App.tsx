import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import { ChatPanel } from "./components/ChatPanel";
import { GraphPanel, getTopicDisplayNumberById } from "./components/GraphPanel";
import { StatusBar } from "./components/StatusBar";
import {
  clearSession,
  fetchHistory,
  fetchSnapshot,
  graftTopics,
  sendMessage,
} from "./lib/api";
import { rotateSession, type SessionSlot } from "./lib/session";
import type { GraphSnapshot, Message } from "./types";

const DAILY_LIMIT = parseInt(import.meta.env.VITE_DAILY_LIMIT ?? "10", 10);
const RATE_LIMIT_ENABLED = import.meta.env.VITE_RATE_LIMIT_ENABLED === "true";
const DEMO_PROMPTS = [
  "I keep replaying Kind of Blue while cooking dinner, especially on rainy evenings.",
  "We loved the handmade mushroom ravioli at the little Italian place near the cinema.",
  "The film we want to revisit is In the Mood for Love because the music and colors stayed with us.",
];

interface RateLimitError {
  error: string;
  remaining: number;
  resetAt: string;
}

interface SessionState {
  messages: Message[];
  snapshot: GraphSnapshot | null;
  loading: boolean;
  selectedTopicId: string | null;
}

const EMPTY_SNAPSHOT: GraphSnapshot = {
  sessionId: "",
  nodes: [],
  edges: [],
  memories: [],
  capturedAt: "",
};

function emptySession(): SessionState {
  return {
    messages: [],
    snapshot: null,
    loading: false,
    selectedTopicId: null,
  };
}

export default function App() {
  const [sessions, setSessions] = useState<Record<SessionSlot, SessionState>>({
    a: emptySession(),
    b: emptySession(),
  });
  const [remaining, setRemaining] = useState(DAILY_LIMIT);
  const [resetAt, setResetAt] = useState("");
  const [grafting, setGrafting] = useState<SessionSlot | null>(null);
  const [clearingSlot, setClearingSlot] = useState<SessionSlot | null>(null);
  const [autoGeneratingSlot, setAutoGeneratingSlot] =
    useState<SessionSlot | null>(null);

  useEffect(() => {
    (async () => {
      const entries = await Promise.all(
        (["a", "b"] as SessionSlot[]).map(async (slot) => {
          const [snapshotResult, historyResult] = await Promise.allSettled([
            fetchSnapshot(slot),
            fetchHistory(slot),
          ]);

          return [
            slot,
            {
              messages:
                historyResult.status === "fulfilled" ? historyResult.value : [],
              snapshot:
                snapshotResult.status === "fulfilled"
                  ? snapshotResult.value
                  : { ...EMPTY_SNAPSHOT, capturedAt: new Date().toISOString() },
              loading: false,
              selectedTopicId: null,
            },
          ] as const;
        }),
      );

      setSessions(Object.fromEntries(entries) as Record<SessionSlot, SessionState>);
    })();
  }, []);

  function updateSession(
    slot: SessionSlot,
    updater: (session: SessionState) => SessionState,
  ) {
    setSessions((current) => ({
      ...current,
      [slot]: updater(current[slot]),
    }));
  }

  async function handleSend(slot: SessionSlot, message: string) {
    updateSession(slot, (session) => ({
      ...session,
      loading: true,
      messages: [...session.messages, { role: "user", content: message }],
    }));

    try {
      const result = await sendMessage(message, slot);
      updateSession(slot, (session) => ({
        ...session,
        messages: [
          ...session.messages,
          {
            role: "assistant",
            content: result.response,
          },
        ],
        snapshot: result.snapshot,
        loading: false,
      }));
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
        updateSession(slot, (session) => ({
          ...session,
          loading: false,
          messages: [
            ...session.messages,
            {
              role: "assistant",
              content:
                "You've reached your daily message limit. Come back tomorrow.",
            },
          ],
        }));
      } else {
        updateSession(slot, (session) => ({
          ...session,
          loading: false,
          messages: [
            ...session.messages,
            {
              role: "assistant",
              content:
                "I couldn't reach the backend. Check that it is running and try again.",
            },
          ],
        }));
      }
    }
  }

  async function handleAutoGenerate(slot: SessionSlot) {
    if (
      autoGeneratingSlot ||
      sessions[slot].loading ||
      (RATE_LIMIT_ENABLED && remaining <= 0)
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Auto-generate 3 demo messages for this session?",
    );

    if (!confirmed) {
      return;
    }

    setAutoGeneratingSlot(slot);
    let nextRemaining = remaining;

    for (const prompt of DEMO_PROMPTS) {
      if (RATE_LIMIT_ENABLED && nextRemaining <= 0) {
        break;
      }

      updateSession(slot, (session) => ({
        ...session,
        loading: true,
        messages: [...session.messages, { role: "user", content: prompt }],
      }));

      try {
        const result = await sendMessage(prompt, slot);
        nextRemaining = result.remaining;
        setRemaining(result.remaining);
        setResetAt(result.resetAt);
        updateSession(slot, (session) => ({
          ...session,
          messages: [
            ...session.messages,
            {
              role: "assistant",
              content: result.response,
            },
          ],
          snapshot: result.snapshot,
          loading: false,
        }));
      } catch (err) {
        if (
          err instanceof AxiosError &&
          err.response?.status === 429 &&
          err.response.data
        ) {
          const data = err.response.data as RateLimitError;
          nextRemaining = 0;
          setRemaining(0);
          setResetAt(data.resetAt);
          updateSession(slot, (session) => ({
            ...session,
            loading: false,
            messages: [
              ...session.messages,
              {
                role: "assistant",
                content:
                  "Auto-generation stopped because the daily message limit was reached.",
              },
            ],
          }));
        } else {
          updateSession(slot, (session) => ({
            ...session,
            loading: false,
            messages: [
              ...session.messages,
              {
                role: "assistant",
                content:
                  "Auto-generation stopped because I couldn't reach the backend.",
              },
            ],
          }));
        }
        break;
      }
    }

    setAutoGeneratingSlot(null);
  }

  async function handleGraft(source: SessionSlot, target: SessionSlot) {
    const topicId = sessions[source].selectedTopicId;
    if (!topicId || grafting) {
      return;
    }

    setGrafting(source);

    try {
      const snapshot = await graftTopics(source, target, [topicId]);
      const messages = await fetchHistory(target);
      updateSession(target, (session) => ({
        ...session,
        messages,
        snapshot,
      }));
      updateSession(source, (session) => ({
        ...session,
        selectedTopicId: null,
      }));
    } finally {
      setGrafting(null);
    }
  }

  async function handleClearSession(slot: SessionSlot, label: string) {
    const confirmed = window.confirm(
      `Clear ${label}? This deletes chat and graph data for this session only.`,
    );

    if (!confirmed || clearingSlot) {
      return;
    }

    setClearingSlot(slot);

    try {
      await clearSession(slot);
      const nextSessionId = rotateSession(slot);
      updateSession(slot, () => ({
        ...emptySession(),
        snapshot: {
          ...EMPTY_SNAPSHOT,
          sessionId: nextSessionId,
          capturedAt: new Date().toISOString(),
        },
      }));

      if (grafting === slot) {
        setGrafting(null);
      }
    } finally {
      setClearingSlot(null);
    }
  }

  function renderLane(slot: SessionSlot, label: string, target: SessionSlot) {
    const session = sessions[slot];
    const targetLabel = target === "a" ? "Session A" : "Session B";
    const selectedTopic = session.snapshot?.nodes.find(
      (node) => node.id === session.selectedTopicId,
    );
    const topicDisplayNumberById = getTopicDisplayNumberById(
      session.snapshot?.nodes ?? [],
    );
    const selectedNodeLabel = selectedTopic
      ? `Node ${topicDisplayNumberById.get(selectedTopic.id) ?? 0}`
      : "Node";

    return (
      <section className="grid min-h-0 flex-1 grid-cols-1 border-b border-border last:border-b-0 lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
        <div className="min-h-[22rem] border-b border-border lg:border-b-0 lg:border-r">
          <GraphPanel
            title={`${label} graph`}
            snapshot={session.snapshot}
            selectedTopicId={session.selectedTopicId}
            graftLabel={`Graft ${selectedNodeLabel} to ${targetLabel}`}
            grafting={grafting === slot}
            onSelectTopic={(topicId) =>
              updateSession(slot, (current) => ({
                ...current,
                selectedTopicId: topicId,
              }))
            }
            onGraftSelected={() => handleGraft(slot, target)}
          />
        </div>
        <div className="min-h-[22rem]">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3 py-2">
              <div className="text-xs font-semibold uppercase text-muted">
                {label} chat
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={
                    autoGeneratingSlot !== null ||
                    session.loading ||
                    (RATE_LIMIT_ENABLED && remaining <= 0)
                  }
                  onClick={() => handleAutoGenerate(slot)}
                  className="rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {autoGeneratingSlot === slot ? "Generating..." : "Auto generate"}
                </button>
                <button
                  type="button"
                  disabled={clearingSlot !== null}
                  onClick={() => handleClearSession(slot, label)}
                  className="rounded-md border border-danger/40 bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger transition hover:border-danger hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {clearingSlot === slot ? "Clearing..." : "Clear session"}
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <ChatPanel
                messages={session.messages}
                onSend={(message) => handleSend(slot, message)}
                remaining={remaining}
                resetAt={resetAt}
                loading={session.loading}
                rateLimitEnabled={RATE_LIMIT_ENABLED}
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-white">
      <StatusBar
        remaining={remaining}
        limit={DAILY_LIMIT}
        rateLimitEnabled={RATE_LIMIT_ENABLED}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {renderLane("a", "Session A", "b")}
        {renderLane("b", "Session B", "a")}
      </div>
    </div>
  );
}
