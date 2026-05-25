# Developer Memory Assistant Backend

Express + TypeScript backend for the Developer Memory Assistant demo. It uses
memo-grafter with Postgres/pgvector to store conversational memory and graph
data.

## Environment Variables

Create a local `.env` file from `.env.example`.

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/dev_memory
OPENAI_API_KEY=sk-...
PORT=3001
DAILY_MESSAGE_LIMIT=10
FRONTEND_URL=http://localhost:5173
```

- `DATABASE_URL` must point to a Postgres instance with pgvector available.
- `OPENAI_API_KEY` is required by the memo-grafter OpenAI adapters.
- `PORT` defaults to `3001`.
- `DAILY_MESSAGE_LIMIT` controls the in-memory per-browser daily chat limit.
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

## Persistence Notes

memo-grafter stores messages, topic nodes, memory nodes, and graph edges in
Postgres. The browser `sessionId` is used as the memo-grafter session id so the
backend can rehydrate chat history and graph snapshots after refresh.

Active agent instances and rate-limit buckets are still in memory. They reset on
server restart, but the persisted graph and message history remain in Postgres.
