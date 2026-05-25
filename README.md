# MemoGrafter Playground

MemoGrafter Playground is a full-stack demo application for exploring
developer-focused conversational memory with
[memo-grafter](https://www.npmjs.com/package/memo-grafter).

The app lets a developer chat about project decisions, bugs, plans,
architecture choices, and implementation notes. memo-grafter extracts structured
memories from the conversation, stores them in Postgres/pgvector, and exposes a
knowledge graph that the frontend visualizes live.

## Project Structure

This repository contains two independent projects:

- `backend/` - Node.js, TypeScript, Express, memo-grafter, Postgres/pgvector
- `frontend/` - React, TypeScript, Vite, Tailwind CSS, D3

There is no monorepo tooling. Each folder has its own `package.json`,
dependencies, scripts, and deployment path. The frontend talks to the backend
over HTTP.

## What It Demonstrates

- Conversational memory extraction with memo-grafter
- Persistent memory storage in Postgres with pgvector
- Session-based graph snapshots
- Browser-local session identity with `localStorage`
- Per-browser daily rate limiting
- Interactive graph visualization of topics, memories, and relationships
- A friction-free demo flow with no login or signup

## Local Development

Start with the backend:

```bash
cd backend
npm install
docker-compose up -d
npm run dev
```

Then run the frontend:

```bash
cd frontend
npm install
npm run dev
```

By default:

- Backend runs on `http://localhost:3001`
- Frontend runs on `http://localhost:5173`

## Environment

Backend environment variables are documented in `backend/.env.example`.

Frontend environment variables are documented in `frontend/.env.example`.

You need an OpenAI API key for the memo-grafter OpenAI adapters.

## Documentation

- Backend setup and deployment: `backend/README.md`
- Frontend setup and deployment: `frontend/README.md`

## Notes

memo-grafter handles the memory graph and database access. This project does not
use Prisma or another ORM. Active agent instances and rate-limit buckets are
in-memory for demo simplicity, while messages, memory nodes, topic nodes, and
graph edges are persisted in Postgres.
