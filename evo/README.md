# evo

Eat, breed and evolve your species. Start as a microbe in the pond; once your species is at
full strength (`POP_MAX` members, 6 by default) you can **crawl onto land** and start over as a Spore-style animal.

Everything is Rust:

| Part | Dir | What it is |
|------|-----|-----------|
| core | `core/` | the game itself: data types and the simulations of the animal worlds (`sim`) and the tribes (`tribe`). Native Rust, also compiled into the client for the shared types. |
| game server | `server/` | axum WebSocket server for the cell and animal stages. Runs the world on a tick loop and streams each player a snapshot; `/api/health`, `/api/rooms` (player count). Its own k8s service (`prod-evo-server`). |
| tribe server | `tribe/` | axum WebSocket server for the tribal stage, the world after the animals. Its own k8s service (`prod-evo-tribe`). |
| client | `client/` | the browser game, compiled to WASM with [trunk](https://trunkrs.dev) (canvas 2D). It sends your inputs and draws snapshots, for both the animal and the tribal stages. |
| client host | `web/` | tiny axum static file server for the built client. Its own k8s service (`prod-evo-client`). |

Traffic split at the ingress (`kubernetes/charles_ingress.yaml`): `/api` and `/ws` go to the
game server, `/tribe` to the tribe server, everything else to the client service.

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

## Start at any stage

The start screen lets you begin as a cell (the pond), as a land animal (a fresh species with 1200
points to spend, 2 members, no genes carried over) or straight as a tribe (a plain starting tribe).
Starting as a tribe is routed through the animal server, which asks the tribe service for a ticket
exactly as an evolution does, so there is only one way into the tribes.

## The tribal stage

Breed at full strength (6 members) as a land animal and your species becomes a tribe. The animal
server asks the tribe server for a one-time ticket (`POST /internal/handoff`, only reachable inside
the cluster, optionally guarded by the `INTERNAL_TOKEN` secret), tells your browser, and your
browser reconnects to `/tribe/ws`. All tribes share one persistent world.

It plays like a small Age of Empires: drag to select your people, right-click to gather, hunt, build,
attack or move, build huts (population), farms, a barracks (warriors, archers) and towers, and age up
through the Gathering, Hunter and Chief ages. Lose your great hut and your tribe falls, but you can
begin again with the same genes. You only see what your own people can see.

Your animal's genes become tribe bonuses:

| Animal gene | Tribe bonus |
|-------------|-------------|
| Legs | faster people |
| Claws, tail club | warriors hit harder, and harder against buildings |
| Horns | attackers take damage back |
| Poison spit | archers and towers hit harder |
| Venom bite | warriors poison |
| Thick hide, size | tougher people, sturdier buildings |
| Pack animals | extra villagers in the first camp |
| Friends | each befriended animal joins as a beast warrior |
| Charm | people train faster |
| Diet | herbivores farm better, carnivores hunt and fight better |
| Points | starting food, wood and stone |
| Epic genes | thorn armor, pounce speed, alpha gathering |

Resources are finite and grow back very slowly: about one tree every 12 seconds, one berry bush every
18, one stone every 36 and one deer every 30, never past a fixed total for the whole world. They
mostly reappear in a few rich zones (forests, berry meadows, quarries, hunting grounds) scattered
around the map, so tribes that hold those spots will out-gather everyone else.

Like the cell and animal worlds, the tribes' world wraps around: walk off one edge and you arrive on
the other, and units, buildings, attacks, sight and the minimap all work across the seam.

Not built yet: walls, pathfinding around buildings (people walk straight lines), alliances, and
saving a tribe if you leave or the server restarts.

## Develop

```bash
rustup target add wasm32-unknown-unknown && cargo install trunk
(cd server && PORT=4000 TRIBE_ADDR=127.0.0.1:4200 cargo run)   # terminal 1
(cd tribe && PORT=4200 cargo run)                                # terminal 2
(cd client && trunk serve)                                       # terminal 3, proxies /api and /ws to :4000
(cd core && cargo test)                                          # simulation tests
```

To open the tribal stage without playing through the animals, get a ticket from the tribe server and
open the client with it:

```bash
curl -s -X POST localhost:4200/internal/handoff -d '{"name":"fern","color":5227511,"dna":1200,"traits":{"speed":2,"claws":3,"mitosis":2},"unlocks":[],"friends":1,"species":1}'
# then open http://localhost:8080/?ticket=<the ticket>   (trunk serve must also proxy /tribe)
```

## Build the images

```bash
docker build -t evo-server -f server/dockerfile .
docker build -t evo-tribe -f tribe/dockerfile .
docker build -t evo-client -f client/dockerfile .
```
