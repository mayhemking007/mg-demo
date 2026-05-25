# Developer Memory Assistant Frontend

React + TypeScript + Vite frontend for the Developer Memory Assistant demo.

## Environment Variables

Create a local `.env` file from `.env.example`.

```env
VITE_BACKEND_URL=http://localhost:3001
VITE_DAILY_LIMIT=10
```

- `VITE_BACKEND_URL` must point to the deployed backend URL in production.
- `VITE_DAILY_LIMIT` should match the backend `DAILY_MESSAGE_LIMIT` for display.

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

## Browser Storage

The frontend stores these values in `localStorage`:

- `dma_session_id` - identifies the current memory session.
- `dma_browser_id` - identifies the browser for daily rate limiting.

Refreshing the page preserves both values.
