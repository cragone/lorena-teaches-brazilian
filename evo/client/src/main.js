import Phaser from "phaser";

const WORLD = 5000;
const START_MASS = 20;
const PLANT_COUNT = 450;
const ENEMY_COUNT = 26;
const EAT_RATIO = 1.15;
const LEVELS = [0, 35, 70, 130, 220, 350];
const TAU = Math.PI * 2;

const radius = (mass) => Math.sqrt(mass) * 4.2;
const maxSpeed = (mass) => 300 / Math.pow(mass, 0.22);
const rand = (a, b) => a + Math.random() * (b - a);
const levelOf = (mass) => LEVELS.filter((m) => mass >= m).length;

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
    this.toast = "";
    this.toastT = 0;
    this.respawnT = 0;
    this.keys = this.input.keyboard.addKeys("SPACE");

    this.food = Array.from({ length: PLANT_COUNT }, () => this.newPlant());
    this.player = this.newCell(0x4fc3f7, WORLD / 2, WORLD / 2, START_MASS, 1);
    this.applyTraits(this.player);
    this.enemies = Array.from({ length: ENEMY_COUNT }, () => this.newEnemy());
    this.camPos = { x: this.player.x, y: this.player.y };
    this.cameras.main.centerOn(this.player.x, this.player.y);
    this.cameras.main.setZoom(1.1);

    this.input.on("pointerdown", () => this.bite(this.player));
    this.keys.SPACE.on("down", () => this.bite(this.player));
    this.scene.launch("ui");
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
    return {
      color, x, y, mass, vx: 0, vy: 0, angle: rand(0, TAU), seed: seed * 17.3,
      bite: 0, cool: 0, lookx: 1, looky: 0, elong: 1, eyes: 1, flagella: 1, spikes: 0, level: 1, pulse: 0,
    };
  }

  newEnemy() {
    const aggressive = Math.random() < 0.4;
    // hostile microbes run hot (red/orange/magenta), peaceful ones cool (green/blue/violet)
    const hue = aggressive ? rand(-0.05, 0.1) : rand(0.28, 0.8);
    const color = Phaser.Display.Color.HSLToColor((hue + 1) % 1, 0.65, 0.55).color;
    let x, y;
    do {
      x = rand(0, WORLD);
      y = rand(0, WORLD);
    } while (this.player && Math.hypot(x - this.player.x, y - this.player.y) < 900);
    const e = this.newCell(color, x, y, rand(START_MASS * 0.5, START_MASS * 5), Math.random() * 100);
    e.aggressive = aggressive;
    e.wander = rand(0, TAU);
    e.elong = rand(0.9, 1.3);
    e.eyes = 1 + Math.floor(Math.random() * 3);
    e.flagella = 1 + Math.floor(Math.random() * 3);
    e.spikes = aggressive ? 5 + Math.floor(Math.random() * 6) : Math.random() < 0.15 ? 6 : 0;
    return e;
  }

  applyTraits(p) {
    const lvl = levelOf(p.mass);
    p.eyes = Math.min(3, 1 + Math.floor((lvl - 1) / 2));
    p.flagella = Math.min(3, lvl);
    p.spikes = lvl >= 4 ? 4 + (lvl - 4) * 3 : 0;
    p.elong = 1 + Math.min(0.25, (lvl - 1) * 0.05);
  }

  // -- main loop --------------------------------------------------------------
  update(_, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.t += dt;
    if (!this.player.dead) this.movePlayer(dt);
    else {
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.respawn();
    }
    this.enemies.forEach((e) => this.moveEnemy(e, dt));
    this.updateFood(dt);
    this.resolveEating();
    this.updateParticles(dt);
    this.updateCamera();
    this.draw();
    this.toastT = Math.max(0, this.toastT - dt);
    this.publishHud();
  }

  steer(c, dirx, diry, power, dt) {
    const ms = maxSpeed(c.mass);
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
    c.bite = 0.35;
    c.cool = c.isPlayer ? 0.7 : 1.5;
    const a = c.angle;
    c.vx += Math.cos(a) * 340;
    c.vy += Math.sin(a) * 340;
    if (c === this.player) sfx(220, 0.15, "triangle", 0.07, 180);
  }

  movePlayer(dt) {
    const p = this.player;
    p.isPlayer = true;
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

  moveEnemy(e, dt) {
    let dirx = 0;
    let diry = 0;
    let best = 520 + radius(e.mass);
    let prey = null;
    for (const o of [this.player, ...this.enemies]) {
      if (o === e || o.dead) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d > best) continue;
      if (o.mass > e.mass * EAT_RATIO && d < 380) {
        dirx = e.x - o.x;
        diry = e.y - o.y;
        best = 0;
        prey = null;
      } else if (e.aggressive && e.mass > o.mass * EAT_RATIO && best > 0) {
        dirx = o.x - e.x;
        diry = o.y - e.y;
        best = d;
        prey = o;
      }
    }
    if (prey && best < radius(e.mass) * 2.2) this.bite(e);
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
    this.steer(e, e.lookx, e.looky, 0.8, dt);
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

  resolveEating() {
    const cells = [this.player, ...this.enemies].filter((c) => !c.dead);
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
      const am = this.mouth(a);
      for (const b of cells) {
        if (a === b || a.dead || b.dead) continue;
        if (a.mass < b.mass * EAT_RATIO) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const rb = radius(b.mass);
        const mouthHit = Math.hypot(am.x - b.x, am.y - b.y) < rb * 0.8;
        const engulf = d < radius(a.mass) - rb * 0.4;
        if ((a.bite > 0 && mouthHit) || engulf) {
          this.grow(a, b.mass * 0.6);
          this.kill(b, a);
        }
      }
    }
  }

  grow(c, amount) {
    const before = levelOf(c.mass);
    c.mass += amount;
    if (c === this.player) {
      this.dna += Math.ceil(amount);
      const after = levelOf(c.mass);
      if (after > before) {
        this.applyTraits(c);
        c.pulse = 1;
        this.toast = after >= LEVELS.length ? "APEX PREDATOR" : "EVOLVED!";
        this.toastT = 2.2;
        this.cameras.main.flash(250, 120, 255, 220);
        this.burst(c.x, c.y, 0xb7fff0, 40, 320);
        [440, 554, 659, 880].forEach((f, i) => setTimeout(() => sfx(f, 0.25, "triangle", 0.07), i * 90));
      }
    }
  }

  kill(c, killer) {
    const chunks = Math.min(14, 3 + Math.floor(c.mass / 8));
    for (let i = 0; i < chunks; i++) this.food.push(this.newMeat(c.x, c.y, (c.mass * 0.35) / chunks + 0.5));
    this.burst(c.x, c.y, c.color, 30, 260);
    if (c === this.player) {
      c.dead = true;
      this.respawnT = 2;
      this.cameras.main.shake(350, 0.012);
      sfx(160, 0.5, "sawtooth", 0.08, -110);
    } else {
      const i = this.enemies.indexOf(c);
      this.enemies[i] = this.newEnemy();
      if (killer === this.player) {
        this.cameras.main.shake(120, 0.004);
        sfx(300, 0.2, "square", 0.05, 200);
      }
    }
  }

  respawn() {
    const p = this.player;
    p.dead = false;
    p.mass = START_MASS;
    p.vx = p.vy = 0;
    p.bite = p.cool = 0;
    do {
      p.x = rand(300, WORLD - 300);
      p.y = rand(300, WORLD - 300);
    } while (this.enemies.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 500));
    this.applyTraits(p);
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
    const lvl = levelOf(p.mass);
    const lo = LEVELS[lvl - 1];
    const hi = LEVELS[lvl] ?? lo;
    this.game.events.emit("hud", {
      dna: this.dna,
      level: lvl,
      maxLevel: LEVELS.length,
      growth: hi === lo ? 1 : (p.mass - lo) / (hi - lo),
      toast: this.toastT > 0 ? this.toast : "",
      toastAlpha: Math.min(1, this.toastT),
      dead: !!p.dead,
      px: p.x,
      py: p.y,
      scrollX: this.cameras.main.scrollX,
      scrollY: this.cameras.main.scrollY,
      dots: this.enemies.map((e) => ({ x: e.x, y: e.y, danger: e.mass > p.mass * 1.1 ? 2 : e.mass > p.mass * 0.9 ? 1 : 0 })),
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

    const cells = [...this.enemies, this.player].filter((c) => !c.dead).sort((a, b) => a.mass - b.mass);
    for (const c of cells) if (inView(c.x, c.y, radius(c.mass) * 3)) this.drawCell(g, c);

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
    this.dnaText = this.add.text(24, 20, "", { ...style, fontSize: "26px", fontStyle: "bold" });
    this.lvlText = this.add.text(24, 54, "", { ...style, fontSize: "14px", color: "#8fd9cf" });
    this.toastText = this.add.text(0, 0, "", { ...style, fontSize: "56px", fontStyle: "bold", color: "#b7fff0", stroke: "#03222e", strokeThickness: 8 }).setOrigin(0.5);
    this.deadText = this.add.text(0, 0, "", { ...style, fontSize: "36px", fontStyle: "bold", color: "#ff8fa3", stroke: "#2a0a14", strokeThickness: 6 }).setOrigin(0.5);
    this.game.events.on("hud", (d) => (this.hud = d));
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

    // DNA + growth bar
    this.dnaText.setText(`DNA  ${h.dna}`);
    this.lvlText.setText(`EVOLUTION ${h.level} / ${h.maxLevel}`);
    g.fillStyle(0x03222e, 0.7).fillRoundedRect(24, 78, 220, 14, 7);
    g.fillStyle(0x4cffd0, 1).fillRoundedRect(24, 78, Math.max(14, 220 * h.growth), 14, 7);
    g.lineStyle(2, 0x8fd9cf, 0.6).strokeRoundedRect(24, 78, 220, 14, 7);

    // radar: red = can eat you, yellow = even match, green = prey
    const mw = 150;
    const mx = W - mw - 20;
    const my = H - mw - 20;
    g.fillStyle(0x03222e, 0.65).fillRoundedRect(mx, my, mw, mw, 12);
    g.lineStyle(2, 0x8fd9cf, 0.5).strokeRoundedRect(mx, my, mw, mw, 12);
    const cols = [0x4cffa0, 0xffd54a, 0xff4d6d];
    for (const d of h.dots) g.fillStyle(cols[d.danger], 0.9).fillCircle(mx + (d.x / WORLD) * mw, my + (d.y / WORLD) * mw, 2.5);
    g.fillStyle(0x4fc3f7, 1).fillCircle(mx + (h.px / WORLD) * mw, my + (h.py / WORLD) * mw, 4);
    g.lineStyle(1.5, 0xffffff, 0.9).strokeCircle(mx + (h.px / WORLD) * mw, my + (h.py / WORLD) * mw, 4);

    this.toastText.setPosition(W / 2, H * 0.28).setText(h.toast).setAlpha(h.toastAlpha).setScale(1 + (1 - h.toastAlpha) * 0.2);
    this.deadText.setPosition(W / 2, H / 2).setText(h.dead ? "You were eaten...\nevolving again" : "").setAlign("center");
    if (h.dead) g.fillStyle(0x2a0a14, 0.35).fillRect(0, 0, W, H);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  transparent: true,
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: [MainScene, UIScene],
});
