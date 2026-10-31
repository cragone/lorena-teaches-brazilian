# evo

Eat, breed and evolve your species. Start as a microbe in the pond; once your species is at
full strength (`POP_MAX` members, 6 by default) you can **crawl onto land** and start over as a Spore-style animal.

Everything is Rust:

| Part | Dir | What it is |
|------|-----|-----------|
| core | `core/` | the game itself: data types and the whole simulation (native Rust, also compiled into the client for the shared types). |
| game server | `server/` | axum WebSocket server. Runs the world on a tick loop and streams each player a snapshot; `/api/health`, `/api/rooms` (player count). Its own k8s service (`prod-evo-server`). |
| client | `client/` | the browser game, compiled to WASM with [trunk](https://trunkrs.dev) (canvas 2D). It sends your inputs and draws snapshots. |
| client host | `web/` | tiny axum static file server for the built client. Its own k8s service (`prod-evo-client`). |

Traffic split at the ingress (`kubernetes/charles_ingress.yaml`): `/api` and `/ws` go to the
server service, everything else to the client service.

## One shared world

There are no rooms and no host. The server simulates the pond and the land continuously (while
at least one player is connected; an empty world waits exactly as it was left) and sends each
player a snapshot of what is near them about 12 times a second. Players can come and go freely and
nobody's browser tab matters to anyone else. One server pod holds the world in memory, so it
runs as a single replica (and restarting it starts a fresh world).

`cargo run --release --example bench -- 40` (in `core/`) measures a server tick: about 2.7 ms and
around 75 KB/s per player with 40 players spread over the world.

## Stages

- **Water**: microbes, flagella, membranes. Breed with your own kind until the species is at `POP_MAX`
  members, then breed once more with your own kind: that breeding evolves the species onto land.
- **Land**: you arrive with fresh genes, your points and 2 members, as a four-legged animal. Size is capped
  here, so fights are won with what you carry, not how big you are.
  - Water genes translate: Flagella to Legs, Spikes to Horns, Venom cloud to Poison spit (shot
    ahead), Electric buzz to Venom bites (poison), Mitosis to Pack animals, Membrane to Hide.
  - Economy: everything in the land shop costs 4x as much, but eating and hunting earn 3x the
    points. Your points carry over, and so do your genes at about half strength (flagella and
    fins to legs, venom cloud to poison spit, electric buzz and super venom to venom bite,
    mitosis to pack, membrane to hide, spikes to horns, plus size, eyes and diet).
  - New gear: Claws (bite damage), Tail club (whips what is behind you), Charm (befriending).
  - Breeding opens the shop, where you can also change your body shape (Lean, Stocky, Long).
  - Four new epic mutants unlock epic gear: Thornback (thorn armor), Stormwing (pounce),
    Matriarch (alpha aura), Shadow Stalker (ambush).
  - The land has herds of grazers and packs of hunters that roam together.
  - Befriend (B) a nearby animal (it gets a pink ring and a heart): about 30% to start, lower for
    hunters and bigger animals, and every failed try makes that animal warm up. Charm (+18% and
    one more friend slot per level) and Alpha aura make it reliable. Diet matters on both sides:
    herbivore with herbivore is very easy, omnivores are middling, and carnivores are hard to
    befriend and hard to befriend as; two carnivores almost never. Friends follow you, defend
    you, heal fast, and stay with you until your species goes extinct.

## Develop

```bash
rustup target add wasm32-unknown-unknown && cargo install trunk
(cd server && PORT=4000 cargo run)   # terminal 1
(cd client && trunk serve)           # terminal 2, proxies /api and /ws to :4000
(cd core && cargo test)              # simulation tests
```

## Build the images

```bash
docker build -t evo-server -f server/dockerfile .
docker build -t evo-client -f client/dockerfile .
```
