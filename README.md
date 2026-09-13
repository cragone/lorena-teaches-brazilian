# lorena-teaches-brazilian

Lorena's Portuguese ⇄ English interpreting website — a React/Vite/Tailwind
frontend backed by a small Express + SQLite booking API. No Calendly, no
third-party scheduler: availability, bookings, and a lightweight admin view
all live in this repo.

## Structure

- `client/` — React + Vite + Tailwind/daisyUI site (marketing pages + the
  `/book` booking flow + a password-gated `/admin` view).
- `server/` — Express API backed by SQLite (`better-sqlite3`). Owns
  services, weekly availability rules, blocked dates, and bookings.
- `kubernetes/` — production manifests (Deployment/Service/Ingress/PVC) for
  both the client and the API.

## Running locally

Fastest path is Docker Compose, which builds and wires up both services:

```bash
docker compose up --build
```

- Client: http://localhost:8080
- API directly: http://localhost:4000/api/health

Set an admin password by exporting `ADMIN_PASSWORD` before running compose
(defaults to `change-me` otherwise):

```bash
ADMIN_PASSWORD=some-password docker compose up --build
```

### Without Docker

In one terminal:

```bash
cd server
npm install
ADMIN_PASSWORD=some-password npm run dev
```

In another:

```bash
cd client
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:4000` automatically
(see `client/vite.config.ts`).

## Booking data

Bookings, services, and availability rules live in a SQLite file at
`server/data/lorena.sqlite` (git-ignored). Services and a default
Mon–Sat availability schedule are seeded automatically on first run — edit
`server/src/db.js` to change offerings, hours, or pricing.

Admin view is at `/admin` on the client, gated by the `ADMIN_PASSWORD`
env var on the server (there is no admin access at all if that variable
is unset).

## Deployment

Both the client and API are built as separate Docker images and deployed to
the same Kubernetes cluster (see `kubernetes/`). The API's SQLite data lives
on a `ReadWriteOnce` PersistentVolumeClaim, so `prod-lorena-api` must stay at
a single replica.

Deploying the API requires one additional GitHub Actions secret beyond the
existing ACR/Azure ones already configured for this repo:

- `LORENA_ADMIN_PASSWORD` — used to seed the `lorena-api-secrets` Kubernetes
  secret that the API reads its `ADMIN_PASSWORD` from.
