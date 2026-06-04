# MemoGrafter Playground

MemoGrafter Playground is a full-stack demo for exploring conversational memory
with [memo-grafter](https://www.npmjs.com/package/memo-grafter). It turns chat
messages and direct text ingest into persisted topic nodes, memory nodes, graph
edges, maintenance signals, and cross-session grafts.

> **Live demo:** Check out the Playground [here](https://mgplayground-green.vercel.app/).

<p align="center">
  <img
    src="docs/assets/memografter-playground.png"
    alt="MemoGrafter Playground UI"
    style="border: 1px solid #30363d; border-radius: 8px;"
  />
</p>

## What It Shows

- Two independent memory sessions side by side.
- Chat history and graph data persisted in Postgres/pgvector through
  memo-grafter.
- D3 graph panels for topics, memories, temporal edges, semantic edges, reentry
  edges, grafted edges, conflict edges, and version update edges.
- Cross-session grafting, where one session can absorb a selected topic from the
  other.
- Maintenance crawler output for decay, conflicts, and version updates.
- `POST /ingest-text` support for non-chat text ingestion via memo-grafter
  `ingestText()`.
- No login, signup, or authentication.

In memo-grafter `0.2.6`, conflict detection and versioning are separate memory
lifecycle signals: conflicts mean active memories disagree, while version
updates mean a newer memory replaced an older one.

## Stack

```txt
backend/   Node.js + TypeScript + Express + memo-grafter
frontend/  React + TypeScript + Vite + Tailwind CSS + D3
```

The backend and frontend are independent projects with separate `package.json`
files. The root `package.json` only provides helper build scripts.

## Local Setup

Start Postgres:

```bash
cd backend
docker-compose up -d
```

Create `backend/.env` from `backend/.env.example`, set `OPENAI_API_KEY`, then
run:

```bash
npm install
npm run dev
```

Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Defaults:

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`

## Build

From the repository root:

```bash
npm run build
```

Or build each side separately:

```bash
npm --prefix backend run build
npm --prefix frontend run build
```

## Environment

Backend:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/dev_memory
OPENAI_API_KEY=sk-...
PORT=3001
DAILY_MESSAGE_LIMIT=10
RATE_LIMIT_ENABLED=false
FRONTEND_URL=https://your-frontend-domain.com
```

Frontend:

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_DAILY_LIMIT=10
VITE_RATE_LIMIT_ENABLED=false
```

Rate limiting is disabled by default for easier demos.

## Deployment

Recommended demo setup:

- Frontend: Vercel
- Backend: Render
- Database: Neon Postgres with pgvector support

Backend settings:

- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Required env: `DATABASE_URL`, `OPENAI_API_KEY`, `FRONTEND_URL`

Frontend settings:

- Root directory: `frontend`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Required env: `VITE_BACKEND_URL`

`FRONTEND_URL` must exactly match the deployed frontend origin for CORS.

## Notes

memo-grafter owns the core memory behavior: chat invocation, graph persistence,
snapshot retrieval, grafting, crawler maintenance, and direct text ingest. The
playground adds the two-session UI, local browser session ids, display shaping,
and demo controls.

Persisted data lives in Postgres. In-memory Express agent instances reset on
backend restart, but the browser can reload the same session id and recover the
stored graph and chat history.

More details:

- Backend docs: `backend/README.md`
- Frontend docs: `frontend/README.md`
