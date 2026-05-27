# MemoGrafter Playground

MemoGrafter Playground is a full-stack demo for exploring conversational memory
with [memo-grafter](https://www.npmjs.com/package/memo-grafter). It shows how
chat messages become topic nodes, typed memory nodes, semantic edges, temporal
edges, and grafted cross-session relationships.

The current demo uses light everyday prompts around music, food, and film so it
is easy to generate a readable memory graph without typing a long technical
conversation.

> **Live Demo:** Check out the Playground [here](https://mgplayground-green.vercel.app/).

## What The App Does

- Runs two independent memory sessions side by side.
- Shows a graph panel and chat panel for each session.
- Stores each session id in `localStorage`.
- Persists chat history and graph data in Postgres/pgvector through
  memo-grafter.
- Lets you select a topic node in one graph and graft it into the other session.
- Copies the grafted topic's memories with it so the target graph updates
  immediately.
- Shows grafted, semantic, temporal, reentry, and memory edges in the graph
  legend.
- Includes an `Auto generate` button that sends three sample music/food/film
  messages through the normal chat API.
- Includes per-session `Clear session` buttons so one side can be reset without
  affecting the other.
- Keeps rate limiting available but disabled by default for easier demos.

There is no login, signup, or authentication.

## Project Structure

This repository contains two independent projects:

- `backend/` - Node.js, TypeScript, Express, memo-grafter, Postgres/pgvector
- `frontend/` - React, TypeScript, Vite, Tailwind CSS, D3

There is no monorepo tooling. Each folder has its own `package.json`, scripts,
dependencies, and deployment path. The frontend communicates with the backend
over HTTP.

## Local Development

Start the database and backend:

```bash
cd backend
npm install
docker-compose up -d
npm run dev
```

Then start the frontend:

```bash
cd frontend
npm install
npm run dev
```

Defaults:

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`

## Environment

Backend variables are documented in `backend/.env.example`.

Important backend values:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `PORT`
- `FRONTEND_URL`
- `RATE_LIMIT_ENABLED=false`
- `DAILY_MESSAGE_LIMIT=10`

Frontend variables are documented in `frontend/.env.example`.

Important frontend values:

- `VITE_BACKEND_URL=http://localhost:3001`
- `VITE_RATE_LIMIT_ENABLED=false`
- `VITE_DAILY_LIMIT=10`

To re-enable the demo message limit later, set both rate-limit flags to `true`.

## Memo-Grafter

memo-grafter handles the memory graph and database access. This app does not use
Prisma or another ORM. The backend creates `MemoGrafterAgent` instances, invokes
them for chat, reads persisted graph snapshots, and uses memo-grafter's grafting
API to copy topics between sessions.

The playground adds demo-specific behavior around memo-grafter:

- Browser session ids are forced into memo-grafter sessions so refreshes reload
  the same graph.
- Chat history is hydrated from the persisted message buffer.
- Grafted topic memories are copied into the target session so the visual graph
  clearly shows what moved.
- Display edges are adjusted so grafted nodes connect to the closest local topic
  instead of rendering an invisible external source node.

## Documentation

- Backend setup and deployment: `backend/README.md`
- Frontend setup and deployment: `frontend/README.md`
- Implementation reference: `PLAN.md`

## Deployment Readiness

Backend:

- Build with `npm run build` inside `backend/`.
- Deploy as a Node service with `npm start`, or build the included Docker image.
- Provide `DATABASE_URL`, `OPENAI_API_KEY`, and `FRONTEND_URL`.
- Use a Postgres provider that supports pgvector.
- Keep `RATE_LIMIT_ENABLED=false` for open demos, or set it to `true` with
  `DAILY_MESSAGE_LIMIT` when you want the browser limit back.

Frontend:

- Build with `npm run build` inside `frontend/`.
- Deploy `frontend/dist/` to any static host, or build the included nginx Docker
  image.
- Set `VITE_BACKEND_URL` to the deployed backend origin before building.
- Match `VITE_RATE_LIMIT_ENABLED` and `VITE_DAILY_LIMIT` to the backend values
  when rate limiting is enabled.

Production pairing:

- Backend `FRONTEND_URL` must match the frontend origin for CORS.
- Frontend `VITE_BACKEND_URL` must match the backend origin for API calls.

## Notes

Active agent instances are in memory and reset on server restart. The important
demo data - messages, topic nodes, memory nodes, and graph edges - persists in
Postgres. Per-session clear deletes that session's persisted chat and graph data
and rotates only that browser session id.
