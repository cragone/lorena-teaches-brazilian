import Phaser from "phaser";

const WORLD = 4000;
const START_MASS = 20;
const FOOD_COUNT = 400;
const FOOD_MASS = 1;
const ENEMY_COUNT = 20;
const EAT_RATIO = 1.1;

const radius = (mass) => Math.sqrt(mass) * 4;
const speed = (mass) => 260 / Math.pow(mass, 0.25);
const rand = (a, b) => a + Math.random() * (b - a);

class MainScene extends Phaser.Scene {
  constructor() {
    super("main");
  }

  create() {
    this.cameras.main.setBounds(-200, -200, WORLD + 400, WORLD + 400);
    this.gfx = this.add.graphics();
    this.hud = this.add
      .text(16, 16, "", { fontSize: "20px", color: "#ffffff" })
      .setScrollFactor(0)
      .setDepth(10);

    this.food = Array.from({ length: FOOD_COUNT }, () => this.newFood());
    this.player = this.newCell(0x4fc3f7, WORLD / 2, WORLD / 2, START_MASS);
    this.enemies = Array.from({ length: ENEMY_COUNT }, () => this.newEnemy());
    this.best = 0;
  }

  newFood() {
    return { x: rand(0, WORLD), y: rand(0, WORLD) };
  }

  newCell(color, x, y, mass) {
    return { color, x, y, mass, vx: 0, vy: 0 };
  }

  newEnemy() {
    const color = Phaser.Display.Color.HSLToColor(rand(0, 0.15) + (Math.random() < 0.5 ? 0 : 0.7), 0.7, 0.55).color;
    const e = this.newCell(color, rand(0, WORLD), rand(0, WORLD), rand(START_MASS * 0.5, START_MASS * 4));
    e.wander = rand(0, Math.PI * 2);
    return e;
  }

  update(_, delta) {
    const dt = delta / 1000;
    this.movePlayer(dt);
    this.enemies.forEach((e) => this.moveEnemy(e, dt));
    this.resolveEating();
    this.draw();
  }

  movePlayer(dt) {
    const p = this.player;
    const cam = this.cameras.main;
    const ptr = this.input.activePointer;
    const target = cam.getWorldPoint(ptr.x, ptr.y);
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 4) {
      const s = speed(p.mass) * Math.min(1, dist / 60);
      p.x += (dx / dist) * s * dt;
      p.y += (dy / dist) * s * dt;
    }
    this.clamp(p);
    cam.centerOn(p.x, p.y);
    cam.setZoom(Phaser.Math.Linear(cam.zoom, Math.max(0.35, 1.2 - Math.sqrt(p.mass) * 0.03), 0.03));
  }

  moveEnemy(e, dt) {
    let dirx = 0;
    let diry = 0;
    let best = 450 + radius(e.mass);
    // chase smaller cells, flee larger ones, otherwise seek nearby food
    for (const o of [this.player, ...this.enemies]) {
      if (o === e) continue;
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d > best) continue;
      if (e.mass > o.mass * EAT_RATIO) {
        dirx = o.x - e.x;
        diry = o.y - e.y;
        best = d;
      } else if (o.mass > e.mass * EAT_RATIO && d < 350) {
        dirx = e.x - o.x;
        diry = e.y - o.y;
        best = 0;
      }
    }
    if (!dirx && !diry) {
      let nearest = null;
      let nd = 300;
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
    const s = speed(e.mass) * 0.85;
    e.x += (dirx / len) * s * dt;
    e.y += (diry / len) * s * dt;
    this.clamp(e);
  }

  clamp(c) {
    c.x = Phaser.Math.Clamp(c.x, 0, WORLD);
    c.y = Phaser.Math.Clamp(c.y, 0, WORLD);
  }

  resolveEating() {
    const cells = [this.player, ...this.enemies];
    for (const c of cells) {
      const r = radius(c.mass);
      for (let i = 0; i < this.food.length; i++) {
        const f = this.food[i];
        if (Math.hypot(f.x - c.x, f.y - c.y) < r) {
          c.mass += FOOD_MASS;
          this.food[i] = this.newFood();
        }
      }
    }
    for (const a of cells) {
      for (const b of cells) {
        if (a === b || a.dead || b.dead) continue;
        if (a.mass > b.mass * EAT_RATIO && Math.hypot(a.x - b.x, a.y - b.y) < radius(a.mass) - radius(b.mass) * 0.4) {
          a.mass += b.mass;
          this.kill(b);
        }
      }
    }
  }

  kill(c) {
    if (c === this.player) {
      this.best = Math.max(this.best, Math.floor(c.mass));
      c.mass = START_MASS;
      c.x = rand(0, WORLD);
      c.y = rand(0, WORLD);
    } else {
      const i = this.enemies.indexOf(c);
      this.enemies[i] = this.newEnemy();
    }
  }

  draw() {
    const g = this.gfx;
    g.clear();
    g.fillStyle(0x10161d, 1).fillRect(0, 0, WORLD, WORLD);
    g.lineStyle(1, 0x1d2630, 1);
    for (let i = 0; i <= WORLD; i += 100) {
      g.lineBetween(i, 0, i, WORLD);
      g.lineBetween(0, i, WORLD, i);
    }
    g.lineStyle(6, 0x3a4a5a, 1).strokeRect(0, 0, WORLD, WORLD);

    g.fillStyle(0x4cff6a, 1);
    for (const f of this.food) g.fillCircle(f.x, f.y, 5);

    const cells = [...this.enemies, this.player].sort((a, b) => a.mass - b.mass);
    for (const c of cells) {
      g.fillStyle(c.color, 1).fillCircle(c.x, c.y, radius(c.mass));
      g.lineStyle(3, 0xffffff, c === this.player ? 0.9 : 0.25).strokeCircle(c.x, c.y, radius(c.mass));
    }

    this.hud.setText(`size ${Math.floor(this.player.mass)}   best ${this.best}`);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#0b0f14",
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: [MainScene],
});
