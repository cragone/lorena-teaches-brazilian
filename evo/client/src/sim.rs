//! The whole simulation. One browser in each room (the host) runs it; the server only relays.
//! There are two worlds that run side by side: the pond (water stage) and the land. Each player
//! lives in one of them and moves to the land once their species is at full strength.
use crate::model::*;
use crate::util::*;
use std::collections::{BTreeMap, HashMap};

pub struct World {
    pub stage: Stage,
    pub food: Vec<Food>, // plants first (PLANT_COUNT of them), then meat
    pub cells: Vec<Cell>,
    pub toxins: Vec<Toxin>,
    pub plant_diff: Vec<(usize, f64, f64, f64)>,
    grid: HashMap<i32, Vec<usize>>,
}

pub struct Sim {
    pub worlds: [World; 2],
    pub pls: BTreeMap<u32, Player>,
    pub t: f64,
    pub evq: Vec<Fx>,       // for the other players
    pub local_fx: Vec<Fx>,  // for this browser
    pub pending_state: Vec<(u32, usize)>, // players that need the plants of a world sent over
    next_id: u32,
    live: Vec<usize>,
}

impl World {
    fn new(stage: Stage) -> World {
        World { stage, food: Vec::new(), cells: Vec::new(), toxins: Vec::new(), plant_diff: Vec::new(), grid: HashMap::new() }
    }
    pub fn idx(&self, id: u32) -> Option<usize> {
        self.cells.iter().position(|c| c.id == id)
    }
    fn alive_idx(&self, id: u32) -> Option<usize> {
        self.idx(id).filter(|&i| !self.cells[i].dead)
    }
}

fn new_plant() -> Food {
    Food { x: rand(0.0, WORLD), y: rand(0.0, WORLD), kind: 0, mass: 1.0, bob: rand(0.0, TAU), size: rand(4.0, 7.0), vx: 0.0, vy: 0.0, ttl: 0.0, eaten: false }
}
fn new_meat(x: f64, y: f64, mass: f64) -> Food {
    let a = rand(0.0, TAU);
    let s = rand(40.0, 140.0);
    Food { x, y, kind: 1, mass, bob: rand(0.0, TAU), size: 5.0 + mass.sqrt() * 1.4, vx: a.cos() * s, vy: a.sin() * s, ttl: 40.0, eaten: false }
}

impl Sim {
    pub fn new(my_id: u32, name: &str) -> Sim {
        let mut s = Sim {
            worlds: [World::new(Stage::Water), World::new(Stage::Land)],
            pls: BTreeMap::new(),
            t: 0.0,
            evq: Vec::new(),
            local_fx: Vec::new(),
            pending_state: Vec::new(),
            next_id: 1,
            live: Vec::new(),
        };
        for w in 0..2 {
            s.worlds[w].food = (0..PLANT_COUNT).map(|_| new_plant()).collect();
            for _ in 0..ENEMY_COUNT {
                let e = s.new_enemy(w);
                s.worlds[w].cells.push(e);
            }
            for _ in 0..MATE_COUNT {
                let m = s.new_mate(w);
                s.worlds[w].cells.push(m);
            }
        }
        if !name.is_empty() {
            s.add_player(my_id, name, None);
        }
        s
    }

    fn nid(&mut self) -> u32 {
        self.next_id += 1;
        self.next_id
    }

    // -- events -----------------------------------------------------------------
    fn fx(&mut self, ev: Fx) {
        self.local_fx.push(ev.clone());
        self.evq.push(ev);
    }
    fn burst(&mut self, w: usize, x: f64, y: f64, color: u32, n: u32, speed: f64) {
        self.fx(Fx::Burst { w: w as u8, x: x.round(), y: y.round(), c: color, n, s: speed });
    }
    fn toast(&mut self, pid: u32, m: &str, s: f64) {
        self.fx(Fx::Toast { p: pid, m: m.to_string(), s });
    }
    fn sfx_to(&mut self, pid: Option<u32>, f: f64, dur: f64, kind: &str, vol: f64, slide: f64) {
        if let Some(p) = pid {
            self.fx(Fx::Sfx { p, a: (f, dur, kind.to_string(), vol, slide), d: 0.0 });
        }
    }
    fn sfx_cell(&mut self, w: usize, i: usize, f: f64, dur: f64, kind: &str, vol: f64, slide: f64) {
        let pid = self.worlds[w].cells[i].pid;
        self.sfx_to(pid, f, dur, kind, vol, slide);
    }

    // -- players ----------------------------------------------------------------
    pub fn add_player(&mut self, id: u32, name: &str, saved: Option<&Rec>) -> u32 {
        let stage = saved.map_or(Stage::Water, |r| r.st);
        let w = stage.idx();
        let used: Vec<u32> = self.pls.values().map(|p| p.color).collect();
        let color = saved.map(|r| r.col).or_else(|| PLAYER_COLORS.iter().copied().find(|c| !used.contains(c))).unwrap_or(PLAYER_COLORS[self.pls.len() % PLAYER_COLORS.len()]);
        let spot = self.spawn_spot(w);
        let cid = self.nid();
        let mut c = Cell::new(cid, color, spot.0, spot.1, base_mass(0), rand(0.0, 100.0));
        c.kind = Kind::Player;
        c.pid = Some(id);
        c.name = name.chars().take(16).collect();
        c.shield = 3.0;
        let mut pl = Player {
            id, name: c.name.clone(), color, dna: 0.0, traits: Traits::fresh(), pop: POP_START, species: 1, extinct: false, respawn_t: 0.0, unlocks: Vec::new(),
            breed_cool: 0.0, split_cool: 0.0, poison_cool: 0.0, near_mate: None, shop_open: false, shop_msg: String::new(), inp: None, stage, cell_id: cid,
        };
        if let Some(r) = saved {
            pl.dna = r.dna as f64;
            pl.pop = r.pop;
            pl.species = r.species;
            pl.breed_cool = r.cb as f64;
            pl.shop_open = r.shop;
            pl.traits = r.tr.clone();
            pl.unlocks = r.ul.clone();
            if !r.dead {
                c.x = r.x;
                c.y = r.y;
                c.mass = r.mass as f64;
            }
        }
        apply_traits(&mut c, &pl.traits);
        c.hp = max_hp(&c);
        self.worlds[w].cells.push(c);
        self.pls.insert(id, pl);
        id
    }

    pub fn remove_player(&mut self, id: u32) {
        if let Some(pl) = self.pls.remove(&id) {
            let w = &mut self.worlds[pl.stage.idx()];
            let owned: Vec<u32> = vec![pl.cell_id];
            w.cells.retain(|c| !(owned.contains(&c.id) || c.owner.is_some_and(|o| owned.contains(&o))));
        }
    }

    pub fn pcell(&self, pid: u32) -> Option<(usize, usize)> {
        let pl = self.pls.get(&pid)?;
        let w = pl.stage.idx();
        Some((w, self.worlds[w].idx(pl.cell_id)?))
    }

    fn spawn_spot(&self, w: usize) -> (f64, f64) {
        loop {
            let x = rand(300.0, WORLD - 300.0);
            let y = rand(300.0, WORLD - 300.0);
            if !self.worlds[w].cells.iter().any(|e| e.kind == Kind::Enemy && dist2(e.x, e.y, x, y) < 500.0) {
                return (x, y);
            }
        }
    }

    fn random_spot(&self, w: usize, min_from_player: f64) -> (f64, f64) {
        loop {
            let x = rand(0.0, WORLD);
            let y = rand(0.0, WORLD);
            if !self.worlds[w].cells.iter().any(|p| p.kind == Kind::Player && dist2(x, y, p.x, p.y) < min_from_player) {
                return (x, y);
            }
        }
    }

    // -- spawning ---------------------------------------------------------------
    fn new_amoeba(&mut self, w: usize) -> Cell {
        let (x, y) = self.random_spot(w, 200.0);
        let id = self.nid();
        let mut e = Cell::new(id, hsl(rand(0.1, 0.16), 0.5, 0.62), x, y, START_MASS * 0.25, rand(0.0, 100.0));
        e.amoeba = true;
        e.wander = rand(0.0, TAU);
        e.flagella = 0;
        e
    }

    fn new_epic(&mut self, w: usize, kind: Epic) -> Cell {
        let (x, y) = self.random_spot(w, 900.0);
        let mass = match kind {
            Epic::Venom => START_MASS * 2.5,
            Epic::Mitosis => START_MASS * rand(18.0, 24.0),
            Epic::Fins => START_MASS * 1.6,
            Epic::Jelly => START_MASS * 3.0,
        };
        let id = self.nid();
        let mut e = Cell::new(id, kind.color(Stage::from_idx(w as u8)), x, y, mass, rand(0.0, 100.0));
        e.epic = Some(kind);
        e.aggressive = true;
        e.wander = rand(0.0, TAU);
        e.eyes = 3;
        e.flagella = 2;
        e.elong = 1.1;
        match kind {
            Epic::Venom => e.toxic_lvl = 1,
            Epic::Mitosis => {
                e.splitter = true;
                e.split_cool = rand(3.0, 6.0);
            }
            Epic::Fins => {
                e.fins_lvl = 5;
                e.flagella = 1;
            }
            Epic::Jelly => {
                e.shock_lvl = 3;
                e.speed_lvl = 4;
                e.flagella = 4;
            }
        }
        e.hp = max_hp(&e);
        e
    }

    fn new_enemy(&mut self, w: usize) -> Cell {
        let epics = self.worlds[w].cells.iter().filter(|c| c.epic.is_some() && !c.dead).count();
        if rand01() < EPIC_CHANCE && epics < EPIC_MAX {
            return self.new_epic(w, EPIC_LIST[rand_int(4)]);
        }
        if rand01() < 0.4 {
            return self.new_amoeba(w);
        }
        let aggressive = rand01() < 0.4;
        // hostile ones run hot (red/orange/magenta), peaceful ones cool (green/blue/violet)
        let hue = if aggressive { rand(-0.05, 0.1) } else { rand(0.28, 0.8) };
        let color = hsl((hue + 1.0) % 1.0, 0.65, 0.55);
        let (x, y) = self.random_spot(w, 900.0);
        let apex = rand01() < 0.08;
        let mass = if apex { rand(START_MASS * 5.0, START_MASS * 10.0) } else { rand(START_MASS * 0.4, START_MASS * 4.0) };
        let id = self.nid();
        let mut e = Cell::new(id, color, x, y, mass, rand(0.0, 100.0));
        e.aggressive = aggressive;
        e.wander = rand(0.0, TAU);
        e.elong = rand(0.9, 1.3);
        e.eyes = 1 + rand_int(3) as i32;
        e.flagella = 1 + rand_int(3) as i32;
        e.spike_lvl = if aggressive { rand_int(3) as i32 + i32::from(apex) } else { i32::from(rand01() < 0.15) };
        e.spikes = spike_count(e.spike_lvl);
        e.splitter = aggressive && rand01() < 0.5;
        e.split_cool = rand(4.0, 12.0);
        e.hp = max_hp(&e);
        e
    }

    // a wandering member of your species: neutral colour, wants to breed
    fn new_mate(&mut self, w: usize) -> Cell {
        let (x, y) = self.random_spot(w, 600.0);
        let id = self.nid();
        let mut m = Cell::new(id, 0xcfeaff, x, y, START_MASS * rand(0.9, 1.3), rand(0.0, 100.0));
        m.kind = Kind::Mate;
        m.wander = rand(0.0, TAU);
        m.eyes = 1;
        m.flagella = 1 + rand_int(2) as i32;
        m
    }

    // -- host actions -----------------------------------------------------------
    pub fn act(&mut self, id: u32, m: &serde_json::Value) {
        if !self.pls.contains_key(&id) {
            return;
        }
        let t = m["t"].as_str().unwrap_or("");
        match t {
            "in" => {
                if let Some(p) = self.pls.get_mut(&id) {
                    p.inp = Some((m["x"].as_f64().unwrap_or(0.0), m["y"].as_f64().unwrap_or(0.0)));
                }
            }
            "bite" => {
                if !self.pls[&id].shop_open {
                    if let Some((w, i)) = self.pcell(id) {
                        self.bite(w, i, None);
                    }
                }
            }
            "breed" => self.try_breed(id),
            "split" => self.split_cell(id),
            "poison" => self.shoot_poison(id),
            "buy" => self.buy(id, m["key"].as_str().unwrap_or(""), if m["dir"].as_i64() == Some(-1) { -1 } else { 1 }),
            "diet" => self.set_diet(id, m["key"].as_str().unwrap_or("")),
            "look" => self.set_look(id, m["what"].as_str().unwrap_or("")),
            "advance" => self.advance(id),
            "close" => {
                if let Some(p) = self.pls.get_mut(&id) {
                    p.shop_open = false;
                }
            }
            _ => {}
        }
    }

    // -- breeding + evolution shop + the next stage ---------------------------------
    fn try_breed(&mut self, pid: u32) {
        let Some((w, i)) = self.pcell(pid) else { return };
        let pl = &self.pls[&pid];
        if self.worlds[w].cells[i].dead || pl.shop_open || pl.breed_cool > 0.0 {
            return;
        }
        let Some(mid) = pl.near_mate else { return };
        let Some(mi) = self.worlds[w].alive_idx(mid) else { return };
        let (px, py) = (self.worlds[w].cells[i].x, self.worlds[w].cells[i].y);
        let (mx, my) = (self.worlds[w].cells[mi].x, self.worlds[w].cells[mi].y);
        let stage = pl.stage;
        let full = pl.pop >= POP_MAX;
        let pl = self.pls.get_mut(&pid).unwrap();
        pl.pop = (pl.pop + 1).min(POP_MAX);
        pl.breed_cool = BREED_COOLDOWN;
        pl.shop_msg = if full || pl.pop >= POP_MAX {
            if stage == Stage::Water { "Species at full strength: you can crawl onto land!".into() } else { "Species at full strength".into() }
        } else {
            "A new member joins your species!".into()
        };
        pl.shop_open = true;
        self.burst(w, (px + mx) / 2.0, (py + my) / 2.0, 0xff8fd0, 36, 240.0);
        let fresh = self.new_mate(w);
        self.worlds[w].cells[mi] = fresh;
        for (k, f) in [523.0, 659.0, 784.0].into_iter().enumerate() {
            self.fx(Fx::Sfx { p: pid, a: (f, 0.2, "triangle".into(), 0.06, 0.0), d: k as f64 * 80.0 });
        }
    }

    /// full strength in the water: leave the pond for the land and start over as an animal
    fn advance(&mut self, pid: u32) {
        let Some((w, i)) = self.pcell(pid) else { return };
        let pl = &self.pls[&pid];
        if pl.stage != Stage::Water || pl.pop < POP_MAX || pl.extinct || self.worlds[w].cells[i].dead {
            return;
        }
        let mut cell = self.worlds[w].cells.remove(i);
        let cid = cell.id;
        self.worlds[w].cells.retain(|c| c.owner != Some(cid)); // the colony stays behind
        let (ox, oy, col) = (cell.x, cell.y, cell.color);
        self.burst(w, ox, oy, 0xb7fff0, 60, 320.0);
        let spot = self.spawn_spot(1);
        let pl = self.pls.get_mut(&pid).unwrap();
        pl.stage = Stage::Land;
        pl.traits = Traits::fresh();
        pl.pop = POP_START;
        pl.breed_cool = 0.0;
        pl.split_cool = 0.0;
        pl.poison_cool = 0.0;
        pl.near_mate = None;
        pl.shop_open = true;
        pl.shop_msg = "You crawled onto land! Spend your points on a new body".into();
        cell.x = spot.0;
        cell.y = spot.1;
        cell.vx = 0.0;
        cell.vy = 0.0;
        cell.mass = base_mass(0);
        cell.bite = 0.0;
        cell.cool = 0.0;
        cell.poison = None;
        cell.shield = 3.0;
        cell.pulse = 1.0;
        apply_traits(&mut cell, &pl.traits);
        cell.hp = max_hp(&cell);
        self.worlds[1].cells.push(cell);
        self.burst(1, spot.0, spot.1, col, 60, 320.0);
        self.pending_state.push((pid, 1));
        self.toast(pid, "YOU EVOLVED\nONTO LAND!", 4.5);
        for (k, f) in [392.0, 523.0, 659.0, 784.0, 1046.0].into_iter().enumerate() {
            self.fx(Fx::Sfx { p: pid, a: (f, 0.25, "triangle".into(), 0.07, 0.0), d: k as f64 * 110.0 });
        }
        self.fx(Fx::Shake { p: pid, ms: 500.0, i: 0.015 });
    }

    fn colony_count(&self, w: usize, cid: u32) -> i32 {
        self.worlds[w].cells.iter().filter(|c| c.owner == Some(cid) && !c.dead).count() as i32
    }

    // split in half: the other half becomes a colony cell that fights for you, then rejoins
    fn split_cell(&mut self, pid: u32) {
        let Some((w, i)) = self.pcell(pid) else { return };
        let pl = &self.pls[&pid];
        if self.worlds[w].cells[i].dead || pl.shop_open || pl.split_cool > 0.0 {
            return;
        }
        let (mitosis, color) = (pl.traits.mitosis, pl.color);
        let traits = pl.traits.clone();
        let mass = self.worlds[w].cells[i].mass;
        let cid = self.worlds[w].cells[i].id;
        if mass < SPLIT_MIN_MASS {
            return self.toast(pid, "Too small to split", 1.2);
        }
        if mitosis == 0 {
            return self.toast(pid, if w == 0 { "Evolve Mitosis to split" } else { "Evolve Pack to call mates" }, 1.2);
        }
        if self.colony_count(w, cid) >= mitosis {
            return self.toast(pid, if w == 0 { "Colony is full" } else { "Pack is full" }, 1.2);
        }
        self.pls.get_mut(&pid).unwrap().split_cool = SPLIT_COOLDOWN;
        let half = {
            let p = &mut self.worlds[w].cells[i];
            p.mass /= 2.0;
            p.hp = p.hp.min(max_hp(p));
            p.pulse = 1.0;
            p.mass
        };
        let (px, py, ang, pvx, pvy) = {
            let p = &self.worlds[w].cells[i];
            (p.x, p.y, p.angle, p.vx, p.vy)
        };
        let r = radius(half);
        let (ca, sa) = (ang.cos(), ang.sin());
        let id = self.nid();
        let mut col = Cell::new(id, color, px + ca * r * 1.3, py + sa * r * 1.3, half, rand(0.0, 100.0));
        col.kind = Kind::Colony;
        col.owner = Some(cid);
        col.pside = true;
        col.life = COLONY_LIFE;
        col.angle = ang;
        col.vx = pvx + ca * 650.0;
        col.vy = pvy + sa * 650.0;
        apply_traits(&mut col, &traits);
        col.hp = max_hp(&col);
        self.worlds[w].cells.push(col);
        self.burst(w, px, py, color, 20, 220.0);
        self.sfx_to(Some(pid), 400.0, 0.2, "triangle", 0.07, -160.0);
    }

    // venom: spit a spreading poison cloud out behind you, to hold off whatever is chasing
    fn shoot_poison(&mut self, pid: u32) {
        let Some((w, i)) = self.pcell(pid) else { return };
        let pl = &self.pls[&pid];
        let lvl = pl.traits.venom;
        if self.worlds[w].cells[i].dead || pl.shop_open || pl.poison_cool > 0.0 {
            return;
        }
        if lvl == 0 {
            return self.toast(pid, if w == 0 { "Evolve Venom to shoot poison" } else { "Evolve Poison spit first" }, 1.2);
        }
        self.pls.get_mut(&pid).unwrap().poison_cool = POISON_COOL - lvl as f64;
        let p = &self.worlds[w].cells[i];
        let moving = p.vx.hypot(p.vy) > 20.0;
        // microbes leave a cloud behind them; land animals spit it ahead
        let dir = if w == 0 { (if moving { p.vy.atan2(p.vx) } else { p.angle }) + PI } else { p.angle };
        self.emit_toxins(w, i, dir, lvl);
    }

    fn emit_toxins(&mut self, w: usize, i: usize, dir: f64, lvl: i32) {
        let (px, py, r, owner) = {
            let p = &self.worlds[w].cells[i];
            (p.x, p.y, radius(p.mass), p.id)
        };
        let n = 5 + lvl * 2;
        let l = lvl as f64;
        for _ in 0..n {
            let a = dir + rand(-0.45, 0.45);
            let sp = (230.0 + 110.0 * l) * rand(0.6, 1.0);
            self.worlds[w].toxins.push(Toxin {
                x: px + dir.cos() * r, y: py + dir.sin() * r, vx: a.cos() * sp, vy: a.sin() * sp, r: 22.0 + 5.0 * l, life: 3.0 + 0.6 * l, max: 3.0 + 0.6 * l,
                dps: 6.0 + 5.0 * l, owner,
            });
        }
        self.burst(w, px, py, 0x7dff3a, 12, 160.0);
        self.sfx_cell(w, i, 180.0, 0.2, "sawtooth", 0.06, 120.0);
    }

    // a toxic mutant sprays whoever is close, straight at them
    fn npc_spray(&mut self, w: usize, i: usize, dt: f64) {
        let e = &mut self.worlds[w].cells[i];
        e.spray_cool = (e.spray_cool - dt).max(0.0);
        if e.spray_cool > 0.0 {
            return;
        }
        let (ex, ey) = (e.x, e.y);
        let mut near: Option<(f64, f64)> = None;
        let mut nd = 560.0;
        for p in self.worlds[w].cells.iter().filter(|c| c.kind == Kind::Player && !c.dead) {
            let d = dist2(p.x, p.y, ex, ey);
            if d < nd {
                nd = d;
                near = Some((p.x, p.y));
            }
        }
        let Some((nx, ny)) = near else { return };
        self.worlds[w].cells[i].spray_cool = 4.5;
        self.emit_toxins(w, i, wrap_d(ny - ey).atan2(wrap_d(nx - ex)), 3);
    }

    fn update_toxins(&mut self, w: usize, dt: f64) {
        for pl in self.pls.values_mut() {
            pl.poison_cool = (pl.poison_cool - dt).max(0.0);
        }
        let mut ts = std::mem::take(&mut self.worlds[w].toxins);
        ts.retain_mut(|t| {
            t.life -= dt;
            let Some(oi) = self.worlds[w].alive_idx(t.owner) else { return false };
            if t.life <= 0.0 {
                return false;
            }
            t.x = wrap_pos(t.x + t.vx * dt);
            t.y = wrap_pos(t.y + t.vy * dt);
            let drag = (1.0 - dt * 2.2).max(0.0);
            t.vx *= drag;
            t.vy *= drag;
            let owner = self.worlds[w].cells[oi].clone();
            let live = self.live.clone();
            for &ci in &live {
                let c = &self.worlds[w].cells[ci];
                if c.dead || c.shield > 0.0 || c.id == t.owner || owner.allied(c) || c.is_mate() {
                    continue;
                }
                if !owner.player_side() && !c.player_side() {
                    continue; // NPC clouds only hurt players
                }
                if dist2(c.x, c.y, t.x, t.y) > t.r + radius(c.mass) * 0.8 {
                    continue;
                }
                self.hurt(w, ci, t.dps * dt, Some(t.owner));
                let c = &mut self.worlds[w].cells[ci];
                if !c.dead {
                    c.poison = Some(Poison { dps: c.poison.map_or(0.0, |p| p.dps).max(t.dps * 0.35), t: 2.5, by: t.owner });
                }
            }
            true
        });
        // cells spawned this frame by hurt() don't touch the toxin list, so this swap is safe
        let added = std::mem::take(&mut self.worlds[w].toxins);
        ts.extend(added);
        self.worlds[w].toxins = ts;
    }

    // electric buzz: every second or so zaps every other cell in reach
    fn update_shock(&mut self, w: usize, dt: f64) {
        if w != 0 {
            return; // on land the same gene is a venomous bite, see envenom()
        }
        let live = self.live.clone();
        for &ai in &live {
            let a = &mut self.worlds[w].cells[ai];
            if a.dead || a.shock_lvl == 0 {
                continue;
            }
            a.zap_t -= dt;
            if a.zap_t > 0.0 {
                continue;
            }
            a.zap_t = 1.1;
            let a = self.worlds[w].cells[ai].clone();
            let reach = radius(a.mass) + 90.0 + 55.0 * a.shock_lvl as f64;
            let mut hit = false;
            for &bi in &live {
                let b = &self.worlds[w].cells[bi];
                if bi == ai || b.dead || b.shield > 0.0 || b.is_mate() || a.allied(b) {
                    continue;
                }
                if !a.player_side() && !b.player_side() {
                    continue;
                }
                if dist2(b.x, b.y, a.x, a.y) > reach + radius(b.mass) * 0.6 {
                    continue;
                }
                let (bx, by) = (b.x, b.y);
                self.hurt(w, bi, 8.0 * a.shock_lvl as f64 + 4.0, Some(a.id));
                self.burst(w, bx, by, 0xfff36b, 8, 170.0);
                hit = true;
            }
            if hit {
                self.sfx_cell(w, ai, 90.0, 0.18, "square", 0.06, 400.0);
            }
        }
    }

    // land venom: whatever a venomous animal bites keeps losing health for a few seconds
    fn envenom(&mut self, w: usize, attacker: usize, victim: usize) {
        let lvl = self.worlds[w].cells[attacker].shock_lvl;
        let by = self.worlds[w].cells[attacker].id;
        if w == 0 || lvl == 0 || self.worlds[w].cells[victim].dead {
            return;
        }
        let dps = 4.0 * lvl as f64;
        let v = &mut self.worlds[w].cells[victim];
        v.poison = Some(Poison { dps: v.poison.map_or(0.0, |p| p.dps).max(dps), t: 4.0, by });
        let (x, y) = (v.x, v.y);
        self.burst(w, x, y, 0x9be82a, 6, 90.0);
    }

    // an NPC hunter splits too: part of its mass becomes a helper that fights, then rejoins
    fn split_npc(&mut self, w: usize, i: usize) {
        let epic = self.worlds[w].cells[i].epic.is_some();
        self.worlds[w].cells[i].split_cool = if epic { rand(5.0, 9.0) } else { rand(18.0, 28.0) };
        let eid = self.worlds[w].cells[i].id;
        if self.colony_count(w, eid) >= if epic { 6 } else { 2 } {
            return;
        }
        let e = self.worlds[w].cells[i].clone();
        let (ca, sa) = (e.angle.cos(), e.angle.sin());
        let r = radius(e.mass);
        let part = e.mass * if epic { 0.15 } else { 0.4 };
        let id = self.nid();
        let mut kid = Cell::new(id, e.color, e.x + ca * r * 1.3, e.y + sa * r * 1.3, part, rand(0.0, 100.0));
        kid.kind = Kind::Colony;
        kid.owner = Some(eid);
        kid.life = COLONY_LIFE;
        kid.angle = e.angle;
        kid.vx = e.vx + ca * 650.0;
        kid.vy = e.vy + sa * 650.0;
        kid.eyes = e.eyes;
        kid.flagella = e.flagella;
        kid.elong = e.elong;
        kid.spike_lvl = e.spike_lvl;
        kid.spikes = e.spikes;
        kid.fins_lvl = e.fins_lvl;
        kid.shock_lvl = e.shock_lvl;
        kid.toxic_lvl = e.toxic_lvl;
        kid.hp = max_hp(&kid);
        self.worlds[w].cells.push(kid);
        let c = &mut self.worlds[w].cells[i];
        c.mass -= part;
        c.hp = c.hp.min(max_hp(c));
        c.pulse = 1.0;
        self.burst(w, e.x, e.y, e.color, 14, 180.0);
    }

    fn move_colony(&mut self, w: usize, i: usize, dt: f64) {
        let e = self.worlds[w].cells[i].clone();
        let Some(hi) = e.owner.and_then(|o| self.worlds[w].alive_idx(o)) else {
            self.worlds[w].cells[i].dead = true;
            return;
        };
        let home = self.worlds[w].cells[hi].clone();
        self.worlds[w].cells[i].life -= dt;
        let life = self.worlds[w].cells[i].life;
        let re = radius(e.mass);
        let npc_kid = !home.is_player();
        let mut best = if npc_kid { 900.0 } else { 650.0 };
        let mut target: Option<usize> = None;
        if life > 0.0 {
            for &j in &self.live {
                let o = &self.worlds[w].cells[j];
                if j == i || o.dead || o.shield > 0.0 || o.is_mate() || e.allied(o) {
                    continue;
                }
                if o.mass * EAT_RATIO > e.mass && e.spike_lvl == 0 {
                    continue; // too big to bother
                }
                let d = dist2(o.x, o.y, e.x, e.y);
                if d < best {
                    best = d;
                    target = Some(j);
                }
            }
        }
        let (mut dirx, mut diry, mut power);
        power = 1.0;
        if let Some(t) = target {
            let tc = &self.worlds[w].cells[t];
            dirx = wrap_d(tc.x - e.x);
            diry = wrap_d(tc.y - e.y);
            if best < re * 2.2 + 140.0 {
                self.bite(w, i, Some(t));
            }
        } else {
            dirx = wrap_d(home.x - e.x);
            diry = wrap_d(home.y - e.y);
            let d = dirx.hypot(diry);
            if npc_kid && life > 0.0 {
                // NPC helpers fan out in their own direction looking for prey, instead of crowding the parent
                let s = self.worlds[w].cells[i].spread.unwrap_or_else(|| rand(0.0, TAU)) + rand(-1.0, 1.0) * dt;
                self.worlds[w].cells[i].spread = Some(s);
                dirx = s.cos();
                diry = s.sin();
                power = 0.7;
            }
            if life <= 0.0 && d < radius(home.mass) + re {
                // time is up: rejoin the main cell
                self.worlds[w].cells[hi].add_mass(e.mass);
                self.worlds[w].cells[i].dead = true;
                self.burst(w, e.x, e.y, e.color, 14, 140.0);
                return;
            }
            if life > 0.0 && d < 260.0 && !npc_kid {
                power = 0.15;
            }
        }
        let len = dirx.hypot(diry).max(1e-9);
        let c = &mut self.worlds[w].cells[i];
        c.lookx = dirx / len;
        c.looky = diry / len;
        let (lx, ly) = (c.lookx, c.looky);
        self.steer(w, i, lx, ly, power, dt);
    }

    fn buy(&mut self, pid: u32, key: &str, dir: i32) {
        let Some((w, i)) = self.pcell(pid) else { return };
        let pl = &self.pls[&pid];
        if !pl.shop_open {
            return;
        }
        let Some(t) = TRAITS.iter().find(|t| t.key == key) else { return };
        if t.epic.is_some_and(|e| !pl.unlocks.contains(&e)) {
            return;
        }
        let to = pl.traits.get(key) + dir;
        if to < t.min || to > t.max_for(&pl.unlocks) {
            return;
        }
        let cost = t.cost(to);
        if pl.dna < cost as f64 {
            return self.sfx_to(Some(pid), 140.0, 0.12, "square", 0.04, 0.0);
        }
        let before = base_mass(pl.traits.size);
        let pl = self.pls.get_mut(&pid).unwrap();
        pl.dna -= cost as f64;
        pl.traits.set(key, to);
        let traits = pl.traits.clone();
        let c = &mut self.worlds[w].cells[i];
        if key == "size" {
            c.add_mass(base_mass(to) - before);
        }
        apply_traits(c, &traits);
        c.pulse = 1.0;
        self.sfx_to(Some(pid), 660.0, 0.15, "triangle", 0.07, 220.0);
    }

    // looks are free: cycle the colour or the eye count
    fn set_look(&mut self, pid: u32, what: &str) {
        let Some((w, i)) = self.pcell(pid) else { return };
        let pl = self.pls.get_mut(&pid).unwrap();
        if !pl.shop_open {
            return;
        }
        if what == "color" {
            let k = PLAYER_COLORS.iter().position(|&c| c == pl.color).unwrap_or(0);
            pl.color = PLAYER_COLORS[(k + 1) % PLAYER_COLORS.len()];
            let col = pl.color;
            let cid = self.worlds[w].cells[i].id;
            for c in self.worlds[w].cells.iter_mut() {
                if c.id == cid || c.owner == Some(cid) {
                    c.color = col;
                }
            }
        } else if what == "eyes" {
            let k = EYE_CHOICES.iter().position(|&e| e == pl.traits.eyes).unwrap_or(0);
            pl.traits.eyes = EYE_CHOICES[(k + 1) % EYE_CHOICES.len()];
            let traits = pl.traits.clone();
            apply_traits(&mut self.worlds[w].cells[i], &traits);
        } else {
            return;
        }
        self.worlds[w].cells[i].pulse = 1.0;
        self.sfx_to(Some(pid), 520.0, 0.1, "triangle", 0.05, 160.0);
    }

    fn set_diet(&mut self, pid: u32, key: &str) {
        let Some((w, i)) = self.pcell(pid) else { return };
        let Some(diet) = Diet::from_key(key) else { return };
        let pl = &self.pls[&pid];
        if !pl.shop_open || pl.traits.diet == diet {
            return;
        }
        if pl.dna < diet.def().cost as f64 {
            return self.sfx_to(Some(pid), 140.0, 0.12, "square", 0.04, 0.0);
        }
        let pl = self.pls.get_mut(&pid).unwrap();
        pl.dna -= diet.def().cost as f64;
        pl.traits.diet = diet;
        let traits = pl.traits.clone();
        let c = &mut self.worlds[w].cells[i];
        apply_traits(c, &traits);
        c.pulse = 1.0;
        self.sfx_to(Some(pid), 660.0, 0.15, "triangle", 0.07, 220.0);
    }

    // -- main loop --------------------------------------------------------------
    pub fn step(&mut self, dt: f64) {
        self.t += dt;
        let ids: Vec<u32> = self.pls.keys().copied().collect();
        for &pid in &ids {
            self.step_player(pid, dt);
        }
        for w in 0..2 {
            // an empty world sleeps until somebody arrives
            if !self.pls.values().any(|p| p.stage.idx() == w) {
                continue;
            }
            self.live = (0..self.worlds[w].cells.len()).filter(|&i| !self.worlds[w].cells[i].dead).collect();
            let live = self.live.clone();
            for &i in &live {
                if !self.worlds[w].cells[i].is_player() {
                    self.move_ai(w, i, dt);
                }
            }
            for &i in &live {
                self.tick_status(w, i, dt);
            }
            self.update_food(w, dt);
            self.build_grid(w);
            self.update_toxins(w, dt);
            self.update_shock(w, dt);
            self.resolve_eating(w, dt);
            let here: Vec<u32> = ids.iter().copied().filter(|p| self.pls.get(p).is_some_and(|pl| pl.stage.idx() == w)).collect();
            for pid in here {
                self.update_near_mate(pid);
            }
            for c in self.worlds[w].cells.iter_mut() {
                c.hpf = (c.hp / max_hp(c)).max(0.0);
                c.psn = c.poison.is_some_and(|p| p.t > 0.0);
            }
            self.worlds[w].cells.retain(|c| !(c.kind == Kind::Colony && c.dead));
        }
    }

    fn step_player(&mut self, pid: u32, dt: f64) {
        let Some((w, i)) = self.pcell(pid) else { return };
        let pl = self.pls.get_mut(&pid).unwrap();
        pl.breed_cool = (pl.breed_cool - dt).max(0.0);
        pl.split_cool = (pl.split_cool - dt).max(0.0);
        if self.worlds[w].cells[i].dead {
            let pl = self.pls.get_mut(&pid).unwrap();
            pl.respawn_t -= dt;
            if pl.respawn_t <= 0.0 {
                self.respawn(pid);
            }
            return;
        }
        if pl.shop_open {
            // choosing traits: floating safely, the world carries on
            let c = &mut self.worlds[w].cells[i];
            c.shield = c.shield.max(0.4);
            self.steer(w, i, 0.0, 0.0, 0.0, dt);
        } else {
            self.move_player(pid, w, i, dt);
        }
    }

    fn update_near_mate(&mut self, pid: u32) {
        let Some((w, i)) = self.pcell(pid) else { return };
        let p = &self.worlds[w].cells[i];
        let mut near = None;
        if !p.dead {
            for m in self.worlds[w].cells.iter().filter(|m| m.is_mate() && !m.dead) {
                if dist2(m.x, m.y, p.x, p.y) < radius(p.mass) + radius(m.mass) + 70.0 {
                    near = Some(m.id);
                }
            }
        }
        self.pls.get_mut(&pid).unwrap().near_mate = near;
    }

    fn tick_status(&mut self, w: usize, i: usize, dt: f64) {
        let c = &mut self.worlds[w].cells[i];
        if c.dead {
            return;
        }
        c.shield = (c.shield - dt).max(0.0);
        if let Some(p) = c.poison.filter(|p| p.t > 0.0) {
            c.poison = Some(Poison { t: p.t - dt, ..p });
            let r = radius(c.mass);
            let (x, y) = (c.x + rand(-1.0, 1.0) * r, c.y + rand(-1.0, 1.0) * r);
            if rand01() < dt * 8.0 {
                self.burst(w, x, y, 0x7dff3a, 1, 30.0);
            }
            self.hurt(w, i, p.dps * dt, Some(p.by));
        } else {
            c.hp = max_hp(c).min(c.hp + HP_REGEN * dt); // heals, but very slowly
        }
    }

    fn hurt(&mut self, w: usize, i: usize, amount: f64, by: Option<u32>) {
        let cid;
        {
            let c = &mut self.worlds[w].cells[i];
            if c.dead || c.shield > 0.0 {
                return;
            }
            c.hp -= amount * (1.0 - 0.12 * c.tough as f64);
            cid = c.id;
        }
        let by_idx = by.and_then(|b| self.worlds[w].alive_idx(b));
        {
            let c = &mut self.worlds[w].cells[i];
            if !c.is_player() && !c.is_mate() && by_idx.is_some() && by != Some(cid) {
                c.foe = by;
                c.foe_t = 6.0;
            }
            if c.hp > 0.0 {
                return;
            }
        }
        if let Some(b) = by_idx {
            let m = self.worlds[w].cells[i].mass * 0.6;
            self.grow(w, b, m, 1);
        }
        self.kill(w, i, by);
    }

    // the player (if any) that a cell works for
    fn player_of(&self, w: usize, i: usize) -> Option<u32> {
        let c = &self.worlds[w].cells[i];
        c.pid.or_else(|| if c.pside { c.owner.and_then(|o| self.worlds[w].idx(o)).and_then(|oi| self.worlds[w].cells[oi].pid) } else { None })
    }

    fn grow(&mut self, w: usize, i: usize, amount: f64, kind: u8) {
        let d = self.worlds[w].cells[i].diet.def();
        let gain = amount * if kind == 1 { d.meat } else { d.plant };
        self.worlds[w].cells[i].add_mass(gain);
        if let Some(pid) = self.player_of(w, i) {
            if let Some(p) = self.pls.get_mut(&pid) {
                p.dna += gain;
            }
        }
    }

    fn kill(&mut self, w: usize, i: usize, killer: Option<u32>) {
        if self.worlds[w].cells[i].dead {
            return;
        }
        let c = self.worlds[w].cells[i].clone();
        self.worlds[w].cells[i].dead = true;
        let chunks = (3 + (c.mass / 8.0).floor() as i32).min(14);
        for _ in 0..chunks {
            let m = (c.mass * 0.35) / chunks as f64 + 0.5;
            self.worlds[w].food.push(new_meat(c.x, c.y, m));
        }
        self.burst(w, c.x, c.y, c.color, 30, 260.0);
        let stage = self.worlds[w].stage;
        if let Some(pid) = c.pid {
            let pl = self.pls.get_mut(&pid).unwrap();
            pl.pop -= 1;
            pl.extinct = pl.pop <= 0;
            pl.respawn_t = if pl.extinct { 3.5 } else { 2.0 };
            pl.shop_open = false;
            if pl.extinct {
                self.toast(pid, "EXTINCT", 3.5);
            }
            self.fx(Fx::Shake { p: pid, ms: 350.0, i: 0.012 });
            self.sfx_to(Some(pid), 160.0, 0.5, "sawtooth", 0.08, -110.0);
        } else if c.kind == Kind::Colony {
            // removed at the end of the frame
        } else if c.kind == Kind::Mate {
            let m = self.new_mate(w);
            self.worlds[w].cells[i] = m;
        } else {
            let e = self.new_enemy(w);
            self.worlds[w].cells[i] = e;
            let slayer = killer.and_then(|k| self.worlds[w].idx(k)).and_then(|ki| self.player_of(w, ki).map(|p| (ki, p)));
            if let (Some(ep), Some((_, spid))) = (c.epic, slayer) {
                let sl = self.pls.get_mut(&spid).unwrap();
                if !sl.unlocks.contains(&ep) {
                    sl.unlocks.push(ep);
                    let msg = format!("EPIC defeated: {}\nnew trait unlocked in the shop", ep.name(stage));
                    self.toast(spid, &msg, 4.0);
                }
            }
            if let Some((ki, spid)) = slayer {
                if self.worlds[w].cells[ki].pid.is_some() {
                    self.fx(Fx::Shake { p: spid, ms: 120.0, i: 0.004 });
                    self.sfx_to(Some(spid), 300.0, 0.2, "square", 0.05, 200.0);
                }
            }
        }
    }

    fn respawn(&mut self, pid: u32) {
        let Some((w, i)) = self.pcell(pid) else { return };
        let pl = self.pls.get_mut(&pid).unwrap();
        if pl.extinct {
            // a brand new species starts from scratch (and from the water, if it went extinct there)
            pl.extinct = false;
            pl.traits = Traits::fresh();
            pl.dna = 0.0;
            pl.pop = POP_START;
            pl.species += 1;
            pl.breed_cool = 0.0;
        }
        let traits = pl.traits.clone();
        let spot = self.spawn_spot(w);
        let p = &mut self.worlds[w].cells[i];
        p.dead = false;
        p.mass = base_mass(traits.size);
        p.vx = 0.0;
        p.vy = 0.0;
        p.bite = 0.0;
        p.cool = 0.0;
        p.poison = None;
        p.shield = 3.0;
        p.x = spot.0;
        p.y = spot.1;
        apply_traits(p, &traits);
        p.hp = max_hp(p);
        p.pulse = 1.0;
    }

    fn steer(&mut self, w: usize, i: usize, dirx: f64, diry: f64, power: f64, dt: f64) {
        let c = &mut self.worlds[w].cells[i];
        let ms = max_speed(c.mass, c.speed_lvl, c.fins_lvl) * if c.is_player() { 1.0 } else { 1.08 }; // NPCs go a bit faster
        let (tx, ty) = (dirx * ms * power, diry * ms * power);
        let k = (dt * 3.2).min(1.0);
        c.vx += (tx - c.vx) * k;
        c.vy += (ty - c.vy) * k;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        let sp = c.vx.hypot(c.vy);
        c.sp = (sp / ms).min(1.0);
        if sp > 12.0 {
            let want = c.vy.atan2(c.vx);
            c.angle += wrap_angle(want - c.angle) * (dt * 7.0).min(1.0);
        }
        c.bite = (c.bite - dt).max(0.0);
        c.cool = (c.cool - dt).max(0.0);
        c.pulse = (c.pulse - dt).max(0.0);
        // no walls: the world wraps around
        c.x = wrap_pos(c.x);
        c.y = wrap_pos(c.y);
    }

    fn bite(&mut self, w: usize, i: usize, aim: Option<usize>) {
        if self.worlds[w].cells[i].dead || self.worlds[w].cells[i].cool > 0.0 {
            return;
        }
        let aim_pos = aim.map(|a| (self.worlds[w].cells[a].x, self.worlds[w].cells[a].y));
        let c = &mut self.worlds[w].cells[i];
        if let Some((ax, ay)) = aim_pos {
            c.angle = wrap_d(ay - c.y).atan2(wrap_d(ax - c.x)); // lunge straight at the target
        }
        c.bite = 0.35;
        c.cool = if c.is_player() { if c.diet == Diet::Carn { 0.5 } else { 0.7 } } else if c.kind == Kind::Colony { 0.65 } else { 0.85 };
        let lunge = if c.is_player() { 340.0 } else { 400.0 }; // NPCs hit a little harder
        c.vx += c.angle.cos() * lunge;
        c.vy += c.angle.sin() * lunge;
        self.sfx_cell(w, i, 220.0, 0.15, "triangle", 0.07, 180.0);
    }

    fn move_player(&mut self, pid: u32, w: usize, i: usize, dt: f64) {
        let inp = self.pls[&pid].inp;
        let p = &mut self.worlds[w].cells[i];
        let (tx, ty) = inp.unwrap_or((p.x, p.y));
        let dx = wrap_d(tx - p.x);
        let dy = wrap_d(ty - p.y);
        let dist = dx.hypot(dy);
        p.lookx = if dist > 0.0 { dx / dist } else { 1.0 };
        p.looky = if dist > 0.0 { dy / dist } else { 0.0 };
        let power = (dist / (radius(p.mass) * 2.2)).min(1.0);
        let (ux, uy) = if dist > 0.0 { (dx / dist, dy / dist) } else { (0.0, 0.0) };
        self.steer(w, i, ux, uy, power, dt);
    }

    fn move_ai(&mut self, w: usize, i: usize, dt: f64) {
        if self.worlds[w].cells[i].kind == Kind::Colony {
            return self.move_colony(w, i, dt);
        }
        if self.worlds[w].cells[i].amoeba {
            let c = &mut self.worlds[w].cells[i];
            c.wander += rand(-1.0, 1.0) * dt * 1.5;
            c.lookx = c.wander.cos();
            c.looky = c.wander.sin();
            let (lx, ly) = (c.lookx, c.looky);
            return self.steer(w, i, lx, ly, 0.3, dt);
        }
        let e = self.worlds[w].cells[i].clone();
        let re = radius(e.mass);
        let (mut dirx, mut diry) = (0.0, 0.0);
        let mut best = f64::INFINITY;
        let mut prey: Option<usize> = None;
        for &j in &self.live {
            let o = &self.worlds[w].cells[j];
            if j == i || o.dead || o.shield > 0.0 {
                continue;
            }
            let d = dist2(o.x, o.y, e.x, e.y);
            // small cells are hard to spot: sight grows with the target's size
            let sight = 290.0 + re + radius(o.mass) * 3.0;
            if d > best || d > sight {
                continue;
            }
            if o.mass > e.mass * EAT_RATIO && d < 380.0 {
                dirx = wrap_d(e.x - o.x);
                diry = wrap_d(e.y - o.y);
                best = 0.0;
                prey = None;
            } else if e.aggressive && best > 0.0 && ((e.mass > o.mass * EAT_RATIO && o.spike_lvl < 2) || (o.aggressive && o.mass > e.mass * 0.75)) {
                // hunt smaller cells, and brawl with rival hunters of similar size
                dirx = wrap_d(o.x - e.x);
                diry = wrap_d(o.y - e.y);
                best = d;
                prey = Some(j);
            }
        }
        if let Some(fid) = e.foe {
            if e.foe_t > 0.0 && best != 0.0 {
                if let Some(fi) = self.worlds[w].alive_idx(fid) {
                    let (fx, fy, fm) = {
                        let f = &self.worlds[w].cells[fi];
                        (f.x, f.y, f.mass)
                    };
                    if fm < e.mass * 1.6 {
                        // fight back against whoever hurt us
                        self.worlds[w].cells[i].foe_t -= dt;
                        dirx = wrap_d(fx - e.x);
                        diry = wrap_d(fy - e.y);
                        prey = Some(fi);
                        best = dirx.hypot(diry);
                    }
                }
            }
        }
        if e.epic == Some(Epic::Venom) {
            self.npc_spray(w, i, dt);
        }
        {
            let c = &mut self.worlds[w].cells[i];
            c.split_cool = (c.split_cool - dt).max(0.0);
        }
        let sc = self.worlds[w].cells[i].split_cool;
        if e.splitter && prey.is_some() && sc <= 0.0 && best < 450.0 && e.mass >= SPLIT_MIN_MASS && rand01() < dt {
            self.split_npc(w, i);
        }
        if let Some(p) = prey {
            if best < re * 2.2 + 140.0 {
                self.bite(w, i, Some(p)); // lunge from a little way off
            }
        }
        let mut power = 0.8;
        if dirx == 0.0 && diry == 0.0 && e.is_mate() {
            // mates drift toward a player who is ready to breed, then hold still
            let mut near: Option<(f64, f64, f64)> = None;
            let mut nd = 900.0;
            for pc in self.worlds[w].cells.iter().filter(|c| c.is_player() && !c.dead) {
                let Some(pl) = pc.pid.and_then(|p| self.pls.get(&p)) else { continue };
                if pl.breed_cool > 0.0 || pl.shop_open {
                    continue;
                }
                let d = dist2(pc.x, pc.y, e.x, e.y);
                if d < nd {
                    nd = d;
                    near = Some((pc.x, pc.y, pc.mass));
                }
            }
            if let Some((nx, ny, nm)) = near {
                dirx = wrap_d(nx - e.x);
                diry = wrap_d(ny - e.y);
                if nd < radius(nm) + re + 30.0 {
                    power = 0.0;
                }
            }
        }
        if dirx == 0.0 && diry == 0.0 {
            let mut nearest: Option<(f64, f64)> = None;
            let mut nd = 340.0;
            for fi in self.food_near(w, e.x, e.y, nd) {
                let f = &self.worlds[w].food[fi];
                let d = dist2(f.x, f.y, e.x, e.y);
                if d < nd {
                    nd = d;
                    nearest = Some((f.x, f.y));
                }
            }
            if let Some((fx, fy)) = nearest {
                dirx = wrap_d(fx - e.x);
                diry = wrap_d(fy - e.y);
            } else {
                let c = &mut self.worlds[w].cells[i];
                c.wander += rand(-1.0, 1.0) * dt * 2.0;
                dirx = c.wander.cos();
                diry = c.wander.sin();
            }
        }
        let len = dirx.hypot(diry).max(1e-9);
        let c = &mut self.worlds[w].cells[i];
        c.lookx = dirx / len;
        c.looky = diry / len;
        let (lx, ly) = (c.lookx, c.looky);
        self.steer(w, i, lx, ly, power, dt);
    }

    // -- food ---------------------------------------------------------------------
    fn update_food(&mut self, w: usize, dt: f64) {
        let food = &mut self.worlds[w].food;
        for f in food.iter_mut() {
            f.bob += dt * 2.0;
            if f.kind == 1 {
                f.x = wrap_pos(f.x + f.vx * dt);
                f.y = wrap_pos(f.y + f.vy * dt);
                f.vx *= 1.0 - (dt * 2.5).min(1.0);
                f.vy *= 1.0 - (dt * 2.5).min(1.0);
                f.ttl -= dt;
            }
        }
    }

    // food bucketed into a coarse grid each frame, so eating/AI only look at what is nearby
    fn build_grid(&mut self, w: usize) {
        let wd = &mut self.worlds[w];
        wd.food.retain(|f| !(f.kind == 1 && (f.ttl <= 0.0 || f.eaten)));
        wd.grid.clear();
        for (i, f) in wd.food.iter().enumerate() {
            let k = ((f.x / FOOD_CELL).floor() as i32 % GRID_N) * 1024 + ((f.y / FOOD_CELL).floor() as i32 % GRID_N);
            wd.grid.entry(k).or_default().push(i);
        }
    }

    fn food_near(&self, w: usize, x: f64, y: f64, r: f64) -> Vec<usize> {
        let mut out = Vec::new();
        let wd = &self.worlds[w];
        let (x0, x1) = (((x - r) / FOOD_CELL).floor() as i32, ((x + r) / FOOD_CELL).floor() as i32);
        let (y0, y1) = (((y - r) / FOOD_CELL).floor() as i32, ((y + r) / FOOD_CELL).floor() as i32);
        for gx in x0..=x1 {
            for gy in y0..=y1 {
                if let Some(b) = wd.grid.get(&(gx.rem_euclid(GRID_N) * 1024 + gy.rem_euclid(GRID_N))) {
                    out.extend(b.iter().copied().filter(|&i| i < wd.food.len() && !wd.food[i].eaten));
                }
            }
        }
        out
    }

    fn resolve_eating(&mut self, w: usize, dt: f64) {
        let live: Vec<usize> = self.live.iter().copied().filter(|&i| !self.worlds[w].cells[i].dead).collect();
        for &ci in &live {
            let c = self.worlds[w].cells[ci].clone();
            if c.shield > 0.0 {
                continue;
            }
            let m = c.mouth();
            let r = radius(c.mass);
            let pull = r * 1.5 + 50.0;
            let diet = c.diet.def();
            for fi in self.food_near(w, m.0, m.1, pull) {
                let f = self.worlds[w].food[fi].clone();
                if f.eaten || (if f.kind == 1 { diet.meat } else { diet.plant }) == 0.0 {
                    continue; // can't digest this kind
                }
                let d = dist2(f.x, f.y, m.0, m.1);
                if d > pull {
                    continue;
                }
                // slurp: food is drawn toward the mouth
                let k = (1.0 - d / pull) * 380.0;
                let dd = if d == 0.0 { 1.0 } else { d };
                {
                    let fm = &mut self.worlds[w].food[fi];
                    fm.x = wrap_pos(fm.x + (wrap_d(m.0 - fm.x) / dd) * k * 0.016);
                    fm.y = wrap_pos(fm.y + (wrap_d(m.1 - fm.y) / dd) * k * 0.016);
                }
                if d < r * 0.5 + 8.0 {
                    self.grow(w, ci, f.mass, f.kind);
                    self.burst(w, f.x, f.y, if f.kind == 1 { 0xff6b7a } else { 0x7dff8a }, 5, 60.0);
                    self.sfx_cell(w, ci, 520.0 + rand01() * 160.0, 0.09, "sine", 0.05, 220.0);
                    if f.kind == 0 {
                        let np = new_plant();
                        self.worlds[w].plant_diff.push((fi, np.x.round(), np.y.round(), (np.size * 10.0).round() / 10.0));
                        self.worlds[w].food[fi] = np;
                    } else {
                        self.worlds[w].food[fi].eaten = true;
                    }
                }
            }
        }
        for &ai in &live {
            let a = self.worlds[w].cells[ai].clone();
            if a.dead || a.shield > 0.0 {
                continue;
            }
            let am = a.mouth();
            let ra = radius(a.mass);
            for &bi in &live {
                let (a, b) = (self.worlds[w].cells[ai].clone(), self.worlds[w].cells[bi].clone());
                if ai == bi || a.dead || b.dead || b.shield > 0.0 {
                    continue;
                }
                if (a.is_player() && b.is_mate()) || (a.is_mate() && b.is_player()) || a.allied(&b) {
                    continue; // family
                }
                let d = dist2(a.x, a.y, b.x, b.y);
                let rb = radius(b.mass);
                // spikes hurt whatever rubs against them
                if a.spike_lvl > 0 && d < ra + rb * 0.9 {
                    self.hurt(w, bi, 14.0 * a.spike_lvl as f64 * dt, Some(a.id));
                }
                // toxic skin: touching it is fatal
                if a.toxic_lvl > 0 && !b.is_mate() && d < ra + rb * 0.9 && (a.player_side() || b.player_side()) {
                    self.hurt(w, bi, 99999.0, Some(a.id));
                }
                if self.worlds[w].cells[bi].dead {
                    continue;
                }
                let mouth_hit = dist2(am.0, am.1, b.x, b.y) < rb * 0.8;
                if a.mass >= b.mass * EAT_RATIO {
                    let engulf = d < ra - rb * 0.4;
                    if a.bite > 0.0 && mouth_hit && self.t - a.last_hit > 0.45 {
                        // a bite hurts; the victim only dies (and gets eaten) when its health runs out
                        self.worlds[w].cells[ai].last_hit = self.t;
                        self.hurt(w, bi, 30.0 + a.mass * 0.8, Some(a.id));
                        self.burst(w, b.x, b.y, 0xff6b7a, 8, 110.0);
                        self.envenom(w, ai, bi);
                        if b.spike_lvl > 0 {
                            self.hurt(w, ai, b.spike_lvl as f64 * 24.0, Some(b.id)); // biting spikes hurts
                        }
                    } else if engulf {
                        self.hurt(w, bi, (50.0 + a.mass) * dt, Some(a.id)); // swallowed whole: digested quickly
                    }
                } else if a.bite > 0.0 && mouth_hit && self.t - a.last_poison > 0.5 {
                    // too big to swallow: the bite just hurts
                    self.worlds[w].cells[ai].last_poison = self.t;
                    self.hurt(w, bi, 14.0 + a.mass * 0.25, Some(a.id));
                    self.burst(w, b.x, b.y, 0xff6b7a, 12, 120.0);
                    self.envenom(w, ai, bi);
                    self.sfx_cell(w, ai, 330.0, 0.2, "sawtooth", 0.05, -120.0);
                }
            }
        }
    }

    // -- snapshots ----------------------------------------------------------------
    pub fn rec(&self, pid: u32) -> Option<Rec> {
        let pl = self.pls.get(&pid)?;
        let w = pl.stage.idx();
        let c = &self.worlds[w].cells[self.worlds[w].idx(pl.cell_id)?];
        Some(Rec {
            id: pid, n: pl.name.clone(), col: pl.color, dna: pl.dna.floor() as i64, pop: pl.pop, species: pl.species, cb: pl.breed_cool.ceil() as i32,
            sc: pl.split_cool.ceil() as i32, pc: pl.poison_cool.ceil() as i32, ul: pl.unlocks.clone(), cs: self.colony_count(w, c.id),
            nm: !c.dead && pl.near_mate.is_some(), dead: c.dead, ext: pl.extinct, shop: pl.shop_open, msg: pl.shop_msg.clone(), tr: pl.traits.clone(),
            mass: c.mass.round() as i64, st: pl.stage, x: c.x, y: c.y,
        })
    }

    pub fn plants_msg(&self, to: u32, w: usize) -> serde_json::Value {
        let plants: Vec<[f64; 3]> = self.worlds[w].food[..PLANT_COUNT].iter().map(|f| [f.x.round(), f.y.round(), (f.size * 10.0).round() / 10.0]).collect();
        serde_json::json!({ "t": "state", "to": to, "w": w, "plants": plants })
    }

    /// one snapshot per remote player, culled to what is near them
    pub fn snapshots(&mut self, my_id: u32) -> Vec<Snap> {
        let recs: Vec<Rec> = self.pls.keys().filter_map(|&p| self.rec(p)).collect();
        let r2d = RENDER_DISTANCE * RENDER_DISTANCE;
        let mut out = Vec::new();
        for pl in self.pls.values().filter(|p| p.id != my_id) {
            let w = pl.stage.idx();
            let wd = &self.worlds[w];
            let Some(me) = wd.idx(pl.cell_id).map(|i| &wd.cells[i]) else { continue };
            let (x, y) = (me.x, me.y);
            let near = |ax: f64, ay: f64| wrap_d(ax - x).powi(2) + wrap_d(ay - y).powi(2) <= r2d;
            let c = wd.cells.iter().filter(|c| !c.dead && near(c.x, c.y)).map(|c| c.pack(c.pid.unwrap_or(c.id))).collect();
            let m = wd.food[PLANT_COUNT.min(wd.food.len())..].iter().filter(|f| near(f.x, f.y)).map(|f| (f.x.round(), f.y.round(), (f.size * 10.0).round() / 10.0)).collect();
            let tx = wd.toxins.iter().filter(|t| near(t.x, t.y)).map(|t| (t.x.round(), t.y.round(), t.r.round(), (t.life / t.max * 100.0).round())).collect();
            let ev = self
                .evq
                .iter()
                .filter(|e| match e {
                    Fx::Burst { w: bw, .. } => *bw as usize == w,
                    Fx::Sfx { p, .. } | Fx::Shake { p, .. } | Fx::Toast { p, .. } => *p == pl.id,
                })
                .cloned()
                .collect();
            out.push(Snap { t: "snap".into(), to: pl.id, w: w as u8, c, pe: wd.plant_diff.clone(), m, tx, pl: recs.clone(), ev });
        }
        self.evq.clear();
        for wd in self.worlds.iter_mut() {
            wd.plant_diff.clear();
        }
        out
    }
}

pub fn apply_traits(p: &mut Cell, t: &Traits) {
    let frac = p.hp / max_hp(p);
    let frac = if frac.is_finite() { frac } else { 1.0 };
    p.speed_lvl = t.speed;
    p.spike_lvl = t.spikes;
    p.venom_lvl = t.venom;
    p.fins_lvl = t.fins;
    p.shock_lvl = t.shock;
    p.toxic_lvl = t.toxic;
    p.tough = t.tough;
    p.diet = t.diet;
    p.eyes = if t.eyes > 0 { t.eyes } else { (1 + (t.size as f64 / 2.0).floor() as i32).clamp(1, 3) };
    p.flagella = (1 + t.speed).min(4);
    p.spikes = spike_count(t.spikes);
    p.elong = 1.0 + 0.07 * t.speed as f64 + 0.02 * t.size.max(0) as f64;
    p.hp = frac * max_hp(p);
}
