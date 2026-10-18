import Phaser from "phaser";

const WORLD = 8000;
const START_MASS = 20;
const PLANT_COUNT = 1100;
const ENEMY_COUNT = 60;
const MATE_COUNT = 6;
const POP_START = 3;
const POP_MAX = 6;
const BREED_COOLDOWN = 20;
const EAT_RATIO = 1.15;
const TAU = Math.PI * 2;

// what the points can buy when you breed (size can go both ways)
const TRAITS = [
  { key: "size", name: "Size", min: -3, max: 5, cost: (to) => 30 + 15 * Math.abs(to), desc: "Big eats nearly anything but is slow and easy to spot. Small is fast and hard to see." },
  { key: "speed", name: "Flagella", min: 0, max: 4, cost: (to) => 25 * to, desc: "+12% swim speed per level." },
  { key: "spikes", name: "Spikes", min: 0, max: 3, cost: (to) => 30 * to, desc: "Hurts anything that touches or bites you, even bigger cells." },
  { key: "venom", name: "Venom", min: 0, max: 3, cost: (to) => 35 * to, desc: "Your bite poisons cells too big to eat. They die slowly." },
  { key: "tough", name: "Thick membrane", min: 0, max: 3, cost: (to) => 25 * to, desc: "+35% health per level." },
];
const freshTraits = () => ({ size: 0, speed: 0, spikes: 0, venom: 0, tough: 0 });

const radius = (mass) => Math.sqrt(mass) * 4.2;
const maxSpeed = (mass, speedLvl = 0) => (300 / Math.pow(mass, 0.22)) * (1 + 0.12 * speedLvl);
const maxHp = (c) => (60 + c.mass * 2) * (1 + 0.35 * c.tough);
const baseMass = (size) => START_MASS * Math.pow(1.4, size);
const spikeCount = (lvl) => (lvl ? 2 + lvl * 3 : 0);
const rand = (a, b) => a + Math.random() * (b - a);

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
class MainScene extends Phaser.Scene {
  constructor() {
    super("main");
  }

  create() {
    this.cameras.main.setBounds(-300, -300, WORLD + 600, WORLD + 600);
    this.gfx = this.add.graphics();
    this.pts = Array.from({ length: 40 }, () => ({ x: 0, y: 0 }));
    this.particles = [];
    this.t = 0;
    this.dna = 0;
    this.traits = freshTraits();
    this.pop = POP_START;
    this.gen = 1;
    this.extinct = false;
    this.breedCool = 0;
    this.nearMate = null;
    this.shopOpen = false;
    this.shopMsg = "";
    this.shopClosedAt = 0;
    this.toast = "";
    this.toastT = 0;
    this.respawnT = 0;
    this.keys = this.input.keyboard.addKeys("SPACE,E,ESC,ENTER");

    this.food = Array.from({ length: PLANT_COUNT }, () => this.newPlant());
    this.player = this.newCell(0x4fc3f7, WORLD / 2, WORLD / 2, baseMass(0), 1);
    this.player.isPlayer = true;
    this.applyTraits(this.player);
    this.player.hp = maxHp(this.player);
    this.enemies = Array.from({ length: ENEMY_COUNT }, () => this.newEnemy());
    this.mates = Array.from({ length: MATE_COUNT }, () => this.newMate());
    this.camPos = { x: this.player.x, y: this.player.y };
    this.cameras.main.centerOn(this.player.x, this.player.y);
    this.cameras.main.setZoom(1.1);

    this.input.on("pointerdown", () => this.bite(this.player));
    this.keys.SPACE.on("down", () => this.bite(this.player));
    this.keys.E.on("down", () => (this.shopOpen ? this.closeShop() : this.tryBreed()));
    this.keys.ESC.on("down", () => this.closeShop());
    this.keys.ENTER.on("down", () => this.closeShop());
    this.game.events.on("buy", (key, dir) => this.buy(key, dir));
    this.game.events.on("closeShop", () => this.closeShop());
    this.scene.launch("ui");
  }

  cells() {
    return [this.player, ...this.enemies, ...this.mates].filter((c) => !c.dead);
  }

  say(msg, secs = 2.2) {
    this.toast = msg;
    this.toastT = secs;
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
      color, x, y, mass, vx: 0, vy: 0, angle: rand(0, TAU), seed: seed * 17.3,
      bite: 0, cool: 0, lookx: 1, looky: 0, elong: 1, eyes: 1, flagella: 1, spikes: 0, pulse: 0,
      spikeLvl: 0, venomLvl: 0, speedLvl: 0, tough: 0, poison: null, lastPoison: -9,
    };
    c.hp = maxHp(c);
    return c;
  }

  randomSpot(minFromPlayer) {
    let x, y;
    do {
      x = rand(0, WORLD);
      y = rand(0, WORLD);
    } while (this.player && Math.hypot(x - this.player.x, y - this.player.y) < minFromPlayer);
    return { x, y };
  }

  newEnemy() {
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
    return e;
  }

  // a member of your own species: same colour, wanders, wants to breed
  newMate() {
    const { x, y } = this.randomSpot(600);
    const m = this.newCell(shade(0x4fc3f7, 0.2), x, y, START_MASS * rand(0.9, 1.3), Math.random() * 100);
    m.isMate = true;
    m.wander = rand(0, TAU);
    m.eyes = 1;
    m.flagella = 1 + Math.floor(Math.random() * 2);
    return m;
  }

  applyTraits(p) {
    const T = this.traits;
    p.speedLvl = T.speed;
    p.spikeLvl = T.spikes;
    p.venomLvl = T.venom;
    p.tough = T.tough;
    p.eyes = Math.max(1, Math.min(3, 1 + Math.floor(T.size / 2)));
    p.flagella = Math.min(4, 1 + T.speed);
    p.spikes = spikeCount(T.spikes);
    p.elong = 1 + 0.04 * T.speed + 0.02 * Math.max(0, T.size);
    p.hp = Math.min(p.hp, maxHp(p));
  }

  // -- breeding + evolution shop -----------------------------------------------
  tryBreed() {
    const p = this.player;
    if (p.dead || this.shopOpen) return;
    const m = this.nearMate;
    if (!m) return;
    if (this.breedCool > 0) return this.say(`Resting... ${Math.ceil(this.breedCool)}s`, 1);
    const full = this.pop >= POP_MAX;
    this.pop = Math.min(POP_MAX, this.pop + 1);
    this.breedCool = BREED_COOLDOWN;
    this.shopMsg = full ? "Species at full strength" : "A new member joins your species!";
    this.burst((p.x + m.x) / 2, (p.y + m.y) / 2, 0xff8fd0, 36, 240);
    this.mates[this.mates.indexOf(m)] = this.newMate();
    [523, 659, 784].forEach((f, i) => setTimeout(() => sfx(f, 0.2, "triangle", 0.06), i * 80));
    this.shopOpen = true;
  }

  closeShop() {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    this.shopClosedAt = performance.now();
  }

  buy(key, dir) {
    if (!this.shopOpen) return;
    const t = TRAITS.find((x) => x.key === key);
    const to = this.traits[key] + dir;
    if (!t || to < t.min || to > t.max) return;
    const cost = t.cost(to);
    if (this.dna < cost) return sfx(140, 0.12, "square", 0.04);
    const p = this.player;
    const before = baseMass(this.traits.size);
    this.dna -= cost;
    this.traits[key] = to;
    if (key === "size") p.mass += baseMass(to) - before;
    this.applyTraits(p);
    p.pulse = 1;
    sfx(660, 0.15, "triangle", 0.07, 220);
  }

  // -- main loop --------------------------------------------------------------
  update(_, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.t += dt;
    this.toastT = Math.max(0, this.toastT - dt);
    if (this.shopOpen) {
      this.updateCamera();
      this.draw();
      this.publishHud();
      return;
    }
    this.breedCool = Math.max(0, this.breedCool - dt);
    if (!this.player.dead) this.movePlayer(dt);
    else {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.respawn();
    }
    for (const c of this.cells()) {
      if (c !== this.player) this.moveAI(c, dt);
    }
    for (const c of this.cells()) this.tickStatus(c, dt);
    this.updateFood(dt);
    this.resolveEating(dt);
    this.updateNearMate();
    this.updateParticles(dt);
    this.updateCamera();
    this.draw();
    this.publishHud();
  }

  updateNearMate() {
    const p = this.player;
    this.nearMate = null;
    if (p.dead) return;
    for (const m of this.mates) {
      if (!m.dead && Math.hypot(m.x - p.x, m.y - p.y) < radius(p.mass) + radius(m.mass) + 70) this.nearMate = m;
    }
  }

  tickStatus(c, dt) {
    if (c.dead) return;
    if (c.poison && c.poison.t > 0) {
      c.poison.t -= dt;
      if (Math.random() < dt * 8) this.burst(c.x + rand(-1, 1) * radius(c.mass), c.y + rand(-1, 1) * radius(c.mass), 0x7dff3a, 1, 30);
      this.hurt(c, c.poison.dps * dt, c.poison.by);
    } else {
      c.hp = Math.min(maxHp(c), c.hp + 3 * dt);
    }
  }

  hurt(c, amount, by) {
    if (c.dead) return;
    c.hp -= amount;
    if (c.hp > 0) return;
    if (by && !by.dead) this.grow(by, c.mass * 0.6);
    this.kill(c, by);
  }

  steer(c, dirx, diry, power, dt) {
    const ms = maxSpeed(c.mass, c.speedLvl);
    const tx = dirx * ms * power;
    const ty = diry * ms * power;
    const k = Math.min(1, dt * 3.2);
    c.vx += (tx - c.vx) * k;
    c.vy += (ty - c.vy) * k;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    const sp = Math.hypot(c.vx, c.vy);
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

  bite(c) {
    if (c.dead || c.cool > 0) return;
    if (c === this.player && (this.shopOpen || performance.now() - this.shopClosedAt < 250)) return;
    c.bite = 0.35;
    c.cool = c.isPlayer ? 0.7 : 1.5;
    const a = c.angle;
    c.vx += Math.cos(a) * 340;
    c.vy += Math.sin(a) * 340;
    if (c === this.player) sfx(220, 0.15, "triangle", 0.07, 180);
  }

  movePlayer(dt) {
    const p = this.player;
    const cam = this.cameras.main;
    const ptr = this.input.activePointer;
    const target = cam.getWorldPoint(ptr.x, ptr.y);
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dist = Math.hypot(dx, dy);
    p.lookx = dist ? dx / dist : 1;
    p.looky = dist ? dy / dist : 0;
    const power = Math.min(1, dist / (radius(p.mass) * 2.2));
    this.steer(p, dist ? dx / dist : 0, dist ? dy / dist : 0, power, dt);
  }

  moveAI(e, dt) {
    let dirx = 0;
    let diry = 0;
    let best = Infinity;
    let prey = null;
    const re = radius(e.mass);
    for (const o of this.cells()) {
      if (o === e) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      // small cells are hard to spot: sight grows with the target's size
      const sight = 240 + re + radius(o.mass) * 3;
      if (d > best || d > sight) continue;
      if (o.mass > e.mass * EAT_RATIO && d < 380) {
        dirx = e.x - o.x;
        diry = e.y - o.y;
        best = 0;
        prey = null;
      } else if (e.aggressive && e.mass > o.mass * EAT_RATIO && o.spikeLvl < 2 && best > 0) {
        dirx = o.x - e.x;
        diry = o.y - e.y;
        best = d;
        prey = o;
      }
    }
    if (prey && best < re * 2.2) this.bite(e);
    let power = 0.8;
    if (!dirx && !diry && e.isMate && this.breedCool <= 0 && !this.player.dead) {
      // ready mates drift toward you, then hold still
      const p = this.player;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < 900) {
        dirx = p.x - e.x;
        diry = p.y - e.y;
        if (d < radius(p.mass) + re + 30) power = 0;
      }
    }
    if (!dirx && !diry) {
      let nearest = null;
      let nd = 340;
      for (const f of this.food) {
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
    const cells = this.cells();
    for (const c of cells) {
      const m = this.mouth(c);
      const r = radius(c.mass);
      const pull = r * 1.5 + 50;
      for (let i = this.food.length - 1; i >= 0; i--) {
        const f = this.food[i];
        const d = Math.hypot(f.x - m.x, f.y - m.y);
        if (d > pull) continue;
        // slurp: food is drawn toward the mouth
        const k = (1 - d / pull) * 380;
        f.x += ((m.x - f.x) / (d || 1)) * k * 0.016;
        f.y += ((m.y - f.y) / (d || 1)) * k * 0.016;
        if (d < r * 0.5 + 8) {
          this.grow(c, f.mass);
          this.burst(f.x, f.y, f.kind ? 0xff6b7a : 0x7dff8a, 5, 60);
          if (c === this.player) sfx(520 + Math.random() * 160, 0.09, "sine", 0.05, 220);
          if (f.kind === 0) this.food[i] = this.newPlant();
          else this.food.splice(i, 1);
        }
      }
    }
    for (const a of cells) {
      if (a.dead) continue;
      const am = this.mouth(a);
      const ra = radius(a.mass);
      for (const b of cells) {
        if (a === b || a.dead || b.dead) continue;
        if ((a.isPlayer && b.isMate) || (a.isMate && b.isPlayer)) continue; // family
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const rb = radius(b.mass);
        // spikes hurt whatever rubs against them
        if (a.spikeLvl && d < ra + rb * 0.9) this.hurt(b, 14 * a.spikeLvl * dt, a);
        if (b.dead) continue;
        const mouthHit = Math.hypot(am.x - b.x, am.y - b.y) < rb * 0.8;
        if (a.mass >= b.mass * EAT_RATIO) {
          const engulf = d < ra - rb * 0.4;
          if ((a.bite > 0 && mouthHit) || engulf) {
            this.grow(a, b.mass * 0.6);
            const stabs = b.spikeLvl;
            this.kill(b, a);
            if (stabs) this.hurt(a, stabs * 24, b); // swallowing spikes hurts
          }
        } else if (a.venomLvl && a.bite > 0 && mouthHit && this.t - a.lastPoison > 0.5) {
          // too big to swallow: poison it instead
          a.lastPoison = this.t;
          b.poison = { dps: Math.max(b.poison?.dps ?? 0, 9 * a.venomLvl), t: 6, by: a };
          this.burst(b.x, b.y, 0x7dff3a, 12, 120);
          if (a === this.player) sfx(330, 0.2, "sawtooth", 0.05, -120);
        }
      }
    }
  }

  grow(c, amount) {
    c.mass += amount;
    if (c === this.player) this.dna += Math.ceil(amount);
  }

  kill(c, killer) {
    if (c.dead) return;
    c.dead = true;
    const chunks = Math.min(14, 3 + Math.floor(c.mass / 8));
    for (let i = 0; i < chunks; i++) this.food.push(this.newMeat(c.x, c.y, (c.mass * 0.35) / chunks + 0.5));
    this.burst(c.x, c.y, c.color, 30, 260);
    if (c === this.player) {
      this.pop -= 1;
      this.extinct = this.pop <= 0;
      this.respawnT = this.extinct ? 3.5 : 2;
      if (this.extinct) this.say("EXTINCT", 3.5);
      this.cameras.main.shake(350, 0.012);
      sfx(160, 0.5, "sawtooth", 0.08, -110);
    } else if (c.isMate) {
      this.mates[this.mates.indexOf(c)] = this.newMate();
    } else {
      this.enemies[this.enemies.indexOf(c)] = this.newEnemy();
      if (killer === this.player) {
        this.cameras.main.shake(120, 0.004);
        sfx(300, 0.2, "square", 0.05, 200);
      }
    }
  }

  respawn() {
    const p = this.player;
    if (this.extinct) {
      // a brand new species starts from scratch
      this.extinct = false;
      this.traits = freshTraits();
      this.dna = 0;
      this.pop = POP_START;
      this.gen += 1;
      this.breedCool = 0;
    }
    p.dead = false;
    p.mass = baseMass(this.traits.size);
    p.vx = p.vy = 0;
    p.bite = p.cool = 0;
    p.poison = null;
    do {
      p.x = rand(300, WORLD - 300);
      p.y = rand(300, WORLD - 300);
    } while (this.enemies.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 500));
    this.applyTraits(p);
    p.hp = maxHp(p);
    this.camPos.x = p.x;
    this.camPos.y = p.y;
    p.pulse = 1;
  }

  // -- particles + camera -------------------------------------------------------
  burst(x, y, color, n, speed) {
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
    const p = this.player;
    const k = 0.1;
    this.camPos.x += (p.x - this.camPos.x) * k;
    this.camPos.y += (p.y - this.camPos.y) * k;
    cam.centerOn(this.camPos.x, this.camPos.y);
    const target = Math.max(0.3, 1.25 - Math.sqrt(p.mass) * 0.032);
    cam.setZoom(Phaser.Math.Linear(cam.zoom, target, 0.03));
  }

  publishHud() {
    const p = this.player;
    let mate = null;
    let md = Infinity;
    for (const m of this.mates) {
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d < md) (md = d), (mate = m);
    }
    let prompt = "";
    if (!p.dead && this.nearMate) prompt = this.breedCool <= 0 ? "Press E to breed" : `Resting... ${Math.ceil(this.breedCool)}s`;
    this.game.events.emit("hud", {
      dna: this.dna,
      pop: this.pop,
      popMax: POP_MAX,
      gen: this.gen,
      traits: this.traits,
      shopOpen: this.shopOpen,
      shopMsg: this.shopMsg,
      prompt,
      mateDx: mate ? mate.x - p.x : 0,
      mateDy: mate ? mate.y - p.y : 0,
      mateDist: md,
      mateReady: this.breedCool <= 0,
      toast: this.toastT > 0 ? this.toast : "",
      toastAlpha: Math.min(1, this.toastT),
      dead: !!p.dead,
      deadMsg: this.extinct ? "Your species went extinct...\na new one begins" : `You were eaten...\n${this.pop} left in your species`,
      px: p.x,
      py: p.y,
      scrollX: this.cameras.main.scrollX,
      scrollY: this.cameras.main.scrollY,
      dots: [
        ...this.enemies.map((e) => ({ x: e.x, y: e.y, danger: e.mass > p.mass * 1.1 ? 2 : e.mass > p.mass * 0.9 ? 1 : 0 })),
        ...this.mates.map((m) => ({ x: m.x, y: m.y, mate: true })),
      ],
    });
  }

  // -- rendering ----------------------------------------------------------------
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

    const cells = this.cells().sort((a, b) => a.mass - b.mass);
    for (const c of cells) {
      if (!inView(c.x, c.y, radius(c.mass) * 3)) continue;
      this.drawCell(g, c);
      const mh = maxHp(c);
      if (c.hp < mh - 1) {
        const w = radius(c.mass) * 1.6;
        const y = c.y - radius(c.mass) * 1.5;
        g.fillStyle(0x2a0a14, 0.7).fillRect(c.x - w / 2, y, w, 5);
        g.fillStyle(c.poison ? 0x7dff3a : 0xff4d6d, 1).fillRect(c.x - w / 2, y, w * Math.max(0, c.hp / mh), 5);
      }
    }

    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.max);
      g.fillStyle(p.color, a * 0.9).fillCircle(p.x, p.y, p.size * (0.4 + a));
    }
  }

  drawCell(g, c) {
    const R = radius(c.mass);
    const t = this.t;
    const sp = Math.min(1, Math.hypot(c.vx, c.vy) / maxSpeed(c.mass));
    const ca = Math.cos(c.angle);
    const sa = Math.sin(c.angle);
    const to = (lx, ly) => ({ x: c.x + lx * ca - ly * sa, y: c.y + lx * sa + ly * ca });
    const col = c.color;
    const light = shade(col, 0.45);
    const dark = shade(col, -0.45);

    // aura (the player glows brighter so you never lose yourself)
    const auraBoost = c.isPlayer ? 0.12 : 0.05;
    g.fillStyle(col, auraBoost).fillCircle(c.x, c.y, R * 1.7);
    g.fillStyle(col, auraBoost).fillCircle(c.x, c.y, R * 1.3);
    if (c.isMate && this.breedCool <= 0) g.lineStyle(3, 0xff8fd0, 0.5 + 0.4 * Math.sin(t * 5)).strokeCircle(c.x, c.y, R * (1.5 + 0.1 * Math.sin(t * 5)));
    if (c.poison && c.poison.t > 0) g.fillStyle(0x7dff3a, 0.22).fillCircle(c.x, c.y, R * 1.15);
    if (c.pulse > 0) g.lineStyle(4, 0xb7fff0, c.pulse).strokeCircle(c.x, c.y, R * (1.2 + (1 - c.pulse) * 2.5));

    // flagella: sine-wave tails trailing behind
    for (let f = 0; f < c.flagella; f++) {
      const off = (f - (c.flagella - 1) / 2) * 0.5;
      const segs = 12;
      const len = R * (1.6 + sp * 0.6);
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
        const p1 = to(Math.cos(a) * R * c.elong * 1.4, Math.sin(a) * R * 1.4);
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
        0.05 * Math.sin(a * 3 + t * 2.2 + c.seed) +
        0.03 * Math.sin(a * 5 - t * 3.1 + c.seed * 2) +
        (c.bite > 0 ? 0.06 * Math.sin(a * 2 + t * 30) * (c.bite / 0.35) : 0);
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
    g.fillStyle(col, 0.82).fillPath();
    g.lineStyle(Math.max(2, R * 0.1), light, 0.95);
    path();
    g.strokePath();
    // inner membrane + specular highlight
    g.lineStyle(1.5, light, 0.35).strokeCircle(c.x, c.y, R * 0.78);
    g.fillStyle(0xffffff, 0.22).fillEllipse(c.x - R * 0.35, c.y - R * 0.45, R * 0.7, R * 0.35);

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
      g.fillStyle(0x7dff3a, 0.85).fillCircle(vp.x, vp.y, R * 0.07);
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
    if (open > 0.5) {
      g.fillStyle(0xffffff, 0.9);
      for (const s of [-1, 1]) {
        const tp = to(R * c.elong * 0.92, s * mr * 0.55);
        g.fillCircle(tp.x, tp.y, R * 0.04);
      }
    }
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
    this.hintText = this.add.text(24, 112, "Find a mate (pink ring) and press E to breed", { ...style, fontSize: "12px", color: "#6fb5ab" });
    this.promptText = this.add.text(0, 0, "", { ...style, fontSize: "22px", fontStyle: "bold", color: "#ffb3e0", stroke: "#2a0a14", strokeThickness: 5 }).setOrigin(0.5);
    this.toastText = this.add.text(0, 0, "", { ...style, fontSize: "56px", fontStyle: "bold", color: "#b7fff0", stroke: "#03222e", strokeThickness: 8 }).setOrigin(0.5);
    this.deadText = this.add.text(0, 0, "", { ...style, fontSize: "36px", fontStyle: "bold", color: "#ff8fa3", stroke: "#2a0a14", strokeThickness: 6 }).setOrigin(0.5);
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
    const W = 640;
    const rowH = 72;
    const top = 100;
    const H = top + TRAITS.length * rowH + 70;
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
    this.makeButton(0, H / 2 - 36, 160, "DONE  (E)", () => this.game.events.emit("closeShop"));
  }

  paintButton(btn, label, ok) {
    btn.text.setText(label).setColor(ok ? "#e8fffb" : "#5d7f86");
    btn.rect.setFillStyle(ok ? 0x15806a : 0x12262e);
  }

  updateShop(h, W, H) {
    this.shop.setVisible(h.shopOpen);
    if (!h.shopOpen) return;
    this.shop.setPosition(W / 2, H / 2);
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

    // points + species count
    this.dnaText.setText(`POINTS  ${h.dna}`);
    this.lvlText.setText(`SPECIES #${h.gen}`);
    for (let i = 0; i < h.popMax; i++) {
      const x = 32 + i * 26;
      if (i < h.pop) g.fillStyle(0x4fc3f7, 1).fillCircle(x, 94, 9).lineStyle(2, 0xe8fffb, 0.8).strokeCircle(x, 94, 9);
      else g.lineStyle(2, 0x8fd9cf, 0.4).strokeCircle(x, 94, 9);
    }

    // arrow toward the nearest mate when it is off in the distance
    if (!h.dead && !h.shopOpen && h.mateDist > 500) {
      const a = Math.atan2(h.mateDy, h.mateDx);
      const R = Math.min(W, H) * 0.36;
      const cx = W / 2 + Math.cos(a) * R;
      const cy = H / 2 + Math.sin(a) * R;
      const pt = (ang, len) => [cx + Math.cos(a + ang) * len, cy + Math.sin(a + ang) * len];
      const [x0, y0] = pt(0, 16);
      const [x1, y1] = pt(2.5, 12);
      const [x2, y2] = pt(-2.5, 12);
      g.fillStyle(h.mateReady ? 0xff8fd0 : 0x6a8a93, 0.8).fillTriangle(x0, y0, x1, y1, x2, y2);
    }

    // radar: red = can eat you, yellow = even match, green = prey, blue = mates
    const mw = 150;
    const mx = W - mw - 20;
    const my = H - mw - 20;
    g.fillStyle(0x03222e, 0.65).fillRoundedRect(mx, my, mw, mw, 12);
    g.lineStyle(2, 0x8fd9cf, 0.5).strokeRoundedRect(mx, my, mw, mw, 12);
    const cols = [0x4cffa0, 0xffd54a, 0xff4d6d];
    for (const d of h.dots) {
      if (d.mate) g.fillStyle(0xff8fd0, 1).fillCircle(mx + (d.x / WORLD) * mw, my + (d.y / WORLD) * mw, 3);
      else g.fillStyle(cols[d.danger], 0.9).fillCircle(mx + (d.x / WORLD) * mw, my + (d.y / WORLD) * mw, 2.5);
    }
    g.fillStyle(0x4fc3f7, 1).fillCircle(mx + (h.px / WORLD) * mw, my + (h.py / WORLD) * mw, 4);
    g.lineStyle(1.5, 0xffffff, 0.9).strokeCircle(mx + (h.px / WORLD) * mw, my + (h.py / WORLD) * mw, 4);

    this.promptText.setPosition(W / 2, H - 70).setText(h.shopOpen ? "" : h.prompt);
    this.toastText.setPosition(W / 2, H * 0.28).setText(h.toast).setAlpha(h.toastAlpha).setScale(1 + (1 - h.toastAlpha) * 0.2);
    this.deadText.setPosition(W / 2, H / 2).setText(h.dead ? h.deadMsg : "").setAlign("center");
    if (h.dead) g.fillStyle(0x2a0a14, 0.35).fillRect(0, 0, W, H);
    if (h.shopOpen) g.fillStyle(0x000000, 0.45).fillRect(0, 0, W, H);
    this.updateShop(h, W, H);
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  transparent: true,
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: [MainScene, UIScene],
});

if (import.meta.env.DEV) window.__evo = game;
