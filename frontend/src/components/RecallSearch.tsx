import { FormEvent, useState } from "react";
import { fetchRecall } from "../lib/api";
import { MEMORY_TYPE_CONFIG } from "../lib/memoryConfig";
import type { MemoryNode, RecalledFact } from "../types";

type RecallResult = Partial<RecalledFact> &
  Partial<MemoryNode> & {
    memory?: Partial<MemoryNode>;
    score?: number;
  };

function normalizeResults(data: unknown): RecallResult[] {
  if (Array.isArray(data)) {
    return data as RecallResult[];
  }

  if (data && typeof data === "object") {
    const maybeResults = data as {
      results?: unknown;
      facts?: unknown;
      memories?: unknown;
      items?: unknown;
    };

    if (Array.isArray(maybeResults.results)) {
      return maybeResults.results as RecallResult[];
    }

    if (Array.isArray(maybeResults.facts)) {
      return maybeResults.facts as RecallResult[];
    }

    if (Array.isArray(maybeResults.memories)) {
      return maybeResults.memories as RecallResult[];
    }

    if (Array.isArray(maybeResults.items)) {
      return maybeResults.items as RecallResult[];
    }
  }

  return [];
}

function getSimilarity(result: RecallResult): number {
  return result.similarity ?? result.score ?? 0;
}

function getMemoryType(result: RecallResult): MemoryNode["memoryType"] {
  const memoryType = result.memoryType ?? result.memory?.memoryType;
  if (
    memoryType === "fact" ||
    memoryType === "task" ||
    memoryType === "question" ||
    memoryType === "insight" ||
    memoryType === "reference"
  ) {
    return memoryType;
  }

  return "reference";
}

function getScoreColor(score: number): string {
  if (score > 0.7) {
    return "bg-success";
  }

  if (score >= 0.5) {
    return "bg-warning";
  }

  return "bg-danger";
}

export function RecallSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecallResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();

    if (!value || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setHasSearched(true);

    try {
      const data = await fetchRecall(value);
      setResults(normalizeResults(data));
    } catch {
      setResults([]);
      setError("Recall search failed. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  function clearResults() {
    setResults([]);
    setError("");
    setHasSearched(false);
    setQuery("");
  }

  return (
    <section>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
            Search
          </span>
          <input
            value={query}
            disabled={loading}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Recall decisions, bugs, tasks..."
            className="w-full rounded-md border border-border bg-bg px-3 py-2 pl-16 text-sm text-white outline-none transition placeholder:text-muted focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="inline-flex min-w-20 items-center justify-center rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          ) : (
            "Recall"
          )}
        </button>
        {(results.length > 0 || error || hasSearched) && (
          <button
            type="button"
            onClick={clearResults}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted transition hover:text-white"
          >
            Clear
          </button>
        )}
      </form>

      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}

      {!loading && !error && hasSearched && results.length === 0 ? (
        <p className="mt-2 text-xs text-muted">No matching memories found.</p>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
          {results.map((result, index) => {
            const type = getMemoryType(result);
            const config = MEMORY_TYPE_CONFIG[type];
            const score = Math.max(0, Math.min(1, getSimilarity(result)));
            const subject =
              result.subject ?? result.memory?.subject ?? "Untitled memory";
            const predicate = result.predicate ?? result.memory?.predicate ?? "";
            const value = result.value ?? result.memory?.value ?? "";

            return (
              <article
                key={`${subject}-${index}`}
                className="rounded-md border border-border bg-surface p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${config.color}`}
                  >
                    {config.label}
                  </span>
                  <span className="text-xs text-muted">
                    {Math.round(score * 100)}%
                  </span>
                </div>
                <div className="text-xs leading-5 text-white">
                  <span className="font-medium">{subject}</span>
                  {predicate ? (
                    <>
                      <span className="px-1 text-muted">·</span>
                      <span className="text-muted">{predicate}</span>
                    </>
                  ) : null}
                  {value ? (
                    <>
                      <span className="px-1 text-muted">·</span>
                      <span>{value}</span>
                    </>
                  ) : null}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className={`h-full rounded-full ${getScoreColor(score)}`}
                    style={{ width: `${Math.round(score * 100)}%` }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
