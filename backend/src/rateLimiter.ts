interface DayBucket {
  count: number;
  date: string;
}

const buckets = new Map<string, DayBucket>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function checkRateLimit(
  browserId: string,
  limit: number,
): {
  allowed: boolean;
  remaining: number;
  resetAt: string;
} {
  const d = today();
  const bucket = buckets.get(browserId);

  if (!bucket || bucket.date !== d) {
    buckets.set(browserId, { count: 0, date: d });
  }

  const current = buckets.get(browserId)!;
  const resetAt = new Date();
  resetAt.setUTCHours(24, 0, 0, 0);

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: resetAt.toISOString() };
  }

  current.count += 1;

  return {
    allowed: true,
    remaining: limit - current.count,
    resetAt: resetAt.toISOString(),
  };
}
