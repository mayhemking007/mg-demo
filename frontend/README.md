# MemoGrafter Playground Frontend

React + TypeScript + Vite frontend for the MemoGrafter Playground demo.

## Environment Variables

Create a local `.env` file from `.env.example`.

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_DAILY_LIMIT=10
VITE_RATE_LIMIT_ENABLED=false
```

- `VITE_BACKEND_URL` must point to the deployed backend URL in production.
- `VITE_RATE_LIMIT_ENABLED` shows and enforces the chat limit UI when set to
  `true`.
- `VITE_DAILY_LIMIT` should match the backend `DAILY_MESSAGE_LIMIT` when rate
  limiting is enabled.

## Development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

The app defaults to Vite's local dev URL, usually `http://localhost:5173`.

## Production Build

Build static assets:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

Deploy the generated `dist/` folder to Vercel, Netlify, Cloudflare Pages, or any
static hosting provider. Set `VITE_BACKEND_URL` in the hosting platform so the
frontend can call the deployed backend.

Production environment checklist:

- `VITE_BACKEND_URL` points to the deployed backend origin, for example
  `https://memografter-api.example.com`.
- `VITE_RATE_LIMIT_ENABLED` matches backend `RATE_LIMIT_ENABLED`.
- `VITE_DAILY_LIMIT` matches backend `DAILY_MESSAGE_LIMIT` when rate limiting is
  enabled.

Docker build:

```bash
docker build ^
  --build-arg VITE_BACKEND_URL=https://your-backend-domain.com ^
  --build-arg VITE_RATE_LIMIT_ENABLED=false ^
  --build-arg VITE_DAILY_LIMIT=10 ^
  -t memografter-playground-frontend .
```

Docker run:

```bash
docker run -p 8080:80 memografter-playground-frontend
```

The Docker image serves the built app through nginx with SPA fallback routing
and long-lived cache headers for `assets/`.

## Browser Storage

The frontend stores these values in `localStorage`:

- `dma_session_a_id` and `dma_session_b_id` - identify the two memory sessions.
- `dma_browser_id` - identifies the browser for daily rate limiting.

Refreshing the page preserves both values.
