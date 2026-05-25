# MemoGrafter Playground Backend

Express + TypeScript backend for the MemoGrafter Playground demo. It uses
memo-grafter with Postgres/pgvector to store conversational memory and graph
data.

## Environment Variables

Create a local `.env` file from `.env.example`.

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/dev_memory
OPENAI_API_KEY=sk-...
PORT=3001
DAILY_MESSAGE_LIMIT=10
RATE_LIMIT_ENABLED=false
FRONTEND_URL=http://localhost:5173
```

- `DATABASE_URL` must point to a Postgres instance with pgvector available.
- `OPENAI_API_KEY` is required by the memo-grafter OpenAI adapters.
- `PORT` defaults to `3001`.
- `RATE_LIMIT_ENABLED` enables the in-memory per-browser daily chat limit when
  set to `true`.
- `DAILY_MESSAGE_LIMIT` controls that limit when rate limiting is enabled.
- `FRONTEND_URL` is used for CORS in production.

## Local Database

Start Postgres with pgvector:

```bash
docker-compose up -d
```

The included compose file starts `pgvector/pgvector:pg16` on port `5432` with
database `dev_memory`.

## Development

Install dependencies:

```bash
npm install
```

Run the backend:

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:3001/health
```

## Production

Build and start:

```bash
npm run build
npm start
```

Set `DATABASE_URL`, `OPENAI_API_KEY`, and `FRONTEND_URL` in the deployment
environment.

Production environment checklist:

- `DATABASE_URL` points to a reachable Postgres instance with pgvector.
- `OPENAI_API_KEY` is set.
- `FRONTEND_URL` exactly matches the deployed frontend origin, for example
  `https://memografter-playground.example.com`.
- `RATE_LIMIT_ENABLED` is set to `false` for open demos or `true` to re-enable
  the per-browser message limit.
- `DAILY_MESSAGE_LIMIT` is set when rate limiting is enabled.

Docker build:

```bash
docker build -t memografter-playground-backend .
```

Docker run:

```bash
docker run --env-file .env -p 3001:3001 memografter-playground-backend
```

The production image is multi-stage: it builds TypeScript with dev dependencies
and runs with production dependencies only. It also includes a `/health`
container healthcheck.

## Persistence Notes

memo-grafter stores messages, topic nodes, memory nodes, and graph edges in
Postgres. The browser `sessionId` is used as the memo-grafter session id so the
backend can rehydrate chat history and graph snapshots after refresh.

Active agent instances and rate-limit buckets are still in memory. They reset on
server restart, but the persisted graph and message history remain in Postgres.
