import Phaser from "phaser";
import { runLobby } from "./lobby.js";
import { KEYS, keyLabel, mountSettings, settingsOpen } from "./settings.js";

const WORLD = 8000;
// cells and meat further than this from a player are left out of that player's snapshots
const RENDER_DISTANCE = 1800; // a screen is ~1300 wide, so far-off cells are wasted bytes
const START_MASS = 20;
const PLANT_COUNT = 1100;
const ENEMY_COUNT = 100; // includes ~40% harmless amoebas
const MATE_COUNT = 6;
const FOOD_CELL = 256;
const HP_REGEN = 0.4; // hp per second
const POISON_COOL = 7; // seconds, minus 1 per venom level
const POP_START = 1;
const POP_MAX = 6;
const BREED_COOLDOWN = 20;
const EAT_RATIO = 1.15;
const TAU = Math.PI * 2;

// what the points can buy when you breed (size can go both ways)
// each tier costs far more than the last
const tier = (base, growth) => (to) => Math.round(base * Math.pow(growth, Math.abs(to) - 1));
const SPLIT_COOLDOWN = 10;
const SPLIT_MIN_MASS = 28;
const COLONY_LIFE = 30;
const TRAITS = [
  { key: "size", name: "Size", min: -3, max: 5, cost: tier(400, 2.3), desc: "Big eats nearly anything but is slow and easy to spot. Small is fast and hard to see." },
  { key: "speed", name: "Flagella", min: 0, max: 4, cost: tier(200, 2.2), desc: "+18% swim speed per level." },
  { key: "spikes", name: "Spikes", min: 0, max: 3, cost: tier(250, 2.5), desc: "Hurts anything that touches or bites you, even bigger cells." },
  { key: "venom", name: "Venom", min: 0, max: 3, cost: tier(300, 2.5), desc: "Shoot a poison cloud behind you to stop chasers (key F). Each level reaches farther, hurts more and recharges faster." },
  { key: "mitosis", name: "Mitosis", min: 0, max: 4, cost: tier(350, 2.5), desc: "Split in half to send out colony cells. Each level allows one more colony." },
  { key: "tough", name: "Thick membrane", min: 0, max: 3, cost: tier(200, 2.4), desc: "+60% health and 12% less damage per level." },
];
const freshTraits = () => ({ size: 0, speed: 0, spikes: 0, venom: 0, tough: 0, mitosis: 0, eyes: 0, diet: "herb" });
const EYE_CHOICES = [0, 1, 2, 3]; // 0 = grows with size
const PLAYER_COLORS = [0x4fc3f7, 0xffb74d, 0xba68c8, 0x81c784, 0xf06292, 0xfff176, 0x4dd0e1, 0xa1887f];
// how much mass (and points) each food type is worth to each diet
const DIETS = [
  { key: "herb", name: "Herbivore", cost: 300, plant: 1.5, meat: 0 },
  { key: "omni", name: "Omnivore", cost: 900, plant: 1, meat: 1 },
  { key: "carn", name: "Carnivore", cost: 300, plant: 0, meat: 1.5 },
];
const dietOf = (key) => DIETS.find((d) => d.key === key) ?? DIETS[1];

const radius = (mass) => Math.sqrt(mass) * 4.2;
const maxSpeed = (mass, speedLvl = 0) => (300 / Math.pow(mass, 0.22)) * (1 + 0.18 * speedLvl);
const maxHp = (c) => (60 + c.mass * 2) * (1 + 0.6 * c.tough);
const baseMass = (size) => START_MASS * Math.pow(1.4, size);
const spikeCount = (lvl) => (lvl ? 2 + lvl * 3 : 0);
// cells that belong to the same player (the main cell and its colony) never fight
const allied = (a, b) => {
  const ra = a.pl ?? a.owner ?? (a.splitter ? a : null);
  return !!ra && ra === (b.pl ?? b.owner);
};
const rand = (a, b) => a + Math.random() * (b - a);

const mixColor = (a, b, t) => {
  const ch = (v, w) => Math.round(v + (w - v) * t);
  return (ch((a >> 16) & 255, (b >> 16) & 255) << 16) | (ch((a >> 8) & 255, (b >> 8) & 255) << 8) | ch(a & 255, b & 255);
};

const shade = (c, amt) => {
  const to = amt > 0 ? 255 : 0;
  const t = Math.abs(amt);
  const ch = (v) => Math.round(v + (to - v) * t);
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
};

// ---- tiny procedural audio -------------------------------------------------
let actx = null;
const sfx = (freq, dur, type = "sine", vol = 0.06, slide = 0) => {
  try {
    actx ||= new AudioContext();
    if (actx.state === "suspended") actx.resume();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, actx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), actx.currentTime + dur);
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch {
    /* audio unavailable */
  }
};

// ---- game scene ------------------------------------------------------------
// One browser in each room is the host and runs the whole simulation (bots, food,
// every player). The server only relays. Everyone else sends inputs and draws the
// snapshots the host broadcasts. Solo play is just a host with nobody else.
class MainScene extends Phaser.Scene {
  constructor() {
    super("main");
  }

  create() {
    const boot = this.registry.get("boot");
    this.net = boot.net;
    this.myId = boot.myId;
    this.myName = boot.name;
    this.isHost = boot.isHost;
    this.room = boot.room ?? "";
    this.cameras.main.setBounds(-300, -300, WORLD + 600, WORLD + 600);
    this.gfx = this.add.graphics();
    this.pts = Array.from({ length: 40 }, () => ({ x: 0, y: 0 }));
    this.particles = [];
    this.labels = new Map();
    this.t = 0;
    this.toast = "";
    this.toastT = 0;
    this.uiClickAt = 0;
    this.netDown = false;
    this.nextId = 1;
    this.snapT = 0;
    this.inT = 0;
    this.evq = [];
    this.plantDiff = [];
    this.pls = new Map(); // host: player records
    this.food = [];
    this.enemies = [];
    this.mates = [];
    this.colonies = [];
    this.toxins = []; // poison clouds shot behind cells
    this.live = [];
    this.views = new Map(); // client: cells from the latest snapshots
    this.plants = [];
    this.meat = [];
    this.recs = []; // client: player records from the latest snapshot
    this.ready = false;
    this.focus = { x: WORLD / 2, y: WORLD / 2, mass: START_MASS };
    this.camPos = { x: WORLD / 2, y: WORLD / 2 };
    this.down = new Set(); // keys currently held (by KeyboardEvent.code)
    this.kbMode = false; // true once a move key is used, until the mouse moves again

    if (this.isHost) this.startWorld(boot.name);

    this.input.on("pointerdown", () => this.localBite());
    this.input.on("pointermove", (p) => {
      if (Math.abs(p.x - p.prevPosition.x) + Math.abs(p.y - p.prevPosition.y) > 2) this.kbMode = false;
    });
    const bound = () => new Set(Object.values(KEYS));
    window.addEventListener("keydown", (e) => {
      if (settingsOpen() || e.target.tagName === "INPUT") return;
      if (bound().has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      if (e.code === KEYS.bite) this.localBite();
      else if (e.code === KEYS.breed) this.sendAct({ t: this.meRec()?.shop ? "close" : "breed" });
      else if (e.code === KEYS.split) this.sendAct({ t: "split" });
      else if (e.code === KEYS.poison) this.sendAct({ t: "poison" });
      else if (e.code === "Escape" || e.code === "Enter") this.sendAct({ t: "close" });
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
    window.addEventListener("blur", () => this.down.clear());
    const fromUi = (m) => {
      this.uiClickAt = performance.now();
      this.sendAct(m);
    };
    this.game.events.on("buy", (key, dir) => fromUi({ t: "buy", key, dir }));
    this.game.events.on("diet", (key) => fromUi({ t: "diet", key }));
    this.game.events.on("look", (what) => fromUi({ t: "look", what }));
    this.game.events.on("closeShop", () => fromUi({ t: "close" }));
    this.game.events.on("breed", () => fromUi({ t: "breed" }));
    this.game.events.on("split", () => fromUi({ t: "split" }));
    this.game.events.on("poison", () => fromUi({ t: "poison" }));
    if (this.net) {
      this.net.onclose = () => (this.netDown = true);
      this.net.setHandler((m) => this.onNet(m));
    }
    this.cameras.main.centerOn(this.camPos.x, this.camPos.y);
    this.cameras.main.setZoom(1.1);
    this.scene.launch("ui");
  }

  // -- networking ---------------------------------------------------------------
  sendAct(m) {
    if (this.isHost) this.act(this.myId, m);
    else this.net?.send(m);
  }

  // where the local player is steering: held move keys win, then the mouse; null = coast
  localTarget(px, py) {
    const d = this.down;
    const dx = (d.has(KEYS.right) ? 1 : 0) - (d.has(KEYS.left) ? 1 : 0);
    const dy = (d.has(KEYS.down) ? 1 : 0) - (d.has(KEYS.up) ? 1 : 0);
    if (dx || dy) {
      this.kbMode = true;
      const len = Math.hypot(dx, dy);
      return { x: px + (dx / len) * 400, y: py + (dy / len) * 400 };
    }
    if (this.kbMode) return null;
    const ptr = this.input.activePointer;
    return this.cameras.main.getWorldPoint(ptr.x, ptr.y);
  }

  localBite() {
    const r = this.meRec();
    if (!r || r.shop || r.dead || performance.now() - this.uiClickAt < 250) return;
    this.sendAct({ t: "bite" });
  }

  sendState(to) {
    const plants = this.food.slice(0, PLANT_COUNT).map((f) => [Math.round(f.x), Math.round(f.y), Math.round(f.size * 10) / 10]);
    this.net.send({ t: "state", to, plants });
  }

  onNet(m) {
    if (this.isHost) {
      if (m.t === "join") {
        if (!this.pls.has(m.id)) this.addPlayer(m.id, m.name);
        this.sendState(m.id);
      } else if (m.t === "leave") this.removePlayer(m.id);
      else if (m.from !== undefined) this.act(m.from, m);
      return;
    }
    if (m.t === "state") {
      this.plants = m.plants.map(([x, y, size]) => ({ x, y, kind: 0, mass: 1, bob: rand(0, TAU), size }));
      this.ready = true;
    } else if (m.t === "snap" && this.ready) this.applySnap(m);
    else if (m.t === "host") this.becomeHost(m.left);
  }

  // host: what a player may ask for
  act(id, m) {
    let pl = this.pls.get(id);
    if (!pl && m.t === "hello") {
      // a joiner still waiting on us (its join was missed or the state was lost): add it and resend
      pl = this.addPlayer(id, m.name);
      this.sendState(id);
    }
    if (!pl) return;
    switch (m.t) {
      case "in":
        pl.in = { x: Number(m.x) || 0, y: Number(m.y) || 0 };
        break;
      case "bite":
        if (!pl.shopOpen) this.bite(pl.cell);
        break;
      case "breed":
        this.tryBreed(pl);
        break;
      case "split":
        this.splitCell(pl);
        break;
      case "poison":
        this.shootPoison(pl);
        break;
      case "buy":
        this.buy(pl, m.key, m.dir === -1 ? -1 : 1);
        break;
      case "diet":
        this.setDiet(pl, m.key);
        break;
      case "look":
        this.setLook(pl, m.what);
        break;
      case "close":
        pl.shopOpen = false;
        break;
    }
  }

  // visual/audio events: applied here and (for the host) queued for everyone else
  fx(ev) {
    this.applyFx(ev);
    this.evq.push(ev);
  }

  applyFx(ev) {
    if (ev.k === "b") this.spawnParticles(ev.x, ev.y, ev.c, ev.n, ev.s);
    else if (ev.p !== this.myId) return;
    else if (ev.k === "s") setTimeout(() => sfx(...ev.a), ev.d ?? 0);
    else if (ev.k === "sh") this.cameras.main.shake(ev.ms, ev.i);
    else if (ev.k === "t") this.say(ev.m, ev.s);
  }

  sfxTo(c, ...a) {
    if (c.pl) this.fx({ k: "s", p: c.pl.id, a });
  }

  say(msg, secs = 2.2) {
    this.toast = msg;
    this.toastT = secs;
  }

  // -- host: world + players ------------------------------------------------------
  startWorld(name) {
    this.food = Array.from({ length: PLANT_COUNT }, () => this.newPlant());
    this.enemies = Array.from({ length: ENEMY_COUNT }, () => this.newEnemy());
    this.mates = Array.from({ length: MATE_COUNT }, () => this.newMate());
    this.addPlayer(this.myId, name);
    this.ready = true;
  }

  addPlayer(id, name, saved) {
    const used = new Set([...this.pls.values()].map((p) => p.color));
    const color = saved?.col ?? PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[this.pls.size % PLAYER_COLORS.length];
    const pl = { id, name: String(name || "cell").slice(0, 16), color, dna: 0, traits: freshTraits(), pop: POP_START, gen: 1, extinct: false, respawnT: 0, breedCool: 0, splitCool: 0, poisonCool: 0, nearMate: null, shopOpen: false, shopMsg: "", in: null };
    const spot = this.spawnSpot();
    const c = this.newCell(color, spot.x, spot.y, baseMass(0), Math.random() * 100);
    c.isPlayer = true;
    c.pl = pl;
    c.name = pl.name;
    c.shield = 3;
    pl.cell = c;
    this.pls.set(id, pl);
    this.applyTraits(pl);
    c.hp = maxHp(c);
    return pl;
  }

  removePlayer(id) {
    const pl = this.pls.get(id);
    if (!pl) return;
    pl.cell.dead = true;
    this.pls.delete(id);
  }

  spawnSpot() {
    let x, y;
    do {
      x = rand(300, WORLD - 300);
      y = rand(300, WORLD - 300);
    } while (this.enemies.some((e) => Math.hypot(e.x - x, e.y - y) < 500));
    return { x, y };
  }

  // the host left: carry on from what we have been seeing
  becomeHost(left) {
    if (this.isHost) return;
    this.isHost = true;
    const meat = this.meat.map((m) => ({ x: m.x, y: m.y, kind: 1, mass: Math.max(0.5, ((m.size - 5) / 1.4) ** 2), bob: rand(0, TAU), size: m.size, vx: 0, vy: 0, ttl: 20 }));
    this.food = this.plants.concat(meat);
    this.enemies = [];
    this.mates = [];
    this.colonies = [];
    this.toxins = [];
    this.pls = new Map();
    let maxId = 0;
    for (const v of this.views.values()) {
      if (v.kind === 2 || v.kind === 4) continue;
      const c = this.newCell(v.color, v.x, v.y, v.mass, v.seed / 17.3);
      Object.assign(c, { id: v.id, angle: v.angle, elong: v.elong, eyes: v.eyes, flagella: v.flagella, spikes: v.spikes, spikeLvl: v.spikes ? Math.round((v.spikes - 2) / 3) : 0, wander: rand(0, TAU) });
      c.hp = v.hpf * maxHp(c);
      maxId = Math.max(maxId, v.id);
      if (v.kind === 1) {
        c.isMate = true;
        this.mates.push(c);
      } else {
        c.aggressive = v.kind === 3;
        this.enemies.push(c);
      }
    }
    this.nextId = Math.max(this.nextId, maxId + 1);
    while (this.enemies.length < ENEMY_COUNT) this.enemies.push(this.newEnemy());
    while (this.mates.length < MATE_COUNT) this.mates.push(this.newMate());
    for (const r of this.recs) {
      if (r.id === left) continue;
      const pl = this.addPlayer(r.id, r.n, r);
      Object.assign(pl, { dna: r.dna, pop: r.pop, gen: r.gen, breedCool: r.cb, shopOpen: !!r.shop, traits: { ...r.tr } });
      const v = this.views.get(`p${r.id}`);
      const c = pl.cell;
      this.applyTraits(pl);
      if (v) {
        Object.assign(c, { x: v.x, y: v.y, angle: v.angle, mass: v.mass });
        c.hp = v.hpf * maxHp(c);
      } else {
        c.dead = true;
        pl.respawnT = 1;
      }
    }
    this.views = new Map();
    this.say("Host left — you are now running the room", 3);
  }

  // food bucketed into a coarse grid each frame, so eating/AI only look at what is nearby
  buildFoodGrid() {
    const grid = new Map();
    for (let i = 0; i < this.food.length; i++) {
      const f = this.food[i];
      if (i < PLANT_COUNT) f.idx = i;
      const k = Math.floor(f.x / FOOD_CELL) * 1024 + Math.floor(f.y / FOOD_CELL);
      const b = grid.get(k);
      if (b) b.push(f);
      else grid.set(k, [f]);
    }
    this.foodGrid = grid;
  }

  foodNear(x, y, r) {
    const out = [];
    if (!this.foodGrid) return out;
    const x0 = Math.floor((x - r) / FOOD_CELL);
    const x1 = Math.floor((x + r) / FOOD_CELL);
    const y0 = Math.floor((y - r) / FOOD_CELL);
    const y1 = Math.floor((y + r) / FOOD_CELL);
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const b = this.foodGrid.get(gx * 1024 + gy);
        if (b) for (const f of b) if (!f.eaten) out.push(f);
      }
    }
    return out;
  }

  cells() {
    const out = [];
    for (const pl of this.pls.values()) if (!pl.cell.dead) out.push(pl.cell);
    for (const c of this.enemies) if (!c.dead) out.push(c);
    for (const c of this.mates) if (!c.dead) out.push(c);
    for (const c of this.colonies) if (!c.dead) out.push(c);
    return out;
  }

  // -- spawning ---------------------------------------------------------------
  newPlant() {
    return { x: rand(0, WORLD), y: rand(0, WORLD), kind: 0, mass: 1, bob: rand(0, TAU), size: rand(4, 7) };
  }

  newMeat(x, y, mass) {
    const a = rand(0, TAU);
    const s = rand(40, 140);
    return { x, y, kind: 1, mass, bob: rand(0, TAU), size: 5 + Math.sqrt(mass) * 1.4, vx: Math.cos(a) * s, vy: Math.sin(a) * s, ttl: 40 };
  }

  newCell(color, x, y, mass, seed) {
    const c = {
      id: this.nextId++, color, x, y, mass, vx: 0, vy: 0, angle: rand(0, TAU), seed: seed * 17.3,
      bite: 0, cool: 0, lookx: 1, looky: 0, elong: 1, eyes: 1, flagella: 1, spikes: 0, pulse: 0,
      spikeLvl: 0, venomLvl: 0, speedLvl: 0, tough: 0, diet: "omni", poison: null, lastPoison: -9, lastHit: -9,
      shield: 0, hpf: 1, psn: false, sp: 0, isLocal: false,
    };
    c.hp = maxHp(c);
    return c;
  }

  randomSpot(minFromPlayer) {
    let x, y;
    do {
      x = rand(0, WORLD);
      y = rand(0, WORLD);
    } while ([...this.pls.values()].some((pl) => Math.hypot(x - pl.cell.x, y - pl.cell.y) < minFromPlayer));
    return { x, y };
  }

  // a tiny harmless blob: just drifts about so a small carnivore always has something to catch
  newAmoeba() {
    const { x, y } = this.randomSpot(200);
    const color = Phaser.Display.Color.HSLToColor(rand(0.1, 0.16), 0.5, 0.62).color;
    const e = this.newCell(color, x, y, START_MASS * 0.25, Math.random() * 100);
    e.amoeba = true;
    e.wander = rand(0, TAU);
    e.flagella = 0;
    return e;
  }

  newEnemy() {
    if (Math.random() < 0.4) return this.newAmoeba();
    const aggressive = Math.random() < 0.4;
    // hostile microbes run hot (red/orange/magenta), peaceful ones cool (green/blue/violet)
    const hue = aggressive ? rand(-0.05, 0.1) : rand(0.28, 0.8);
    const color = Phaser.Display.Color.HSLToColor((hue + 1) % 1, 0.65, 0.55).color;
    const { x, y } = this.randomSpot(900);
    const apex = Math.random() < 0.08;
    const mass = apex ? rand(START_MASS * 5, START_MASS * 10) : rand(START_MASS * 0.4, START_MASS * 4);
    const e = this.newCell(color, x, y, mass, Math.random() * 100);
    e.aggressive = aggressive;
    e.wander = rand(0, TAU);
    e.elong = rand(0.9, 1.3);
    e.eyes = 1 + Math.floor(Math.random() * 3);
    e.flagella = 1 + Math.floor(Math.random() * 3);
    e.spikeLvl = aggressive ? Math.floor(Math.random() * 3) + (apex ? 1 : 0) : Math.random() < 0.15 ? 1 : 0;
    e.spikes = spikeCount(e.spikeLvl);
    e.splitter = aggressive && Math.random() < 0.5; // some hunters can split off a helper cell
    e.splitCool = rand(4, 12);
    return e;
  }

  // a wandering member of your species: neutral colour, wants to breed
  newMate() {
    const { x, y } = this.randomSpot(600);
    const m = this.newCell(0xcfeaff, x, y, START_MASS * rand(0.9, 1.3), Math.random() * 100);
    m.isMate = true;
    m.wander = rand(0, TAU);
    m.eyes = 1;
    m.flagella = 1 + Math.floor(Math.random() * 2);
    return m;
  }

  applyTraits(pl) {
    this.applyTraitsTo(pl.cell, pl.traits);
  }

  applyTraitsTo(p, T) {
    p.speedLvl = T.speed;
    p.spikeLvl = T.spikes;
    p.venomLvl = T.venom;
    p.tough = T.tough;
    p.diet = T.diet;
    p.eyes = T.eyes || Math.max(1, Math.min(3, 1 + Math.floor(T.size / 2)));
    p.flagella = Math.min(4, 1 + T.speed);
    p.spikes = spikeCount(T.spikes);
    p.elong = 1 + 0.07 * T.speed + 0.02 * Math.max(0, T.size);
    p.hp = Math.min(p.hp, maxHp(p));
  }

  // -- breeding + evolution shop -----------------------------------------------
  tryBreed(pl) {
    const p = pl.cell;
    if (p.dead || pl.shopOpen) return;
    const m = pl.nearMate;
    if (!m || m.dead || pl.breedCool > 0) return;
    const full = pl.pop >= POP_MAX;
    pl.pop = Math.min(POP_MAX, pl.pop + 1);
    pl.breedCool = BREED_COOLDOWN;
    pl.shopMsg = full ? "Species at full strength" : "A new member joins your species!";
    this.burst((p.x + m.x) / 2, (p.y + m.y) / 2, 0xff8fd0, 36, 240);
    this.mates[this.mates.indexOf(m)] = this.newMate();
    [523, 659, 784].forEach((f, i) => this.fx({ k: "s", p: pl.id, a: [f, 0.2, "triangle", 0.06], d: i * 80 }));
    pl.shopOpen = true;
  }

  colonyCount(pl) {
    return this.colonies.filter((c) => c.owner === pl && !c.dead).length;
  }

  // split in half: the other half becomes a colony cell that fights for you, then rejoins
  splitCell(pl) {
    const p = pl.cell;
    if (p.dead || pl.shopOpen || pl.splitCool > 0) return;
    if (p.mass < SPLIT_MIN_MASS) return this.fx({ k: "t", p: pl.id, m: "Too small to split", s: 1.2 });
    if (!pl.traits.mitosis) return this.fx({ k: "t", p: pl.id, m: "Evolve Mitosis to split", s: 1.2 });
    if (this.colonyCount(pl) >= pl.traits.mitosis) return this.fx({ k: "t", p: pl.id, m: "Colony is full", s: 1.2 });
    pl.splitCool = SPLIT_COOLDOWN;
    p.mass /= 2;
    const r = radius(p.mass);
    const ca = Math.cos(p.angle);
    const sa = Math.sin(p.angle);
    const col = this.newCell(pl.color, p.x + ca * r * 1.3, p.y + sa * r * 1.3, p.mass, Math.random() * 100);
    col.owner = pl;
    col.life = COLONY_LIFE;
    col.angle = p.angle;
    col.vx = p.vx + ca * 650;
    col.vy = p.vy + sa * 650;
    this.applyTraitsTo(col, pl.traits);
    col.hp = maxHp(col);
    this.colonies.push(col);
    p.hp = Math.min(p.hp, maxHp(p));
    p.pulse = 1;
    this.burst(p.x, p.y, pl.color, 20, 220);
    this.sfxTo(p, 400, 0.2, "triangle", 0.07, -160);
  }

  // venom: spit a spreading poison cloud out behind you, to hold off whatever is chasing
  shootPoison(pl) {
    const p = pl.cell;
    const lvl = pl.traits.venom;
    if (p.dead || pl.shopOpen || pl.poisonCool > 0) return;
    if (!lvl) return this.fx({ k: "t", p: pl.id, m: "Evolve Venom to shoot poison", s: 1.2 });
    pl.poisonCool = POISON_COOL - lvl;
    // behind = opposite the direction of travel (or the way we face when drifting)
    const moving = Math.hypot(p.vx, p.vy) > 20;
    const back = (moving ? Math.atan2(p.vy, p.vx) : p.angle) + Math.PI;
    const r = radius(p.mass);
    const n = 5 + lvl * 2;
    for (let i = 0; i < n; i++) {
      const a = back + rand(-0.45, 0.45);
      const sp = (230 + 110 * lvl) * rand(0.6, 1);
      this.toxins.push({
        x: p.x + Math.cos(back) * r, y: p.y + Math.sin(back) * r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 22 + 5 * lvl, life: 3 + 0.6 * lvl, max: 3 + 0.6 * lvl, dps: 6 + 5 * lvl, owner: p,
      });
    }
    this.burst(p.x, p.y, 0x7dff3a, 12, 160);
    this.sfxTo(p, 180, 0.2, "sawtooth", 0.06, 120);
  }

  updateToxins(dt) {
    for (const pl of this.pls.values()) pl.poisonCool = Math.max(0, pl.poisonCool - dt);
    for (let i = this.toxins.length - 1; i >= 0; i--) {
      const t = this.toxins[i];
      t.life -= dt;
      if (t.life <= 0 || t.owner.dead) {
        this.toxins.splice(i, 1);
        continue;
      }
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      const drag = Math.max(0, 1 - dt * 2.2);
      t.vx *= drag;
      t.vy *= drag;
      for (const c of this.live) {
        if (c.dead || c.shield > 0 || allied(t.owner, c) || c.isMate) continue;
        if (Math.hypot(c.x - t.x, c.y - t.y) > t.r + radius(c.mass) * 0.8) continue;
        this.hurt(c, t.dps * dt, t.owner);
        if (!c.dead) c.poison = { dps: Math.max(c.poison?.dps ?? 0, t.dps * 0.35), t: 2.5, by: t.owner };
      }
    }
  }

  // an NPC hunter splits too: part of its mass becomes a helper that fights, then rejoins
  splitNpc(e) {
    e.splitCool = rand(18, 28);
    if (this.colonies.filter((c) => c.owner === e && !c.dead).length >= 2) return;
    const ca = Math.cos(e.angle);
    const sa = Math.sin(e.angle);
    const r = radius(e.mass);
    const part = e.mass * 0.4;
    e.mass -= part;
    const kid = this.newCell(e.color, e.x + ca * r * 1.3, e.y + sa * r * 1.3, part, Math.random() * 100);
    Object.assign(kid, { owner: e, life: COLONY_LIFE, angle: e.angle, vx: e.vx + ca * 650, vy: e.vy + sa * 650, eyes: e.eyes, flagella: e.flagella, elong: e.elong, spikeLvl: e.spikeLvl, spikes: e.spikes });
    kid.hp = maxHp(kid);
    this.colonies.push(kid);
    e.hp = Math.min(e.hp, maxHp(e));
    e.pulse = 1;
    this.burst(e.x, e.y, e.color, 14, 180);
  }

  moveColony(e, dt) {
    const home = e.owner.cell ?? e.owner; // a player's cell, or the NPC that split
    if (home.dead) {
      e.dead = true;
      this.colonies.splice(this.colonies.indexOf(e), 1);
      return;
    }
    e.life -= dt;
    const re = radius(e.mass);
    let target = null;
    let best = 650;
    if (e.life > 0) {
      for (const o of this.live) {
        if (o === e || o.dead || o.shield > 0 || o.isMate || allied(e, o)) continue;
        if (o.mass * EAT_RATIO > e.mass && !e.spikeLvl) continue; // too big to bother
        const d = Math.hypot(o.x - e.x, o.y - e.y);
        if (d < best) (best = d), (target = o);
      }
    }
    let dirx;
    let diry;
    let power = 1;
    if (target) {
      dirx = target.x - e.x;
      diry = target.y - e.y;
      if (best < re * 2.2 + 140) this.bite(e, target);
    } else {
      dirx = home.x - e.x;
      diry = home.y - e.y;
      const d = Math.hypot(dirx, diry);
      if (e.life <= 0 && d < radius(home.mass) + re) {
        // time is up: rejoin the main cell
        home.mass += e.mass;
        e.dead = true;
        this.colonies.splice(this.colonies.indexOf(e), 1);
        this.burst(e.x, e.y, e.color, 14, 140);
        return;
      }
      if (e.life > 0 && d < 260) power = 0.15;
    }
    const len = Math.hypot(dirx, diry) || 1;
    e.lookx = dirx / len;
    e.looky = diry / len;
    this.steer(e, e.lookx, e.looky, power, dt);
  }

  buy(pl, key, dir) {
    if (!pl.shopOpen) return;
    const t = TRAITS.find((x) => x.key === key);
    if (!t) return;
    const to = pl.traits[key] + dir;
    if (to < t.min || to > t.max) return;
    const cost = t.cost(to);
    if (pl.dna < cost) return this.sfxTo(pl.cell, 140, 0.12, "square", 0.04);
    const before = baseMass(pl.traits.size);
    pl.dna -= cost;
    pl.traits[key] = to;
    if (key === "size") pl.cell.mass += baseMass(to) - before;
    this.applyTraits(pl);
    pl.cell.pulse = 1;
    this.sfxTo(pl.cell, 660, 0.15, "triangle", 0.07, 220);
  }

  // looks are free: cycle the colour or the eye count
  setLook(pl, what) {
    if (!pl.shopOpen) return;
    if (what === "color") {
      const i = PLAYER_COLORS.indexOf(pl.color);
      pl.color = PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length];
      pl.cell.color = pl.color;
      for (const c of this.live) if (c.owner === pl) c.color = pl.color;
    } else if (what === "eyes") {
      pl.traits.eyes = EYE_CHOICES[(EYE_CHOICES.indexOf(pl.traits.eyes) + 1) % EYE_CHOICES.length];
      this.applyTraits(pl);
    } else return;
    pl.cell.pulse = 1;
    this.sfxTo(pl.cell, 520, 0.1, "triangle", 0.05, 160);
  }

  setDiet(pl, key) {
    const diet = DIETS.find((d) => d.key === key);
    if (!pl.shopOpen || pl.traits.diet === key || !diet) return;
    if (pl.dna < diet.cost) return this.sfxTo(pl.cell, 140, 0.12, "square", 0.04);
    pl.dna -= diet.cost;
    pl.traits.diet = key;
    this.applyTraits(pl);
    pl.cell.pulse = 1;
    this.sfxTo(pl.cell, 660, 0.15, "triangle", 0.07, 220);
  }

  // -- main loop --------------------------------------------------------------
  update(_, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.t += dt;
    this.toastT = Math.max(0, this.toastT - dt);
    if (this.isHost) this.stepHost(dt);
    else this.stepClient(dt);
    this.updateParticles(dt);
    this.updateCamera();
    this.draw();
    this.publishHud();
  }

  stepHost(dt) {
    for (const pl of this.pls.values()) this.stepPlayer(pl, dt);
    this.live = this.cells();
    for (const c of this.live) if (!c.isPlayer) this.moveAI(c, dt);
    for (const c of this.live) this.tickStatus(c, dt);
    this.updateFood(dt);
    this.buildFoodGrid();
    this.updateToxins(dt);
    this.resolveEating(dt);
    for (const pl of this.pls.values()) this.updateNearMate(pl);
    for (const c of this.cells()) {
      c.hpf = Math.max(0, c.hp / maxHp(c));
      c.psn = !!(c.poison && c.poison.t > 0);
      c.isLocal = c.pl?.id === this.myId;
    }
    const me = this.pls.get(this.myId);
    if (me) this.focus = { x: me.cell.x, y: me.cell.y, mass: me.cell.mass };
    this.snapT += dt;
    if (this.snapT >= (this.pls.size > 4 ? 1 / 12 : 1 / 20)) {
      this.snapT = 0;
      this.broadcast();
    }
  }

  stepPlayer(pl, dt) {
    const c = pl.cell;
    pl.breedCool = Math.max(0, pl.breedCool - dt);
    pl.splitCool = Math.max(0, pl.splitCool - dt);
    if (c.dead) {
      pl.respawnT -= dt;
      if (pl.respawnT <= 0) this.respawn(pl);
      return;
    }
    if (pl.shopOpen) {
      // choosing traits: floating safely, the world carries on
      c.shield = Math.max(c.shield, 0.4);
      this.steer(c, 0, 0, 0, dt);
    } else this.movePlayer(pl, dt);
  }

  updateNearMate(pl) {
    const p = pl.cell;
    pl.nearMate = null;
    if (p.dead) return;
    for (const m of this.mates) {
      if (!m.dead && Math.hypot(m.x - p.x, m.y - p.y) < radius(p.mass) + radius(m.mass) + 70) pl.nearMate = m;
    }
  }

  tickStatus(c, dt) {
    if (c.dead) return;
    c.shield = Math.max(0, c.shield - dt);
    if (c.poison && c.poison.t > 0) {
      c.poison.t -= dt;
      if (Math.random() < dt * 8) this.burst(c.x + rand(-1, 1) * radius(c.mass), c.y + rand(-1, 1) * radius(c.mass), 0x7dff3a, 1, 30);
      this.hurt(c, c.poison.dps * dt, c.poison.by);
    } else {
      c.hp = Math.min(maxHp(c), c.hp + HP_REGEN * dt); // heals, but very slowly
    }
  }

  hurt(c, amount, by) {
    if (c.dead || c.shield > 0) return;
    c.hp -= amount * (1 - 0.12 * c.tough);
    if (!c.isPlayer && !c.isMate && by && !by.dead && by !== c) (c.foe = by), (c.foeT = 6);
    if (c.hp > 0) return;
    if (by && !by.dead) this.grow(by, c.mass * 0.6, "meat");
    this.kill(c, by);
  }

  steer(c, dirx, diry, power, dt) {
    const ms = maxSpeed(c.mass, c.speedLvl) * (c.isPlayer ? 1 : 1.08); // NPCs swim a bit faster
    const tx = dirx * ms * power;
    const ty = diry * ms * power;
    const k = Math.min(1, dt * 3.2);
    c.vx += (tx - c.vx) * k;
    c.vy += (ty - c.vy) * k;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    const sp = Math.hypot(c.vx, c.vy);
    c.sp = Math.min(1, sp / ms);
    if (sp > 12) {
      const want = Math.atan2(c.vy, c.vx);
      c.angle += Phaser.Math.Angle.Wrap(want - c.angle) * Math.min(1, dt * 7);
    }
    c.bite = Math.max(0, c.bite - dt);
    c.cool = Math.max(0, c.cool - dt);
    c.pulse = Math.max(0, c.pulse - dt);
    // soft walls: the membrane squishes and we bounce back
    const r = radius(c.mass);
    if (c.x < r) (c.x = r), (c.vx = Math.abs(c.vx) * 0.4);
    if (c.y < r) (c.y = r), (c.vy = Math.abs(c.vy) * 0.4);
    if (c.x > WORLD - r) (c.x = WORLD - r), (c.vx = -Math.abs(c.vx) * 0.4);
    if (c.y > WORLD - r) (c.y = WORLD - r), (c.vy = -Math.abs(c.vy) * 0.4);
  }

  bite(c, aim) {
    if (c.dead || c.cool > 0) return;
    if (aim) c.angle = Math.atan2(aim.y - c.y, aim.x - c.x); // lunge straight at the target
    c.bite = 0.35;
    c.cool = c.isPlayer ? (c.diet === "carn" ? 0.5 : 0.7) : c.owner ? 0.65 : 0.85;
    const a = c.angle;
    const lunge = c.isPlayer ? 340 : 400; // NPCs hit a little harder
    c.vx += Math.cos(a) * lunge;
    c.vy += Math.sin(a) * lunge;
    this.sfxTo(c, 220, 0.15, "triangle", 0.07, 180);
  }

  movePlayer(pl, dt) {
    const p = pl.cell;
    let tx = p.x;
    let ty = p.y;
    if (pl.id === this.myId) {
      const w = this.localTarget(p.x, p.y);
      if (w) (tx = w.x), (ty = w.y);
    } else if (pl.in) {
      tx = pl.in.x;
      ty = pl.in.y;
    }
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    p.lookx = dist ? dx / dist : 1;
    p.looky = dist ? dy / dist : 0;
    const power = Math.min(1, dist / (radius(p.mass) * 2.2));
    this.steer(p, dist ? dx / dist : 0, dist ? dy / dist : 0, power, dt);
  }

  moveAI(e, dt) {
    if (e.owner) return this.moveColony(e, dt);
    if (e.amoeba) {
      e.wander += rand(-1, 1) * dt * 1.5;
      e.lookx = Math.cos(e.wander);
      e.looky = Math.sin(e.wander);
      return this.steer(e, e.lookx, e.looky, 0.3, dt);
    }
    let dirx = 0;
    let diry = 0;
    let best = Infinity;
    let prey = null;
    const re = radius(e.mass);
    for (const o of this.live) {
      if (o === e || o.dead || o.shield > 0) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      // small cells are hard to spot: sight grows with the target's size
      const sight = 290 + re + radius(o.mass) * 3;
      if (d > best || d > sight) continue;
      if (o.mass > e.mass * EAT_RATIO && d < 380) {
        dirx = e.x - o.x;
        diry = e.y - o.y;
        best = 0;
        prey = null;
      } else if (e.aggressive && best > 0 && ((e.mass > o.mass * EAT_RATIO && o.spikeLvl < 2) || (o.aggressive && o.mass > e.mass * 0.75))) {
        // hunt smaller cells, and brawl with rival hunters of similar size
        dirx = o.x - e.x;
        diry = o.y - e.y;
        best = d;
        prey = o;
      }
    }
    const foe = e.foe;
    if (foe && e.foeT > 0 && !foe.dead && foe.mass < e.mass * 1.6 && best !== 0) {
      // fight back against whoever hurt us
      e.foeT -= dt;
      dirx = foe.x - e.x;
      diry = foe.y - e.y;
      prey = foe;
      best = Math.hypot(dirx, diry);
    }
    e.splitCool = Math.max(0, (e.splitCool ?? 0) - dt);
    if (e.splitter && prey && e.splitCool <= 0 && best < 450 && e.mass >= SPLIT_MIN_MASS && Math.random() < dt) this.splitNpc(e);
    if (prey && best < re * 2.2 + 140) this.bite(e, prey); // lunge from a little way off
    let power = 0.8;
    if (!dirx && !diry && e.isMate) {
      // mates drift toward a player who is ready to breed, then hold still
      let near = null;
      let nd = 900;
      for (const pl of this.pls.values()) {
        if (pl.cell.dead || pl.breedCool > 0 || pl.shopOpen) continue;
        const d = Math.hypot(pl.cell.x - e.x, pl.cell.y - e.y);
        if (d < nd) (nd = d), (near = pl.cell);
      }
      if (near) {
        dirx = near.x - e.x;
        diry = near.y - e.y;
        if (nd < radius(near.mass) + re + 30) power = 0;
      }
    }
    if (!dirx && !diry) {
      let nearest = null;
      let nd = 340;
      for (const f of this.foodNear(e.x, e.y, nd)) {
        const d = Math.hypot(f.x - e.x, f.y - e.y);
        if (d < nd) {
          nd = d;
          nearest = f;
        }
      }
      if (nearest) {
        dirx = nearest.x - e.x;
        diry = nearest.y - e.y;
      } else {
        e.wander += rand(-1, 1) * dt * 2;
        dirx = Math.cos(e.wander);
        diry = Math.sin(e.wander);
      }
    }
    const len = Math.hypot(dirx, diry) || 1;
    e.lookx = dirx / len;
    e.looky = diry / len;
    this.steer(e, e.lookx, e.looky, power, dt);
  }

  mouth(c) {
    const r = radius(c.mass) * c.elong * 0.9;
    return { x: c.x + Math.cos(c.angle) * r, y: c.y + Math.sin(c.angle) * r };
  }

  updateFood(dt) {
    for (let i = this.food.length - 1; i >= 0; i--) {
      const f = this.food[i];
      f.bob += dt * 2;
      if (f.kind === 1) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vx *= 1 - Math.min(1, dt * 2.5);
        f.vy *= 1 - Math.min(1, dt * 2.5);
        f.ttl -= dt;
        if (f.ttl <= 0) this.food.splice(i, 1);
      }
    }
  }

  resolveEating(dt) {
    const cells = this.live.filter((c) => !c.dead);
    for (const c of cells) {
      if (c.shield > 0) continue;
      const m = this.mouth(c);
      const r = radius(c.mass);
      const pull = r * 1.5 + 50;
      const diet = dietOf(c.diet);
      for (const f of this.foodNear(m.x, m.y, pull)) {
        if (f.eaten || !diet[f.kind ? "meat" : "plant"]) continue; // can't digest this kind
        const d = Math.hypot(f.x - m.x, f.y - m.y);
        if (d > pull) continue;
        // slurp: food is drawn toward the mouth
        const k = (1 - d / pull) * 380;
        f.x += ((m.x - f.x) / (d || 1)) * k * 0.016;
        f.y += ((m.y - f.y) / (d || 1)) * k * 0.016;
        if (d < r * 0.5 + 8) {
          this.grow(c, f.mass, f.kind ? "meat" : "plant");
          this.burst(f.x, f.y, f.kind ? 0xff6b7a : 0x7dff8a, 5, 60);
          this.sfxTo(c, 520 + Math.random() * 160, 0.09, "sine", 0.05, 220);
          f.eaten = true;
          if (f.kind === 0) {
            const np = this.newPlant();
            this.food[f.idx] = np;
            if (this.pls.size > 1) this.plantDiff.push([f.idx, Math.round(np.x), Math.round(np.y), Math.round(np.size * 10) / 10]);
          } else this.food.splice(this.food.indexOf(f), 1);
        }
      }
    }
    for (const a of cells) {
      if (a.dead || a.shield > 0) continue;
      const am = this.mouth(a);
      const ra = radius(a.mass);
      for (const b of cells) {
        if (a === b || a.dead || b.dead || b.shield > 0) continue;
        if ((a.isPlayer && b.isMate) || (a.isMate && b.isPlayer) || allied(a, b)) continue; // family
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const rb = radius(b.mass);
        // spikes hurt whatever rubs against them
        if (a.spikeLvl && d < ra + rb * 0.9) this.hurt(b, 14 * a.spikeLvl * dt, a);
        if (b.dead) continue;
        const mouthHit = Math.hypot(am.x - b.x, am.y - b.y) < rb * 0.8;
        if (a.mass >= b.mass * EAT_RATIO) {
          const engulf = d < ra - rb * 0.4;
          if (a.bite > 0 && mouthHit && this.t - a.lastHit > 0.45) {
            // a bite hurts; the victim only dies (and gets eaten) when its health runs out
            a.lastHit = this.t;
            this.hurt(b, 30 + a.mass * 0.8, a);
            this.burst(b.x, b.y, 0xff6b7a, 8, 110);
            if (b.spikeLvl) this.hurt(a, b.spikeLvl * 24, b); // biting spikes hurts
          } else if (engulf) {
            this.hurt(b, (50 + a.mass) * dt, a); // swallowed whole: digested quickly
          }
        } else if (a.bite > 0 && mouthHit && this.t - a.lastPoison > 0.5) {
          // too big to swallow: the bite just hurts
          a.lastPoison = this.t;
          this.hurt(b, 14 + a.mass * 0.25, a);
          this.burst(b.x, b.y, 0xff6b7a, 12, 120);
          this.sfxTo(a, 330, 0.2, "sawtooth", 0.05, -120);
        }
      }
    }
  }

  grow(c, amount, kind = "meat") {
    const gain = amount * dietOf(c.diet)[kind];
    c.mass += gain;
    const owner = c.pl ?? c.owner;
    if (owner && owner.dna !== undefined) owner.dna += gain;
  }

  kill(c, killer) {
    if (c.dead) return;
    c.dead = true;
    const chunks = Math.min(14, 3 + Math.floor(c.mass / 8));
    for (let i = 0; i < chunks; i++) this.food.push(this.newMeat(c.x, c.y, (c.mass * 0.35) / chunks + 0.5));
    this.burst(c.x, c.y, c.color, 30, 260);
    if (c.pl) {
      const pl = c.pl;
      pl.pop -= 1;
      pl.extinct = pl.pop <= 0;
      pl.respawnT = pl.extinct ? 3.5 : 2;
      pl.shopOpen = false;
      if (pl.extinct) this.fx({ k: "t", p: pl.id, m: "EXTINCT", s: 3.5 });
      this.fx({ k: "sh", p: pl.id, ms: 350, i: 0.012 });
      this.sfxTo(c, 160, 0.5, "sawtooth", 0.08, -110);
    } else if (c.owner) {
      this.colonies.splice(this.colonies.indexOf(c), 1);
    } else if (c.isMate) {
      this.mates[this.mates.indexOf(c)] = this.newMate();
    } else {
      this.enemies[this.enemies.indexOf(c)] = this.newEnemy();
      if (killer?.pl) {
        this.fx({ k: "sh", p: killer.pl.id, ms: 120, i: 0.004 });
        this.sfxTo(killer, 300, 0.2, "square", 0.05, 200);
      }
    }
  }

  respawn(pl) {
    const p = pl.cell;
    if (pl.extinct) {
      // a brand new species starts from scratch
      pl.extinct = false;
      pl.traits = freshTraits();
      pl.dna = 0;
      pl.pop = POP_START;
      pl.gen += 1;
      pl.breedCool = 0;
    }
    p.dead = false;
    p.mass = baseMass(pl.traits.size);
    p.vx = p.vy = 0;
    p.bite = p.cool = 0;
    p.poison = null;
    p.shield = 3;
    const spot = this.spawnSpot();
    p.x = spot.x;
    p.y = spot.y;
    this.applyTraits(pl);
    p.hp = maxHp(p);
    p.pulse = 1;
    if (pl.id === this.myId) {
      this.camPos.x = p.x;
      this.camPos.y = p.y;
    }
  }

  // -- host: snapshots ----------------------------------------------------------
  rec(pl) {
    const c = pl.cell;
    return {
      id: pl.id, n: pl.name, col: pl.color, dna: Math.floor(pl.dna), pop: pl.pop, gen: pl.gen, cb: Math.ceil(pl.breedCool), sc: Math.ceil(pl.splitCool), pc: Math.ceil(pl.poisonCool), cs: this.colonyCount(pl),
      nm: !c.dead && !!pl.nearMate ? 1 : 0, dead: c.dead ? 1 : 0, ext: pl.extinct ? 1 : 0, shop: pl.shopOpen ? 1 : 0, msg: pl.shopMsg,
      tr: pl.traits, mass: Math.round(c.mass),
    };
  }

  broadcast() {
    if (this.pls.size <= 1 || !this.net) {
      this.evq.length = 0;
      this.plantDiff.length = 0;
      return;
    }
    const r1 = (v) => Math.round(v * 10) / 10;
    const r2 = (v) => Math.round(v * 100) / 100;
    const cells = this.cells().map((c) => [
      c.isPlayer ? c.pl.id : c.id, c.isPlayer ? 2 : c.isMate ? 1 : c.owner ? 4 : c.aggressive ? 3 : 0, c.color, r1(c.x), r1(c.y), r2(c.angle), r2(c.sp), r1(c.mass),
      r2(c.bite), r2(Math.atan2(c.looky, c.lookx)), r2(c.elong), c.eyes, c.flagella, c.spikes, r2(c.pulse), c.venomLvl, c.tough, c.speedLvl,
      DIETS.findIndex((d) => d.key === c.diet), r2(c.hpf), c.psn ? 1 : 0, r1(c.seed), c.shield > 0 ? 1 : 0,
    ]);
    const toxins = this.toxins.map((t) => [Math.round(t.x), Math.round(t.y), Math.round(t.r), Math.round((t.life / t.max) * 100)]);
    const meat = [];
    for (let i = PLANT_COUNT; i < this.food.length; i++) meat.push([Math.round(this.food[i].x), Math.round(this.food[i].y), r1(this.food[i].size)]);
    // the host simulates and culls everything; the server just relays one snapshot per player
    const pl = [...this.pls.values()].map((p) => this.rec(p));
    const r2d = RENDER_DISTANCE * RENDER_DISTANCE;
    for (const p of this.pls.values()) {
      if (p.id === this.myId) continue;
      const { x, y } = p.cell;
      const near = (ax, ay) => (ax - x) ** 2 + (ay - y) ** 2 <= r2d;
      this.net.send({ t: "snap", to: p.id, c: cells.filter((a) => near(a[3], a[4])), pe: this.plantDiff, m: meat.filter((a) => near(a[0], a[1])), tx: toxins.filter((a) => near(a[0], a[1])), pl, ev: this.evq });
    }
    this.evq = [];
    this.plantDiff = [];
  }

  // -- client: snapshots --------------------------------------------------------
  applySnap(s) {
    const seen = new Set();
    for (const a of s.c) {
      const kind = a[1];
      const key = `${kind === 2 ? "p" : "c"}${a[0]}`;
      let v = this.views.get(key);
      if (!v) {
        v = { x: a[3], y: a[4], angle: a[5], vx: 0, vy: 0, poison: null };
        this.views.set(key, v);
      }
      seen.add(key);
      Object.assign(v, {
        id: a[0], kind, color: a[2], tx: a[3], ty: a[4], tangle: a[5], sp: a[6], mass: a[7], bite: a[8], lookx: Math.cos(a[9]), looky: Math.sin(a[9]),
        elong: a[10], eyes: a[11], flagella: a[12], spikes: a[13], pulse: a[14], venomLvl: a[15], tough: a[16], speedLvl: a[17],
        diet: DIETS[a[18]]?.key ?? "omni", hpf: a[19], psn: !!a[20], seed: a[21], shield: a[22] ? 1 : 0, isMate: kind === 1, isPlayer: kind === 2,
        isLocal: kind === 2 && a[0] === this.myId,
      });
    }
    for (const key of [...this.views.keys()]) if (!seen.has(key)) this.views.delete(key);
    this.recs = s.pl;
    for (const r of s.pl) {
      const v = this.views.get(`p${r.id}`);
      if (v) v.name = r.n;
    }
    for (const [i, x, y, size] of s.pe) this.plants[i] = { x, y, kind: 0, mass: 1, bob: rand(0, TAU), size };
    this.toxins = (s.tx ?? []).map(([x, y, r, a]) => ({ x, y, r, a: a / 100 }));
    this.meat = s.m.map(([x, y, size]) => ({ x, y, kind: 1, size, bob: 0 }));
    for (const ev of s.ev) this.applyFx(ev);
  }

  stepClient(dt) {
    if (!this.ready) {
      this.helloT = (this.helloT ?? 0) - dt;
      if (this.helloT <= 0 && this.net) {
        this.helloT = 2;
        this.net.send({ t: "hello", name: this.myName });
      }
      return;
    }
    const k = 1 - Math.exp(-dt * 22);
    for (const v of this.views.values()) {
      v.x += (v.tx - v.x) * k;
      v.y += (v.ty - v.y) * k;
      v.angle += Phaser.Math.Angle.Wrap(v.tangle - v.angle) * k;
    }
    for (const f of this.plants) f.bob += dt * 2;
    for (const m of this.meat) m.bob = this.t * 2 + m.x * 0.37;
    this.food = this.plants.concat(this.meat);
    const me = this.views.get(`p${this.myId}`);
    if (me) this.focus = { x: me.x, y: me.y, mass: me.mass };
    this.inT += dt;
    if (this.inT >= 0.05) {
      this.inT = 0;
      const w = (me && this.localTarget(me.x, me.y)) ?? me ?? this.focus;
      this.net.send({ t: "in", x: Math.round(w.x), y: Math.round(w.y) });
    }
  }

  meRec() {
    if (this.isHost) {
      const pl = this.pls.get(this.myId);
      return pl ? this.rec(pl) : null;
    }
    return this.recs.find((r) => r.id === this.myId) ?? null;
  }

  // -- particles + camera -------------------------------------------------------
  burst(x, y, color, n, speed) {
    this.fx({ k: "b", x: Math.round(x), y: Math.round(y), c: color, n, s: speed });
  }

  spawnParticles(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(0.2, 1) * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.9), max: 0.9, color, size: rand(2, 5) });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, dt * 3);
      p.vy *= 1 - Math.min(1, dt * 3);
    }
  }

  updateCamera() {
    const cam = this.cameras.main;
    const f = this.focus;
    const k = 0.1;
    this.camPos.x += (f.x - this.camPos.x) * k;
    this.camPos.y += (f.y - this.camPos.y) * k;
    cam.centerOn(this.camPos.x, this.camPos.y);
    const target = Math.max(0.3, 1.25 - Math.sqrt(f.mass) * 0.032);
    cam.setZoom(Phaser.Math.Linear(cam.zoom, target, 0.03));
  }

  publishHud() {
    const r = this.meRec();
    const list = this.isHost ? [...this.pls.values()].map((pl) => this.rec(pl)) : this.recs;
    const players = this.room ? list.map((x) => ({ n: x.n, pop: x.pop, mass: x.mass, gen: x.gen, dna: x.dna, me: x.id === this.myId })).sort((a, b) => b.mass - a.mass) : [];
    const base = {
      room: this.room,
      keyBreed: keyLabel(KEYS.breed),
      players,
      netDown: this.netDown,
      scrollX: this.cameras.main.scrollX,
      scrollY: this.cameras.main.scrollY,
      toast: this.toastT > 0 ? this.toast : "",
      toastAlpha: Math.min(1, this.toastT),
    };
    if (!r) {
      this.game.events.emit("hud", { ...base, connecting: true });
      return;
    }
    let prompt = "";
    if (!r.dead && r.nm && r.cb > 0) prompt = `Resting... ${r.cb}s`;
    this.game.events.emit("hud", {
      ...base,
      connecting: false,
      dna: r.dna,
      pop: r.pop,
      popMax: POP_MAX,
      gen: r.gen,
      traits: r.tr,
      color: r.col,
      shopOpen: !!r.shop && !r.dead,
      shopMsg: r.msg,
      prompt,
      canBreed: !r.dead && !!r.nm && r.cb <= 0 && !r.shop,
      canSplit: !r.dead && !r.shop && r.sc <= 0 && r.mass >= SPLIT_MIN_MASS && r.cs < (r.tr.mitosis ?? 0),
      canPoison: !r.dead && !r.shop && r.pc <= 0 && (r.tr.venom ?? 0) > 0,
      keySplit: keyLabel(KEYS.split),
      keyPoison: keyLabel(KEYS.poison),
      breedReady: r.cb <= 0,
      dead: !!r.dead,
      deadMsg: r.ext ? "Your species went extinct...\na new one begins" : `You were eaten...\n${r.pop} left in your species`,
    });
    this.breedReady = r.cb <= 0;
  }

  draw() {
    const g = this.gfx;
    const view = this.cameras.main.worldView;
    g.clear();

    // the pond floor
    g.fillStyle(0x03222e, 0.55).fillRect(0, 0, WORLD, WORLD);
    for (let i = 0; i < 70; i++) {
      // slow drifting caustic blobs (deterministic so they don't flicker)
      const bx = ((i * 977) % WORLD) + Math.sin(this.t * 0.2 + i) * 60;
      const by = ((i * 1543) % WORLD) + Math.cos(this.t * 0.17 + i * 2) * 60;
      const br = 120 + (i % 5) * 50;
      if (bx < view.x - br || bx > view.right + br || by < view.y - br || by > view.bottom + br) continue;
      g.fillStyle(0x2fd6c0, 0.035).fillCircle(bx, by, br);
      g.fillStyle(0x2fd6c0, 0.03).fillCircle(bx, by, br * 0.6);
    }
    for (let i = 0; i < 6; i++) g.lineStyle(14 - i * 2, 0xff4d6d, 0.05 + i * 0.03).strokeRect(-i * 3, -i * 3, WORLD + i * 6, WORLD + i * 6);

    const inView = (x, y, m) => x > view.x - m && x < view.right + m && y > view.y - m && y < view.bottom + m;

    for (const f of this.food) {
      if (!inView(f.x, f.y, 30)) continue;
      const bob = Math.sin(f.bob) * 2;
      if (f.kind === 0) {
        g.fillStyle(0x6bff7a, 0.14).fillCircle(f.x, f.y + bob, f.size * 2.6);
        g.fillStyle(0x4cdc6a, 1).fillCircle(f.x, f.y + bob, f.size);
        g.fillStyle(0xb9ffc4, 0.8).fillCircle(f.x - f.size * 0.3, f.y + bob - f.size * 0.3, f.size * 0.4);
      } else {
        g.fillStyle(0xff4d6d, 0.16).fillCircle(f.x, f.y + bob, f.size * 2.2);
        g.fillStyle(0xe8566f, 1).fillCircle(f.x, f.y + bob, f.size);
        g.fillStyle(0xffb3c0, 0.7).fillCircle(f.x + f.size * 0.25, f.y + bob - f.size * 0.2, f.size * 0.4);
        g.fillStyle(0xa8243e, 0.9).fillCircle(f.x - f.size * 0.3, f.y + bob + f.size * 0.3, f.size * 0.3);
      }
    }

    for (const t of this.toxins) {
      if (!inView(t.x, t.y, t.r)) continue;
      const a = t.a ?? t.life / t.max;
      g.fillStyle(0x7dff3a, 0.12 + 0.2 * a).fillCircle(t.x, t.y, t.r);
      g.fillStyle(0xb6ff7a, 0.1 + 0.2 * a).fillCircle(t.x, t.y, t.r * 0.55);
    }

    const cells = (this.isHost ? this.cells() : [...this.views.values()]).sort((a, b) => a.mass - b.mass);
    const shown = new Set();
    for (const c of cells) {
      if (!inView(c.x, c.y, radius(c.mass) * 3)) continue;
      this.drawCell(g, c);
      if (c.hpf < 0.99) {
        const w = radius(c.mass) * 1.6;
        const y = c.y - radius(c.mass) * 1.5;
        g.fillStyle(0x2a0a14, 0.7).fillRect(c.x - w / 2, y, w, 5);
        g.fillStyle(c.psn ? 0x7dff3a : 0xff4d6d, 1).fillRect(c.x - w / 2, y, w * c.hpf, 5);
      }
      if (c.isPlayer && c.name && this.room) {
        let label = this.labels.get(c.id);
        if (!label) {
          label = this.add.text(0, 0, "", { fontFamily: "system-ui, sans-serif", fontSize: "16px", color: "#e8fffb", stroke: "#03222e", strokeThickness: 4 }).setOrigin(0.5).setDepth(3);
          this.labels.set(c.id, label);
        }
        label.setText(c.name).setPosition(c.x, c.y - radius(c.mass) * 1.8 - 14).setVisible(true);
        shown.add(c.id);
      }
    }
    for (const [id, label] of this.labels) if (!shown.has(id)) label.setVisible(false);

    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.max);
      g.fillStyle(p.color, a * 0.9).fillCircle(p.x, p.y, p.size * (0.4 + a));
    }
  }

  drawCell(g, c) {
    const R = radius(c.mass);
    const t = this.t;
    const sp = c.sp ?? 0;
    const ca = Math.cos(c.angle);
    const sa = Math.sin(c.angle);
    const to = (lx, ly) => ({ x: c.x + lx * ca - ly * sa, y: c.y + lx * sa + ly * ca });
    // your diet tints the body: plant eaters go green, meat eaters go red
    const dietTint = c.diet === "herb" ? 0x5fe07a : c.diet === "carn" ? 0xe8505a : null;
    const col = dietTint === null ? c.color : mixColor(c.color, dietTint, 0.45);
    const spikeLvl = c.spikes ? (c.spikes - 2) / 3 : 0;
    const light = shade(col, 0.45);
    const dark = shade(col, -0.45);

    // aura (the player glows brighter so you never lose yourself)
    const auraBoost = c.isLocal ? 0.12 : c.isPlayer ? 0.09 : 0.05;
    g.fillStyle(col, auraBoost).fillCircle(c.x, c.y, R * 1.7);
    g.fillStyle(col, auraBoost).fillCircle(c.x, c.y, R * 1.3);
    if (c.isMate && this.breedReady) g.lineStyle(3, 0xff8fd0, 0.5 + 0.4 * Math.sin(t * 5)).strokeCircle(c.x, c.y, R * (1.5 + 0.1 * Math.sin(t * 5)));
    if (c.psn) g.fillStyle(0x7dff3a, 0.22).fillCircle(c.x, c.y, R * 1.15);
    if (c.pulse > 0) g.lineStyle(4, 0xb7fff0, c.pulse).strokeCircle(c.x, c.y, R * (1.2 + (1 - c.pulse) * 2.5));

    // flagella: sine-wave tails trailing behind
    for (let f = 0; f < c.flagella; f++) {
      const off = (f - (c.flagella - 1) / 2) * 0.5;
      const segs = 12;
      const len = R * (1.6 + 0.4 * c.speedLvl + sp * 0.6);
      let prev = to(-R * c.elong * 0.9, off * R * 0.6);
      for (let s = 1; s <= segs; s++) {
        const u = s / segs;
        const wave = Math.sin(t * (7 + sp * 8) - u * 6 + f * 1.7 + c.seed) * R * 0.35 * u;
        const next = to(-R * c.elong * 0.9 - u * len, off * R * 0.6 + wave);
        g.lineStyle(Math.max(1, R * 0.16 * (1 - u)), light, 0.75 * (1 - u * 0.6)).lineBetween(prev.x, prev.y, next.x, next.y);
        prev = next;
      }
    }

    // spikes
    if (c.spikes) {
      for (let s = 0; s < c.spikes; s++) {
        const a = (s / c.spikes) * TAU + Math.sin(t + s) * 0.04;
        if (Math.cos(a) > 0.8) continue; // keep the mouth clear
        const a2 = TAU / c.spikes / 4;
        const p0 = to(Math.cos(a - a2) * R * c.elong * 0.95, Math.sin(a - a2) * R * 0.95);
        const reach = 1.25 + 0.15 * spikeLvl;
        const p1 = to(Math.cos(a) * R * c.elong * reach, Math.sin(a) * R * reach);
        const p2 = to(Math.cos(a + a2) * R * c.elong * 0.95, Math.sin(a + a2) * R * 0.95);
        g.fillStyle(dark, 1).fillTriangle(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y);
      }
    }

    // cilia
    const cil = 22;
    for (let i = 0; i < cil; i++) {
      const a = (i / cil) * TAU;
      const w = Math.sin(t * 9 + i * 1.3 + c.seed) * 0.25;
      const p0 = to(Math.cos(a) * R * c.elong, Math.sin(a) * R);
      const p1 = to(Math.cos(a + w) * R * c.elong * 1.22, Math.sin(a + w) * R * 1.22);
      g.lineStyle(Math.max(1, R * 0.05), light, 0.5).lineBetween(p0.x, p0.y, p1.x, p1.y);
    }

    // wobbling membrane
    const n = this.pts.length;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const wob =
        1 +
        (0.05 * Math.sin(a * 3 + t * 2.2 + c.seed) +
          0.03 * Math.sin(a * 5 - t * 3.1 + c.seed * 2) +
          (c.bite > 0 ? 0.06 * Math.sin(a * 2 + t * 30) * (c.bite / 0.35) : 0)) *
          (1 - 0.25 * c.tough);
      const lx = Math.cos(a) * R * c.elong * wob * (1 + 0.1 * sp);
      const ly = Math.sin(a) * R * wob * (1 - 0.08 * sp);
      const p = to(lx, ly);
      this.pts[i].x = p.x;
      this.pts[i].y = p.y;
    }
    const path = () => {
      g.beginPath();
      g.moveTo(this.pts[0].x, this.pts[0].y);
      for (let i = 1; i < n; i++) g.lineTo(this.pts[i].x, this.pts[i].y);
      g.closePath();
    };
    path();
    g.fillStyle(col, Math.min(1, 0.82 + 0.06 * c.tough)).fillPath();
    g.lineStyle(Math.max(2, R * 0.1 * (1 + 0.9 * c.tough)), c.venomLvl ? mixColor(light, 0x7dff3a, 0.25 * c.venomLvl) : light, 0.95);
    path();
    g.strokePath();
    // thick membrane = a hard, plated wall instead of soft jelly: dark segment seams around the rim
    if (c.tough > 0) {
      const seams = 8 + 4 * c.tough;
      g.lineStyle(Math.max(1.5, R * 0.05), shade(col, -0.55), 0.8);
      for (let k = 0; k < seams; k++) {
        const a = (k / seams) * TAU;
        const p0 = to(Math.cos(a) * R * c.elong * 0.8, Math.sin(a) * R * 0.8);
        const p1 = to(Math.cos(a) * R * c.elong * 0.99, Math.sin(a) * R * 0.99);
        g.lineBetween(p0.x, p0.y, p1.x, p1.y);
      }
      g.lineStyle(Math.max(1.5, R * 0.04), shade(col, -0.55), 0.8);
      g.beginPath();
      for (let k = 0; k <= 36; k++) {
        const a = (k / 36) * TAU;
        const p = to(Math.cos(a) * R * c.elong * 0.8, Math.sin(a) * R * 0.8);
        if (k === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.strokePath();
    }
    // inner membrane + specular highlight
    if (!c.tough) g.lineStyle(1.5, light, 0.35).strokeCircle(c.x, c.y, R * 0.78);
    g.fillStyle(0xffffff, 0.22 * (1 - 0.3 * c.tough)).fillEllipse(c.x - R * 0.35, c.y - R * 0.45, R * 0.7, R * 0.35);

    // organelles drifting inside
    for (let i = 0; i < 6; i++) {
      const oa = c.seed * 3 + i * 1.9 + Math.sin(t * 0.6 + i) * 0.3;
      const od = R * (0.25 + ((i * 37 + c.seed * 11) % 40) / 100);
      const op = to(Math.cos(oa) * od * c.elong - R * 0.1, Math.sin(oa) * od);
      g.fillStyle(light, 0.5).fillCircle(op.x, op.y, R * (0.06 + (i % 3) * 0.025));
    }
    // venom glands
    for (let i = 0; i < c.venomLvl * 2; i++) {
      const va = (i / (c.venomLvl * 2)) * TAU + t * 0.5;
      const vp = to(Math.cos(va) * R * 0.62 * c.elong, Math.sin(va) * R * 0.62);
      const gr = R * (0.08 + 0.03 * c.venomLvl);
      g.fillStyle(0x7dff3a, 0.25 + 0.15 * Math.sin(t * 4 + i)).fillCircle(vp.x, vp.y, gr * 1.8);
      g.fillStyle(0x7dff3a, 0.95).fillCircle(vp.x, vp.y, gr);
    }
    // chloroplasts: plant eaters carry green spots
    if (c.diet === "herb") {
      for (let i = 0; i < 5; i++) {
        const ca2 = c.seed + i * 1.26;
        const cp = to(Math.cos(ca2) * R * 0.5 * c.elong, Math.sin(ca2) * R * 0.5);
        g.fillStyle(0x2fae4a, 0.8).fillEllipse(cp.x, cp.y, R * 0.2, R * 0.12);
      }
    }
    // nucleus
    const nuc = to(-R * 0.2, Math.sin(t * 1.3 + c.seed) * R * 0.05);
    g.fillStyle(dark, 0.55).fillCircle(nuc.x, nuc.y, R * 0.3);
    g.lineStyle(1.5, light, 0.5).strokeCircle(nuc.x, nuc.y, R * 0.3);
    g.fillStyle(light, 0.7).fillCircle(nuc.x - R * 0.06, nuc.y - R * 0.06, R * 0.1);

    // eyes track the target direction
    const lookAng = Math.atan2(c.looky, c.lookx) - c.angle;
    for (let k = 0; k < c.eyes; k++) {
      const side = k % 2 === 0 ? 1 : -1;
      const tier = Math.floor((k + 1) / 2);
      const ex = R * c.elong * (0.45 - tier * 0.28);
      const ey = side * R * (0.4 + tier * 0.15);
      const ep = to(ex, ey);
      const er = R * 0.2;
      g.fillStyle(0xffffff, 1).fillCircle(ep.x, ep.y, er);
      g.lineStyle(1.5, dark, 0.8).strokeCircle(ep.x, ep.y, er);
      const pp = to(ex + Math.cos(lookAng) * er * 0.45, ey + Math.sin(lookAng) * er * 0.45);
      g.fillStyle(0x0b0f14, 1).fillCircle(pp.x, pp.y, er * 0.55);
      g.fillStyle(0xffffff, 0.9).fillCircle(pp.x - er * 0.15, pp.y - er * 0.2, er * 0.18);
    }

    // mouth
    const open = c.bite > 0 ? Math.sin((c.bite / 0.35) * Math.PI) : 0.08 + 0.04 * Math.sin(t * 3 + c.seed);
    const m = to(R * c.elong * 0.92, 0);
    const mr = R * (0.1 + open * 0.28);
    g.fillStyle(0x2a0a14, 1).fillCircle(m.x, m.y, mr);
    g.lineStyle(Math.max(1.5, R * 0.06), light, 0.9).strokeCircle(m.x, m.y, mr);
    if (c.diet === "carn") {
      g.fillStyle(0xffffff, 1);
      for (const s of [-1, 1]) {
        const f0 = to(R * c.elong * 0.9, s * mr * 0.7);
        const f1 = to(R * c.elong * 1.12, s * mr * 0.45);
        const f2 = to(R * c.elong * 0.9, s * mr * 0.15);
        g.fillTriangle(f0.x, f0.y, f1.x, f1.y, f2.x, f2.y);
      }
    } else if (open > 0.5) {
      g.fillStyle(0xffffff, 0.9);
      for (const s of [-1, 1]) {
        const tp = to(R * c.elong * 0.92, s * mr * 0.55);
        g.fillCircle(tp.x, tp.y, R * 0.04);
      }
    }
    // spawn / shop protection bubble
    if (c.shield > 0) g.lineStyle(3, 0xffffff, 0.45 + 0.2 * Math.sin(t * 8)).strokeCircle(c.x, c.y, R * 1.45);
  }
}

// ---- HUD scene (no camera zoom, so it stays crisp) ---------------------------
class UIScene extends Phaser.Scene {
  constructor() {
    super("ui");
  }

  create() {
    this.hud = null;
    this.gfx = this.add.graphics();
    this.specks = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), z: rand(0.08, 0.6), r: rand(1, 3), ph: rand(0, TAU) }));
    this.bubbles = Array.from({ length: 24 }, () => ({ x: Math.random(), y: Math.random(), r: rand(2, 7), s: rand(0.02, 0.07) }));
    const style = { fontFamily: "system-ui, sans-serif", color: "#e8fffb" };
    this.style = style;
    this.dnaText = this.add.text(24, 20, "", { ...style, fontSize: "26px", fontStyle: "bold" });
    this.lvlText = this.add.text(24, 54, "", { ...style, fontSize: "14px", color: "#8fd9cf" });
    this.hintText = this.add.text(24, 112, "Find your kind (pink ring) to breed", { ...style, fontSize: "12px", color: "#6fb5ab" });
    this.promptText = this.add.text(0, 0, "", { ...style, fontSize: "22px", fontStyle: "bold", color: "#ffb3e0", stroke: "#2a0a14", strokeThickness: 5 }).setOrigin(0.5);
    this.toastText = this.add.text(0, 0, "", { ...style, fontSize: "56px", fontStyle: "bold", color: "#b7fff0", stroke: "#03222e", strokeThickness: 8 }).setOrigin(0.5);
    this.deadText = this.add.text(0, 0, "", { ...style, fontSize: "36px", fontStyle: "bold", color: "#ff8fa3", stroke: "#2a0a14", strokeThickness: 6 }).setOrigin(0.5);
    this.breedBtn = this.add.rectangle(0, 0, 220, 56, 0xb03a86).setStrokeStyle(3, 0xffd0ec, 0.9).setInteractive({ useHandCursor: true }).setVisible(false).setDepth(5);
    this.breedBtn.on("pointerdown", () => this.game.events.emit("breed"));
    this.breedText = this.add.text(0, 0, "BREED  (E)", { ...style, fontSize: "22px", fontStyle: "bold" }).setOrigin(0.5).setVisible(false).setDepth(6);
    this.roomText = this.add.text(0, 0, "", { ...style, fontSize: "16px", fontStyle: "bold", color: "#b7fff0" }).setOrigin(1, 0);
    this.boardTitle = this.add.text(0, 0, "LEADERBOARD", { ...style, fontSize: "12px", fontStyle: "bold", color: "#6fb5ab" }).setOrigin(1, 0);
    this.boardText = this.add.text(0, 0, "", { ...style, fontSize: "14px", color: "#8fd9cf", align: "right", lineSpacing: 4 }).setOrigin(1, 0);
    this.leaveText = this.add.text(0, 0, "LEAVE", { ...style, fontSize: "13px", fontStyle: "bold", color: "#ff8fa3" }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.leaveText.on("pointerdown", () => location.reload());
    this.noteText = this.add.text(0, 0, "", { ...style, fontSize: "30px", fontStyle: "bold", color: "#ffd0ec", stroke: "#03222e", strokeThickness: 6, align: "center" }).setOrigin(0.5).setDepth(20);
    this.splitBtn = this.add.rectangle(0, 0, 130, 52, 0x2b6cb0).setStrokeStyle(3, 0xbfe3ff, 0.9).setInteractive({ useHandCursor: true }).setVisible(false).setDepth(5);
    this.splitBtn.on("pointerdown", () => this.game.events.emit("split"));
    this.poisonBtn = this.add.rectangle(0, 0, 130, 52, 0x2f8f2f).setStrokeStyle(3, 0xc8ffb0, 0.9).setInteractive({ useHandCursor: true }).setVisible(false).setDepth(5);
    this.poisonBtn.on("pointerdown", () => this.game.events.emit("poison"));
    this.poisonText = this.add.text(0, 0, "POISON", { ...style, fontSize: "18px", fontStyle: "bold" }).setOrigin(0.5).setVisible(false).setDepth(6);
    this.splitText = this.add.text(0, 0, "SPLIT", { ...style, fontSize: "18px", fontStyle: "bold" }).setOrigin(0.5).setVisible(false).setDepth(6);
    this.buildShop();
    this.game.events.on("hud", (d) => (this.hud = d));
  }

  makeButton(x, y, w, label, onClick) {
    const rect = this.add.rectangle(x, y, w, 36, 0x0b4a5a).setStrokeStyle(2, 0x4cffd0, 0.8).setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, { ...this.style, fontSize: "15px", fontStyle: "bold" }).setOrigin(0.5);
    rect.on("pointerdown", onClick);
    this.shop.add([rect, text]);
    return { rect, text };
  }

  buildShop() {
    const W = 720;
    this.shopW = W;
    const rowH = 72;
    const top = 100;
    const H = top + (TRAITS.length + 2) * rowH + 70;
    this.shopH = H;
    this.shop = this.add.container(0, 0).setVisible(false).setDepth(10);
    const bg = this.add.rectangle(0, 0, W, H, 0x03222e, 0.95).setStrokeStyle(2, 0x4cffd0, 0.7);
    this.shopTitle = this.add.text(0, -H / 2 + 28, "EVOLVE", { ...this.style, fontSize: "28px", fontStyle: "bold", color: "#b7fff0" }).setOrigin(0.5);
    this.shopSub = this.add.text(0, -H / 2 + 62, "", { ...this.style, fontSize: "14px", color: "#ffb3e0" }).setOrigin(0.5);
    this.shop.add([bg, this.shopTitle, this.shopSub]);
    this.rows = TRAITS.map((t, i) => {
      const y = -H / 2 + top + i * rowH + 24;
      const name = this.add.text(-W / 2 + 24, y - 14, t.name, { ...this.style, fontSize: "18px", fontStyle: "bold" }).setOrigin(0, 0.5);
      const desc = this.add.text(-W / 2 + 24, y + 10, t.desc, { ...this.style, fontSize: "12px", color: "#8fd9cf", wordWrap: { width: 330 } }).setOrigin(0, 0.5);
      const val = this.add.text(W / 2 - 250, y, "", { ...this.style, fontSize: "14px", color: "#b7fff0" }).setOrigin(0.5);
      this.shop.add([name, desc, val]);
      const minus = t.min < 0 ? this.makeButton(W / 2 - 170, y, 84, "", () => this.game.events.emit("buy", t.key, -1)) : null;
      const plus = this.makeButton(W / 2 - 70, y, 100, "", () => this.game.events.emit("buy", t.key, 1));
      return { t, val, minus, plus };
    });
    {
      const y = -H / 2 + top + TRAITS.length * rowH + 24;
      const name = this.add.text(-W / 2 + 24, y - 14, "Diet", { ...this.style, fontSize: "18px", fontStyle: "bold" }).setOrigin(0, 0.5);
      const desc = this.add.text(-W / 2 + 24, y + 10, "Herbivore: eats only plants. Carnivore: eats only meat and amoebas, bites faster. Omnivore: eats everything.", { ...this.style, fontSize: "12px", color: "#8fd9cf", wordWrap: { width: 290 } }).setOrigin(0, 0.5);
      this.shop.add([name, desc]);
      this.dietBtns = DIETS.map((d, k) => ({ d, ...this.makeButton(W / 2 - 330 + k * 110, y, 104, "", () => this.game.events.emit("diet", d.key)) }));
    }
    {
      const y = -H / 2 + top + (TRAITS.length + 1) * rowH + 24;
      const name = this.add.text(-W / 2 + 24, y - 14, "Look", { ...this.style, fontSize: "18px", fontStyle: "bold" }).setOrigin(0, 0.5);
      const desc = this.add.text(-W / 2 + 24, y + 10, "Free. Change your colour and how many eyes you have.", { ...this.style, fontSize: "12px", color: "#8fd9cf", wordWrap: { width: 290 } }).setOrigin(0, 0.5);
      this.swatch = this.add.circle(W / 2 - 390, y, 12, 0xffffff).setStrokeStyle(2, 0xffffff, 0.8);
      this.shop.add([name, desc, this.swatch]);
      this.colorBtn = this.makeButton(W / 2 - 330 + 55, y, 104, "Color", () => this.game.events.emit("look", "color"));
      this.eyesBtn = this.makeButton(W / 2 - 330 + 165, y, 104, "", () => this.game.events.emit("look", "eyes"));
    }
    this.makeButton(0, H / 2 - 36, 160, "DONE  (Esc)", () => this.game.events.emit("closeShop"));
  }

  paintButton(btn, label, ok) {
    btn.text.setText(label).setColor(ok ? "#e8fffb" : "#5d7f86");
    btn.rect.setFillStyle(ok ? 0x15806a : 0x12262e);
  }

  updateShop(h, W, H) {
    this.shop.setVisible(h.shopOpen);
    if (!h.shopOpen) return;
    this.shop.setPosition(W / 2, H / 2).setScale(Math.min(1, (H - 16) / this.shopH, (W - 16) / this.shopW));
    for (const b of this.dietBtns) {
      const cur = h.traits.diet === b.d.key;
      this.paintButton(b, cur ? `${b.d.name} ✓` : `${b.d.name} ${b.d.cost}`, cur || h.dna >= b.d.cost);
    }
    this.swatch.setFillStyle(h.color);
    this.paintButton(this.colorBtn, "Color", true);
    this.paintButton(this.eyesBtn, h.traits.eyes ? `Eyes: ${h.traits.eyes}` : "Eyes: auto", true);
    this.shopSub.setText(`${h.shopMsg}   •   species ${h.pop} / ${h.popMax}   •   points ${h.dna}`);
    for (const { t, val, minus, plus } of this.rows) {
      const cur = h.traits[t.key];
      val.setText(t.min < 0 ? (cur === 0 ? "Normal" : cur > 0 ? `Bigger +${cur}` : `Smaller ${cur}`) : `${cur} / ${t.max}`);
      if (minus) {
        const to = cur - 1;
        const can = to >= t.min;
        this.paintButton(minus, can ? `Smaller ${t.cost(to)}` : "MIN", can && h.dna >= t.cost(to));
      }
      const to = cur + 1;
      const can = to <= t.max;
      this.paintButton(plus, can ? `${t.min < 0 ? "Bigger" : "Buy"} ${t.cost(to)}` : "MAX", can && h.dna >= t.cost(to));
    }
  }

  update(_, delta) {
    const g = this.gfx;
    const W = this.scale.width;
    const H = this.scale.height;
    const h = this.hud;
    g.clear();
    const t = this.time.now / 1000;

    // parallax plankton specks + rising bubbles
    for (const s of this.specks) {
      const sx = h ? h.scrollX * s.z * 0.6 : 0;
      const sy = h ? h.scrollY * s.z * 0.6 : 0;
      const x = (((s.x * W - sx + Math.sin(t * 0.3 + s.ph) * 12) % W) + W) % W;
      const y = (((s.y * H - sy + Math.cos(t * 0.25 + s.ph) * 12) % H) + H) % H;
      g.fillStyle(0xbffff3, 0.1 + s.z * 0.35).fillCircle(x, y, s.r * (0.6 + s.z));
    }
    for (const b of this.bubbles) {
      b.y -= b.s * (delta / 1000);
      if (b.y < -0.05) (b.y = 1.05), (b.x = Math.random());
      const x = b.x * W + Math.sin(t + b.x * 10) * 10;
      g.lineStyle(1.5, 0xbffff3, 0.35).strokeCircle(x, b.y * H, b.r);
      g.fillStyle(0xffffff, 0.15).fillCircle(x - b.r * 0.3, b.y * H - b.r * 0.3, b.r * 0.3);
    }

    if (!h) return;
    this.noteText.setPosition(W / 2, H / 2).setText(h.netDown ? "Disconnected from the room\nreload to rejoin" : h.connecting ? "Joining room..." : "");
    if (h.connecting) return;
    const multi = !!h.room;
    this.roomText.setPosition(W - 20, 16).setText(multi ? `ROOM  ${h.room}` : "SOLO");
    this.leaveText.setPosition(W - 20, 40);
    const hide = h.shopOpen;
    for (const o of [this.roomText, this.leaveText, this.boardText, this.boardTitle, this.dnaText, this.lvlText, this.hintText]) o.setVisible(!hide);
    const sb = document.getElementById("settings-btn");
    if (sb) sb.style.display = hide ? "none" : "";
    this.boardTitle.setPosition(W - 20, 66).setVisible(multi && !hide);
    this.boardText.setPosition(W - 20, 84).setText(multi ? h.players.slice(0, 10).map((p, i) => `${p.me ? "▸ " : ""}${i + 1}. ${p.n}   #${p.gen}  ${p.mass}  ${"●".repeat(Math.max(0, p.pop))}`).join("\n") : "");

    // points + species count
    this.dnaText.setText(`POINTS  ${h.dna}`);
    this.lvlText.setText(`SPECIES #${h.gen}`);
    for (let i = 0; i < h.popMax; i++) {
      const x = 32 + i * 26;
      if (i < h.pop) g.fillStyle(0x4fc3f7, 1).fillCircle(x, 94, 9).lineStyle(2, 0xe8fffb, 0.8).strokeCircle(x, 94, 9);
      else g.lineStyle(2, 0x8fd9cf, 0.4).strokeCircle(x, 94, 9);
    }

    const showBreed = h.canBreed && !h.shopOpen;
    this.breedBtn.setPosition(W / 2, H - 80).setVisible(showBreed);
    this.breedText.setPosition(W / 2, H - 80).setText(`BREED  (${h.keyBreed})`).setVisible(showBreed);
    const showSplit = h.canSplit && !h.shopOpen && !h.dead;
    const showPoison = h.canPoison && !h.shopOpen && !h.dead;
    this.poisonBtn.setPosition(W - 85, H - 210).setVisible(showPoison);
    this.poisonText.setPosition(W - 85, H - 210).setText(`POISON  (${h.keyPoison})`).setVisible(showPoison);
    this.splitBtn.setPosition(W - 85, H - 150).setVisible(showSplit);
    this.splitText.setPosition(W - 85, H - 150).setText(`SPLIT  (${h.keySplit})`).setVisible(showSplit);
    this.promptText.setPosition(W / 2, H - 80).setText(h.shopOpen ? "" : h.prompt);
    this.toastText.setPosition(W / 2, H * 0.28).setText(h.toast).setAlpha(h.toastAlpha).setScale(1 + (1 - h.toastAlpha) * 0.2);
    this.deadText.setPosition(W / 2, H / 2).setText(h.dead ? h.deadMsg : "").setAlign("center");
    if (h.dead) g.fillStyle(0x2a0a14, 0.35).fillRect(0, 0, W, H);
    if (h.shopOpen) g.fillStyle(0x000000, 0.45).fillRect(0, 0, W, H);
    this.updateShop(h, W, H);
  }
}

// ---- boot: lobby first, then the game -------------------------------------------
mountSettings();
runLobby().then((boot) => {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    transparent: true,
    scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
    scene: [],
  });
  game.registry.set("boot", boot);
  game.scene.add("ui", UIScene, false);
  game.scene.add("main", MainScene, true);
  if (import.meta.env.DEV) window.__evo = game;
});
