# evo

Eat, breed and evolve your species. Start as a microbe in the pond; once your species is at
full strength (`POP_MAX` members, 6 by default) you can **crawl onto land** and start over as a Spore-style animal.

Everything is Rust:

| Part | Dir | What it is |
|------|-----|-----------|
| game server | `server/` | axum WebSocket relay + `/api/health`, `/api/rooms`. Runs as its own k8s service (`prod-evo-server`). |
| client | `client/` | the game, compiled to WASM with [trunk](https://trunkrs.dev) (canvas 2D, no JS framework). |
| client host | `web/` | tiny axum static file server for the built client. Runs as its own k8s service (`prod-evo-client`). |

Traffic split at the ingress (`kubernetes/charles_ingress.yaml`): `/api` and `/ws` go to the
server service, everything else to the client service.

## How a room works

One browser per room is the *host* and simulates everything (two worlds side by side: the pond
and the land). The server just relays messages; when the host leaves, the next player takes over.

## Stages

- **Water**: microbes, flagella, membranes. Breed with your own kind until the species is at `POP_MAX`
  members, then press **N** (or the "Crawl onto land" button) to evolve.
- **Land**: you arrive with fresh genes and your points, as an animal with legs, a tail and a
  head. Same rules (eat, breed, shop for traits) but with land names (Legs, Horns, Stink spray,
  Pack, Thick hide) and its own epic mutants.

## Develop

```bash
rustup target add wasm32-unknown-unknown && cargo install trunk
(cd server && PORT=4000 cargo run)   # terminal 1
(cd client && trunk serve)           # terminal 2, proxies /api and /ws to :4000
```

`cargo build --features debug` adds a `debug_set_pop` WASM export used by browser smoke tests.
It is never enabled in the images.

## Build the images

```bash
docker build -t evo-server -f server/dockerfile server
docker build -t evo-client -f client/dockerfile .
```
