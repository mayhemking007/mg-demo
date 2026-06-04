# MemoGrafter Playground

MemoGrafter Playground is a full-stack demo app for exploring conversational
memory with [memo-grafter](https://www.npmjs.com/package/memo-grafter). It turns
ordinary chat messages into persisted topic nodes, typed memory nodes, graph
edges, maintenance signals, and cross-session grafts.

> **Live demo:** Check out the Playground [here](https://mgplayground-green.vercel.app/).

The demo intentionally uses everyday prompts around food, music, film, and
travel so the memory graph is easy to understand without a long technical setup.

## Highlights

- Two independent chat sessions run side by side.
- Each session has its own graph and chat panel.
- Browser-owned session ids are stored in `localStorage`.
- Chat history and graph data persist in Postgres/pgvector through memo-grafter.
- Topic nodes can be grafted from one session into the other.
- Grafted topics bring their memories with them, so the target session can use
  them later.
- D3 renders temporal, semantic, reentry, grafted, memory, conflict, and version
  update edges.
- Memo-grafter maintenance crawler runs per session to detect decay, conflicts,
  and version updates.
- The graph-side `Detected` panel summarizes maintenance results.
- Each session can be cleared independently.
- Auto-generate creates sample messages through the same chat API a user uses.
- The backend exposes an `ingestText` endpoint for direct non-chat text ingest.
- A navbar help walkthrough explains the playground flow.
- No login, signup, or authentication.

## What To Try

1. Click `Auto generate` in Session A or Session B.
2. Wait for the graph to populate with topic and memory nodes.
3. Click `Run Maintenance` when it starts pulsing.
4. Hover graph nodes and maintenance edges to inspect what was detected.
5. Select a topic node in one session and graft it into the other.
6. Ask the target chat about the grafted information.
7. Use `Clear session` to reset only one side.

Conflict and version behavior comes from memo-grafter's maintenance passes. In
memo-grafter `0.2.6`, conflict detection and versioning are separate lifecycle
signals: a conflict means two active memories disagree, while a version update
means a newer memory explicitly replaced an older one.

## Project Structure

```txt
dev-memory-assistant-project/
  backend/    Node.js + TypeScript + Express + memo-grafter
  frontend/   React + TypeScript + Vite + Tailwind CSS + D3
```

There is no monorepo tooling. The backend and frontend are independent projects
with separate `package.json` files. The root `package.json` only provides helper
scripts for building both sides together.

## Quick Start

Start Postgres locally:

```bash
cd backend
docker-compose up -d
```

Create backend env:

```bash
cd backend
copy .env.example .env
```

Set `OPENAI_API_KEY` in `backend/.env`, then install and run:

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

Build both projects from the repository root:

```bash
npm run build
```

Or build each project separately:

```bash
npm --prefix backend run build
npm --prefix frontend run build
```

## Environment

Backend variables live in `backend/.env.example`:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/dev_memory
OPENAI_API_KEY=sk-...
PORT=3001
DAILY_MESSAGE_LIMIT=10
RATE_LIMIT_ENABLED=false
FRONTEND_URL=https://your-frontend-domain.com
```

Frontend variables live in `frontend/.env.example`:

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_DAILY_LIMIT=10
VITE_RATE_LIMIT_ENABLED=false
```

Rate limiting is disabled by default for demos. To enable it again, set both
`RATE_LIMIT_ENABLED=true` and `VITE_RATE_LIMIT_ENABLED=true`.

## How Memo-Grafter Is Used

memo-grafter owns the core memory behavior:

- `MemoGrafterAgent.invoke()` handles conversational memory-aware chat.
- memo-grafter persists messages, topic nodes, memory nodes, and graph edges.
- `getGraphSnapshot()` returns the graph data rendered by the frontend.
- `absorbFromAgent()` powers cross-session grafting.
- `MemoGrafterCrawler` runs conflict detection, versioning, and decay scoring.
- `ingestText()` can ingest non-conversational text directly into the graph.

The playground adds demo-specific glue around that core:

- It maps browser `localStorage` ids to memo-grafter sessions.
- It hydrates chat history from memo-grafter's persisted message buffer.
- It presents two sessions in one UI so grafting is visible.
- It copies grafted topic memories into the target view for a clearer demo.
- It adapts display edges so grafted nodes connect to the closest local topic.
- It filters stale display state so old maintenance metadata does not create
  misleading graph highlights.
- It exposes `POST /ingest-text` as a backend extension point for future note or
  document import UI.

The backend does not use Prisma or another ORM. memo-grafter handles database
access.

## Deployment

Recommended free demo setup:

- Frontend: Vercel
- Backend: Render
- Database: Neon Postgres with pgvector support

Backend deployment:

- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Required env: `DATABASE_URL`, `OPENAI_API_KEY`, `FRONTEND_URL`

Frontend deployment:

- Root directory: `frontend`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Required env: `VITE_BACKEND_URL`

Production pairing:

- Backend `FRONTEND_URL` must exactly match the frontend origin for CORS.
- Frontend `VITE_BACKEND_URL` must point to the deployed backend origin.

## Persistence Notes

The important data persists in Postgres:

- chat messages
- topic nodes
- memory nodes
- topic edges
- memory edges
- graft registry entries

Express agent instances and rate-limit buckets are in memory and reset when the
backend restarts. When the browser sends the same session id again, the backend
recreates the agent and memo-grafter reloads persisted session data from the
database.

Per-session `Clear session` deletes that session's persisted chat and graph data
and rotates only that browser session id. The other session is left unchanged.

## Documentation

- Backend setup and deployment: `backend/README.md`
- Frontend setup and deployment: `frontend/README.md`
