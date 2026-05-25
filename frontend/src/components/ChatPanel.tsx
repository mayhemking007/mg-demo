import { FormEvent, useEffect, useRef, useState } from "react";
import type { Message } from "../types";

interface ChatPanelProps {
  messages: Message[];
  onSend: (message: string) => void;
  remaining: number;
  resetAt: string;
  loading: boolean;
  rateLimitEnabled: boolean;
}

const STARTER_PROMPTS = [
  "I want to remember that Miles Davis is perfect for quiet Sunday cooking.",
  "The best tacos we tried had grilled pineapple, smoky salsa, and fresh lime.",
  "What was the film with the beautiful soundtrack we wanted to watch again?",
];

function formatResetTime(resetAt: string): string {
  if (!resetAt) {
    return "tomorrow";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(resetAt));
}

export function ChatPanel({
  messages,
  onSend,
  remaining,
  resetAt,
  loading,
  rateLimitEnabled,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const limitReached = rateLimitEnabled && remaining <= 0;

  useEffect(() => {
    const el = messagesRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loading]);

  function submitMessage(value: string) {
    const message = value.trim();
    if (!message || loading || limitReached) {
      return;
    }

    onSend(message);
    setDraft("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMessage(draft);
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-bg">
      <div ref={messagesRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div>
              <h1 className="text-lg font-semibold text-white">
                Start building your memory graph
              </h1>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                Log favorite music, food notes, films, or questions and the
                assistant will keep the graph fresh as you chat.
              </p>
            </div>
            <div className="flex max-w-xl flex-wrap justify-center gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loading || limitReached}
                  onClick={() => submitMessage(prompt)}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-left text-xs text-white transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={`max-w-[88%] rounded-md border p-3 ${
                  message.role === "user"
                    ? "ml-auto border-accent/30 bg-accent/10"
                    : "mr-auto border-border bg-surface"
                }`}
              >
                <div className="mb-1 text-[11px] font-semibold uppercase text-muted">
                  {message.role === "user" ? "You" : "Assistant"}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-white">
                  {message.content}
                </p>
                {message.recalledFacts && message.recalledFacts.length > 0 ? (
                  <details className="mt-3 rounded-md border border-border bg-bg/60 p-2">
                    <summary className="cursor-pointer text-xs font-medium text-accent">
                      Memory used
                    </summary>
                    <div className="mt-2 space-y-2">
                      {message.recalledFacts.map((fact, factIndex) => {
                        const score = Math.round(fact.similarity * 100);

                        return (
                          <div key={`${fact.subject}-${factIndex}`}>
                            <div className="flex justify-between gap-3 text-xs">
                              <span className="text-white">
                                {fact.subject}: {fact.value}
                              </span>
                              <span className="text-muted">{score}%</span>
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
                              <div
                                className="h-full rounded-full bg-accent"
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ) : null}
              </article>
            ))}
            {loading ? (
              <div className="mr-auto inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-accent" />
                Thinking
              </div>
            ) : null}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-border bg-surface p-3"
      >
        {limitReached ? (
          <div className="mb-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            Daily limit reached. Resets at {formatResetTime(resetAt)}.
          </div>
        ) : null}
        <div className="flex gap-2">
          <input
            value={draft}
            disabled={loading || limitReached}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Log a song, food note, film, or question..."
            className="min-w-0 flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm text-white outline-none transition placeholder:text-muted focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!draft.trim() || loading || limitReached}
            className="inline-flex min-w-20 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-bg transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-bg/30 border-t-bg" />
            ) : (
              "Send"
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
