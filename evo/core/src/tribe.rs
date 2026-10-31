//! The tribal stage: what a land species becomes once it is strong enough. Your animal's genes
//! carry over as tribe bonuses, and tribes share one persistent world where they gather, build,
//! age up and fight, in the spirit of Spore's tribal stage and Age of Empires. This is a pure
//! simulation: the tribe server owns one `Tribes`, the browser only sends commands and draws.
use crate::model::{Diet, Epic, Traits};
use crate::util::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};

pub const MAP: f64 = 6400.0;
const UNIT_VISION: f64 = 380.0;
const BUILD_VISION: f64 = 520.0;
const CARRY: f64 = 10.0;
pub const MAX_POP: usize = 90;
pub const MAX_QUEUE: usize = 5;
const BUILD_RANGE: f64 = 900.0;

/// everything a land species hands over when it evolves into a tribe
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TribeCarry {
    pub name: String,
    pub color: u32,
    pub dna: f64,
    pub traits: Traits,
    pub unlocks: Vec<Epic>,
    pub friends: i32,
    pub species: i32,
}

/// the bonuses a tribe gets from its animal genes
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Mods {
    pub speed: f64,
    pub unit_hp: f64,
    pub building_hp: f64,
    pub melee: f64,
    pub siege: f64,
    pub ranged: f64,
    pub poison: f64,
    pub thorns: f64,
    pub farm: f64,
    pub hunt: f64,
    pub gather: f64,
    pub train: f64,
    pub extra_villagers: i32,
    pub beasts: i32,
    pub start_bonus: f64,
}

impl Default for Mods {
    fn default() -> Mods {
        Mods { speed: 1.0, unit_hp: 1.0, building_hp: 1.0, melee: 1.0, siege: 1.0, ranged: 1.0, poison: 0.0, thorns: 0.0, farm: 1.0, hunt: 1.0, gather: 1.0, train: 1.0, extra_villagers: 0, beasts: 0, start_bonus: 0.0 }
    }
}

impl Mods {
    /// legs make the tribe fast, claws and tails hit hard, spit makes archers deadly, venom
    /// poisons, thick hide toughens everything, pack animals and friends join the first camp,
    /// charm speeds training, and what the animal ate decides what the tribe is good at
    pub fn from_carry(c: &TribeCarry) -> Mods {
        let t = &c.traits;
        let l = |v: i32| v as f64;
        let (farm, hunt, melee_d) = match t.diet {
            Diet::Herb => (1.4, 0.9, 1.0),
            Diet::Carn => (0.8, 1.4, 1.1),
            Diet::Omni => (1.15, 1.15, 1.0),
        };
        let has = |e: Epic| c.unlocks.contains(&e);
        Mods {
            speed: 1.0 + 0.06 * l(t.speed) + 0.05 * l(t.pounce),
            unit_hp: 1.0 + 0.12 * l(t.tough) + 0.05 * l(t.size.max(0)),
            building_hp: 1.0 + 0.15 * l(t.tough),
            melee: (1.0 + 0.12 * l(t.claws)) * melee_d,
            siege: 1.0 + 0.25 * l(t.tail),
            ranged: 1.0 + 0.15 * l(t.venom),
            poison: 3.0 * l(t.shock),
            thorns: 0.1 * l(t.spikes) + if has(Epic::Thornback) { 0.15 * l(t.thorns) } else { 0.0 },
            farm,
            hunt,
            gather: 1.0 + 0.1 * l(t.alpha),
            train: (1.0 - 0.08 * l(t.charm)).max(0.6),
            extra_villagers: t.mitosis.min(4),
            beasts: c.friends.clamp(0, 5),
            start_bonus: (c.dna * 0.05).min(600.0),
        }
    }
}

// ---- kinds ---------------------------------------------------------------------
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
pub enum UK {
    Villager,
    Warrior,
    Archer,
    Beast,
    Deer,
}
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
pub enum BK {
    Center,
    Hut,
    Farm,
    Barracks,
    Tower,
}
#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
pub enum RK {
    Tree,
    Bush,
    Stone,
    Meat,
}

pub struct US {
    pub hp: f64,
    pub speed: f64,
    pub dmg: f64,
    pub range: f64,
    pub cd: f64,
    pub cost: [f64; 3],
    pub time: f64,
}
impl UK {
    pub fn code(self) -> f64 {
        self as u8 as f64
    }
    pub fn from_code(c: f64) -> UK {
        [UK::Villager, UK::Warrior, UK::Archer, UK::Beast, UK::Deer][(c as usize).min(4)]
    }
    pub fn stats(self) -> US {
        match self {
            UK::Villager => US { hp: 40.0, speed: 95.0, dmg: 3.0, range: 22.0, cd: 1.0, cost: [25.0, 0.0, 0.0], time: 6.0 },
            UK::Warrior => US { hp: 90.0, speed: 105.0, dmg: 11.0, range: 26.0, cd: 0.9, cost: [30.0, 15.0, 0.0], time: 9.0 },
            UK::Archer => US { hp: 55.0, speed: 100.0, dmg: 8.0, range: 230.0, cd: 1.2, cost: [25.0, 30.0, 0.0], time: 9.0 },
            UK::Beast => US { hp: 120.0, speed: 130.0, dmg: 14.0, range: 28.0, cd: 0.8, cost: [0.0; 3], time: 1.0 },
            UK::Deer => US { hp: 25.0, speed: 70.0, dmg: 0.0, range: 0.0, cd: 1.0, cost: [0.0; 3], time: 1.0 },
        }
    }
    fn fights(self) -> bool {
        matches!(self, UK::Warrior | UK::Archer | UK::Beast)
    }
    pub fn from_name(s: &str) -> Option<UK> {
        match s {
            "villager" => Some(UK::Villager),
            "warrior" => Some(UK::Warrior),
            "archer" => Some(UK::Archer),
            _ => None,
        }
    }
    /// the age needed to train this unit
    pub fn age(self) -> u8 {
        if self == UK::Archer { 2 } else { 1 }
    }
}
pub struct BS {
    pub hp: f64,
    pub r: f64,
    pub cost: [f64; 3],
    pub time: f64,
    pub age: u8,
}
impl BK {
    pub fn code(self) -> f64 {
        self as u8 as f64
    }
    pub fn from_code(c: f64) -> BK {
        [BK::Center, BK::Hut, BK::Farm, BK::Barracks, BK::Tower][(c as usize).min(4)]
    }
    pub fn stats(self) -> BS {
        match self {
            BK::Center => BS { hp: 900.0, r: 56.0, cost: [0.0; 3], time: 1.0, age: 1 },
            BK::Hut => BS { hp: 200.0, r: 28.0, cost: [0.0, 30.0, 0.0], time: 20.0, age: 1 },
            BK::Farm => BS { hp: 120.0, r: 34.0, cost: [0.0, 40.0, 0.0], time: 18.0, age: 1 },
            BK::Barracks => BS { hp: 420.0, r: 40.0, cost: [0.0, 80.0, 20.0], time: 35.0, age: 1 },
            BK::Tower => BS { hp: 360.0, r: 26.0, cost: [0.0, 50.0, 50.0], time: 30.0, age: 2 },
        }
    }
    pub fn from_name(s: &str) -> Option<BK> {
        match s {
            "hut" => Some(BK::Hut),
            "farm" => Some(BK::Farm),
            "barracks" => Some(BK::Barracks),
            "tower" => Some(BK::Tower),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Task {
    Idle,
    Move(f64, f64),
    Attack(u32),
    Gather(u32),
    Deposit(u32),
    Build(u32),
}

#[derive(Clone, Debug)]
pub struct Unit {
    pub id: u32,
    pub owner: u32,
    pub kind: UK,
    pub x: f64,
    pub y: f64,
    pub hp: f64,
    pub max: f64,
    pub task: Task,
    pub cd: f64,
    pub res: usize,
    pub carry: f64,
    pub ang: f64,
    pub poison: f64,
    pub poison_t: f64,
    pub moving: bool,
    pub flee_t: f64,
    pub hurt_t: f64,
    pub act: u8,
    pub dead: bool,
}
#[derive(Clone, Debug)]
pub struct Building {
    pub id: u32,
    pub owner: u32,
    pub kind: BK,
    pub x: f64,
    pub y: f64,
    pub hp: f64,
    pub max: f64,
    pub built: f64,
    pub queue: Vec<(UK, f64)>,
    pub rally: Option<(f64, f64)>,
    pub cd: f64,
    pub hurt_t: f64,
    pub dead: bool,
}
#[derive(Clone, Debug)]
pub struct Node {
    pub id: u32,
    pub kind: RK,
    pub x: f64,
    pub y: f64,
    pub amount: f64,
}

pub struct Tribe {
    pub id: u32,
    pub name: String,
    pub color: u32,
    pub res: [f64; 3],
    pub age: u8,
    pub carry: TribeCarry,
    pub mods: Mods,
    pub score: f64,
    pub alive: bool,
    pub spawn: (f64, f64),
}

/// age-up costs: (food, wood, stone)
pub fn age_cost(to: u8) -> [f64; 3] {
    if to == 2 { [200.0, 100.0, 0.0] } else { [400.0, 300.0, 200.0] }
}

pub struct Tribes {
    pub units: Vec<Unit>,
    pub buildings: Vec<Building>,
    pub nodes: Vec<Node>,
    pub tribes: BTreeMap<u32, Tribe>,
    pub t: f64,
    next_id: u32,
    uidx: HashMap<u32, usize>,
    bidx: HashMap<u32, usize>,
    nidx: HashMap<u32, usize>,
    regrow_t: f64,
}

// ---- snapshot ------------------------------------------------------------------
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TMe {
    pub id: u32,
    pub name: String,
    pub color: u32,
    pub res: [f64; 3],
    pub pop: u32,
    pub cap: u32,
    pub age: u8,
    pub score: i64,
    pub alive: bool,
    pub cx: f64,
    pub cy: f64,
    pub next_age: [f64; 3],
}
#[derive(Serialize, Deserialize)]
pub struct TSnap {
    pub t: String,
    pub to: u32,
    pub me: TMe,
    /// [id, owner, kind, x, y, hp%, flags, angle] ; flags: 1 moving, 2 fighting, 4 gathering, 8 building, 16 hurt
    pub units: Vec<[f64; 8]>,
    /// [id, owner, kind, x, y, hp%, built%, queue length, queue progress%]
    pub buildings: Vec<[f64; 9]>,
    /// [id, kind, x, y, amount], only every few snapshots
    pub nodes: Option<Vec<[f64; 5]>>,
    pub board: Vec<(String, i64, u32)>,
    pub tribes: Vec<(u32, String, u32)>,
    pub online: u32,
}

/// the world wraps around, like the cell and animal worlds: the shortest signed distance on one axis
pub fn wd(d: f64) -> f64 {
    d - MAP * (d / MAP).round()
}
/// bring a coordinate back onto the map
pub fn wrap(v: f64) -> f64 {
    ((v % MAP) + MAP) % MAP
}
/// distance across the seam when that is shorter
fn dist(ax: f64, ay: f64, bx: f64, by: f64) -> f64 {
    wd(ax - bx).hypot(wd(ay - by))
}

impl Tribes {
    pub fn new() -> Tribes {
        let mut w = Tribes { units: Vec::new(), buildings: Vec::new(), nodes: Vec::new(), tribes: BTreeMap::new(), t: 0.0, next_id: 1, uidx: HashMap::new(), bidx: HashMap::new(), nidx: HashMap::new(), regrow_t: 0.0 };
        w.generate();
        w.reindex();
        w
    }

    fn nid(&mut self) -> u32 {
        self.next_id += 1;
        self.next_id
    }

    fn generate(&mut self) {
        for _ in 0..46 {
            let (cx, cy) = (rand(200.0, MAP - 200.0), rand(200.0, MAP - 200.0));
            for _ in 0..12 {
                self.add_node(RK::Tree, cx + rand(-230.0, 230.0), cy + rand(-230.0, 230.0));
            }
        }
        for _ in 0..50 {
            let (cx, cy) = (rand(200.0, MAP - 200.0), rand(200.0, MAP - 200.0));
            for _ in 0..5 {
                self.add_node(RK::Bush, cx + rand(-70.0, 70.0), cy + rand(-70.0, 70.0));
            }
        }
        for _ in 0..30 {
            let (cx, cy) = (rand(200.0, MAP - 200.0), rand(200.0, MAP - 200.0));
            for _ in 0..5 {
                self.add_node(RK::Stone, cx + rand(-60.0, 60.0), cy + rand(-60.0, 60.0));
            }
        }
        for _ in 0..26 {
            let (cx, cy) = (rand(200.0, MAP - 200.0), rand(200.0, MAP - 200.0));
            for _ in 0..4 {
                self.add_deer(cx + rand(-90.0, 90.0), cy + rand(-90.0, 90.0));
            }
        }
    }

    fn add_node(&mut self, kind: RK, x: f64, y: f64) -> u32 {
        let id = self.nid();
        let amount = match kind {
            RK::Tree => 100.0,
            RK::Bush => 120.0,
            RK::Stone => 200.0,
            RK::Meat => 100.0,
        };
        self.nodes.push(Node { id, kind, x: wrap(x), y: wrap(y), amount });
        id
    }

    fn add_deer(&mut self, x: f64, y: f64) {
        let id = self.nid();
        let s = UK::Deer.stats();
        self.units.push(Unit { id, owner: 0, kind: UK::Deer, x: wrap(x), y: wrap(y), hp: s.hp, max: s.hp, task: Task::Idle, cd: 0.0, res: 0, carry: 0.0, ang: rand(0.0, TAU), poison: 0.0, poison_t: 0.0, moving: false, flee_t: 0.0, hurt_t: 0.0, act: 0, dead: false });
    }

    fn spawn_unit(&mut self, owner: u32, kind: UK, x: f64, y: f64) -> u32 {
        let id = self.nid();
        let s = kind.stats();
        let (hp_mult, _) = self.mult(owner);
        let max = s.hp * hp_mult;
        self.units.push(Unit { id, owner, kind, x: wrap(x), y: wrap(y), hp: max, max, task: Task::Idle, cd: 0.0, res: 0, carry: 0.0, ang: rand(0.0, TAU), poison: 0.0, poison_t: 0.0, moving: false, flee_t: 0.0, hurt_t: 0.0, act: 0, dead: false });
        self.uidx.insert(id, self.units.len() - 1);
        id
    }

    fn reindex(&mut self) {
        self.uidx = self.units.iter().enumerate().map(|(i, u)| (u.id, i)).collect();
        self.bidx = self.buildings.iter().enumerate().map(|(i, b)| (b.id, i)).collect();
        self.nidx = self.nodes.iter().enumerate().map(|(i, n)| (n.id, i)).collect();
    }

    /// (unit hp multiplier, age multiplier) for an owner
    fn mult(&self, owner: u32) -> (f64, f64) {
        match self.tribes.get(&owner) {
            Some(t) => (t.mods.unit_hp * (1.0 + 0.08 * (t.age as f64 - 1.0)), 1.0 + 0.08 * (t.age as f64 - 1.0)),
            None => (1.0, 1.0),
        }
    }
    fn mods(&self, owner: u32) -> Mods {
        self.tribes.get(&owner).map_or_else(Mods::default, |t| t.mods.clone())
    }

    // -- tribes -----------------------------------------------------------------
    pub fn add_tribe(&mut self, id: u32, carry: TribeCarry) {
        let mods = Mods::from_carry(&carry);
        let spawn = self.find_spawn();
        self.tribes.insert(id, Tribe { id, name: carry.name.chars().take(16).collect(), color: carry.color, res: [0.0; 3], age: 1, carry, mods, score: 0.0, alive: true, spawn });
        self.found(id);
    }

    /// (re)start a tribe's camp: a great hut, its first villagers and the animal friends it brought
    fn found(&mut self, id: u32) {
        let spawn = self.find_spawn();
        self.nodes.retain(|n| dist(n.x, n.y, spawn.0, spawn.1) > 150.0);
        let Some(t) = self.tribes.get_mut(&id) else { return };
        t.alive = true;
        t.age = 1;
        t.spawn = spawn;
        let bonus = t.mods.start_bonus;
        t.res = [200.0 + bonus, 200.0 + bonus, 100.0 + bonus];
        let (villagers, beasts) = (3 + t.mods.extra_villagers, t.mods.beasts);
        let bid = self.nid();
        let max = BK::Center.stats().hp * self.mods(id).building_hp;
        self.buildings.push(Building { id: bid, owner: id, kind: BK::Center, x: spawn.0, y: spawn.1, hp: max, max, built: 1.0, queue: Vec::new(), rally: None, cd: 0.0, hurt_t: 0.0, dead: false });
        self.reindex();
        for k in 0..villagers {
            let a = k as f64 * TAU / villagers as f64;
            self.spawn_unit(id, UK::Villager, spawn.0 + a.cos() * 90.0, spawn.1 + a.sin() * 90.0);
        }
        for k in 0..beasts {
            let a = k as f64 * TAU / beasts.max(1) as f64 + 0.5;
            self.spawn_unit(id, UK::Beast, spawn.0 + a.cos() * 130.0, spawn.1 + a.sin() * 130.0);
        }
        self.reindex();
    }

    fn find_spawn(&self) -> (f64, f64) {
        for _ in 0..200 {
            let p = (rand(0.0, MAP), rand(0.0, MAP));
            if !self.buildings.iter().any(|b| b.kind == BK::Center && dist(b.x, b.y, p.0, p.1) < 1500.0) {
                return p;
            }
        }
        (rand(0.0, MAP), rand(0.0, MAP))
    }

    pub fn remove_tribe(&mut self, id: u32) {
        self.tribes.remove(&id);
        self.units.retain(|u| u.owner != id);
        self.buildings.retain(|b| b.owner != id);
        self.reindex();
    }

    /// a fallen tribe starts again with the same genes
    pub fn respawn(&mut self, id: u32) {
        if self.tribes.get(&id).is_some_and(|t| !t.alive) {
            self.units.retain(|u| u.owner != id);
            self.buildings.retain(|b| b.owner != id);
            if let Some(t) = self.tribes.get_mut(&id) {
                t.score = (t.score * 0.5).floor();
            }
            self.found(id);
        }
    }

    pub fn pop(&self, owner: u32) -> usize {
        self.units.iter().filter(|u| u.owner == owner && !u.dead).count()
            + self.buildings.iter().filter(|b| b.owner == owner).map(|b| b.queue.len()).sum::<usize>()
    }
    pub fn cap(&self, owner: u32) -> usize {
        // room for the people the tribe arrived with, a few more, and then huts
        let start = self.tribes.get(&owner).map_or(0, |t| (t.mods.extra_villagers + t.mods.beasts) as usize);
        (8 + start + 5 * self.buildings.iter().filter(|b| b.owner == owner && b.kind == BK::Hut && b.built >= 1.0 && !b.dead).count()).min(MAX_POP)
    }

    // -- commands ---------------------------------------------------------------
    fn owned(&self, owner: u32, ids: &Value) -> Vec<usize> {
        ids.as_array().map(|a| a.iter().filter_map(|v| v.as_u64()).filter_map(|id| self.uidx.get(&(id as u32)).copied()).filter(|&i| self.units[i].owner == owner && !self.units[i].dead).take(80).collect()).unwrap_or_default()
    }

    pub fn command(&mut self, owner: u32, m: &Value) {
        if !self.tribes.get(&owner).is_some_and(|t| t.alive) {
            return;
        }
        match m["t"].as_str().unwrap_or("") {
            "move" => {
                let (x, y) = (m["x"].as_f64().unwrap_or(0.0), m["y"].as_f64().unwrap_or(0.0));
                let ids = self.owned(owner, &m["ids"]);
                let many = ids.len() > 1;
                for (k, i) in ids.into_iter().enumerate() {
                    // a group fans out around the spot instead of piling up on it
                    let (a, r) = (k as f64 * 2.4, if many { 20.0 * (k as f64).sqrt() } else { 0.0 });
                    self.units[i].task = Task::Move(wrap(x + a.cos() * r), wrap(y + a.sin() * r));
                }
            }
            "stop" => {
                for i in self.owned(owner, &m["ids"]) {
                    self.units[i].task = Task::Idle;
                }
            }
            "attack" => {
                let Some(target) = m["target"].as_u64().map(|t| t as u32) else { return };
                if !self.uidx.contains_key(&target) && !self.bidx.contains_key(&target) {
                    return;
                }
                for i in self.owned(owner, &m["ids"]) {
                    self.units[i].task = Task::Attack(target);
                }
            }
            "gather" => {
                let Some(target) = m["target"].as_u64().map(|t| t as u32) else { return };
                for i in self.owned(owner, &m["ids"]) {
                    if self.units[i].kind != UK::Villager {
                        continue;
                    }
                    if let Some(&ui) = self.uidx.get(&target) {
                        if self.units[ui].kind == UK::Deer {
                            self.units[i].task = Task::Attack(target); // hunting
                        }
                    } else if self.nidx.contains_key(&target) || self.bidx.get(&target).is_some_and(|&b| self.buildings[b].kind == BK::Farm && self.buildings[b].owner == owner && self.buildings[b].built >= 1.0) {
                        self.units[i].task = Task::Gather(target);
                    }
                }
            }
            "help" => {
                // send villagers to finish a half-built building of ours
                let Some(&bi) = m["target"].as_u64().and_then(|b| self.bidx.get(&(b as u32))) else { return };
                if self.buildings[bi].owner != owner || self.buildings[bi].built >= 1.0 {
                    return;
                }
                let target = self.buildings[bi].id;
                for i in self.owned(owner, &m["ids"]) {
                    if self.units[i].kind == UK::Villager {
                        self.units[i].task = Task::Build(target);
                    }
                }
            }
            "build" => self.cmd_build(owner, m),
            "train" => {
                let Some(&bi) = m["b"].as_u64().and_then(|b| self.bidx.get(&(b as u32))) else { return };
                let Some(kind) = m["u"].as_str().and_then(UK::from_name) else { return };
                let b = &self.buildings[bi];
                let allowed = match b.kind {
                    BK::Center => kind == UK::Villager,
                    BK::Barracks => matches!(kind, UK::Warrior | UK::Archer),
                    _ => false,
                };
                let t = &self.tribes[&owner];
                if b.owner != owner || b.built < 1.0 || !allowed || b.queue.len() >= MAX_QUEUE || t.age < kind.age() {
                    return;
                }
                if self.pop(owner) >= self.cap(owner) {
                    return;
                }
                let cost = kind.stats().cost;
                let t = self.tribes.get_mut(&owner).unwrap();
                if (0..3).any(|k| t.res[k] < cost[k]) {
                    return;
                }
                for k in 0..3 {
                    t.res[k] -= cost[k];
                }
                let time = kind.stats().time * t.mods.train;
                self.buildings[bi].queue.push((kind, time));
            }
            "rally" => {
                if let Some(&bi) = m["b"].as_u64().and_then(|b| self.bidx.get(&(b as u32))) {
                    if self.buildings[bi].owner == owner {
                        self.buildings[bi].rally = Some((wrap(m["x"].as_f64().unwrap_or(0.0)), wrap(m["y"].as_f64().unwrap_or(0.0))));
                    }
                }
            }
            "age" => {
                let t = &self.tribes[&owner];
                if t.age >= 3 {
                    return;
                }
                let cost = age_cost(t.age + 1);
                let t = self.tribes.get_mut(&owner).unwrap();
                if (0..3).any(|k| t.res[k] < cost[k]) {
                    return;
                }
                for k in 0..3 {
                    t.res[k] -= cost[k];
                }
                t.age += 1;
                t.score += 25.0;
            }
            _ => {}
        }
    }

    fn cmd_build(&mut self, owner: u32, m: &Value) {
        let Some(kind) = m["b"].as_str().and_then(BK::from_name) else { return };
        let (x, y) = (wrap(m["x"].as_f64().unwrap_or(0.0)), wrap(m["y"].as_f64().unwrap_or(0.0)));
        let bs = kind.stats();
        let t = &self.tribes[&owner];
        if t.age < bs.age || (0..3).any(|k| t.res[k] < bs.cost[k]) {
            return;
        }
        // near the camp, and not on top of anything
        if !self.buildings.iter().any(|b| b.owner == owner && dist(b.x, b.y, x, y) < BUILD_RANGE) {
            return;
        }
        if self.buildings.iter().any(|b| dist(b.x, b.y, x, y) < b.kind.stats().r + bs.r + 8.0) || self.nodes.iter().any(|n| dist(n.x, n.y, x, y) < bs.r + 14.0) {
            return;
        }
        let builders: Vec<usize> = self.owned(owner, &m["ids"]).into_iter().filter(|&i| self.units[i].kind == UK::Villager).collect();
        if builders.is_empty() {
            return;
        }
        let t = self.tribes.get_mut(&owner).unwrap();
        for k in 0..3 {
            t.res[k] -= bs.cost[k];
        }
        let max = bs.hp * self.mods(owner).building_hp;
        let id = self.nid();
        self.buildings.push(Building { id, owner, kind, x, y, hp: max * 0.1, max, built: 0.0, queue: Vec::new(), rally: None, cd: 0.0, hurt_t: 0.0, dead: false });
        self.bidx.insert(id, self.buildings.len() - 1);
        for i in builders {
            self.units[i].task = Task::Build(id);
        }
    }

    // -- the world ticks ------------------------------------------------------------
    pub fn step(&mut self, dt: f64) {
        self.t += dt;
        self.reindex();
        let n = self.units.len();
        for i in 0..n {
            if !self.units[i].dead {
                self.step_unit(i, dt);
            }
        }
        for i in 0..self.buildings.len() {
            if !self.buildings[i].dead {
                self.step_building(i, dt);
            }
        }
        self.cleanup();
        self.regrow(dt);
    }

    fn cleanup(&mut self) {
        // fallen camps: no great hut means the tribe is finished
        let fallen: Vec<u32> = self.tribes.values().filter(|t| t.alive && !self.buildings.iter().any(|b| b.owner == t.id && b.kind == BK::Center && !b.dead)).map(|t| t.id).collect();
        for id in fallen {
            if let Some(t) = self.tribes.get_mut(&id) {
                t.alive = false;
            }
            for u in self.units.iter_mut().filter(|u| u.owner == id) {
                u.dead = true;
            }
            for b in self.buildings.iter_mut().filter(|b| b.owner == id) {
                b.dead = true;
            }
        }
        let before = (self.units.len(), self.buildings.len(), self.nodes.len());
        self.units.retain(|u| !u.dead);
        self.buildings.retain(|b| !b.dead);
        self.nodes.retain(|n| n.amount > 0.0);
        if before != (self.units.len(), self.buildings.len(), self.nodes.len()) {
            self.reindex();
        }
    }

    /// the world refills so it can go on for ever: trees, bushes, stone and deer come back
    fn regrow(&mut self, dt: f64) {
        self.regrow_t += dt;
        if self.regrow_t < 4.0 {
            return;
        }
        self.regrow_t = 0.0;
        for (kind, target) in [(RK::Tree, 520usize), (RK::Bush, 240), (RK::Stone, 150)] {
            let count = self.nodes.iter().filter(|n| n.kind == kind).count();
            if count < target {
                let (x, y) = match self.nodes.iter().filter(|n| n.kind == kind).nth(rand_int(count.max(1))) {
                    Some(n) if rand01() < 0.6 => (n.x + rand(-120.0, 120.0), n.y + rand(-120.0, 120.0)),
                    _ => (rand(100.0, MAP - 100.0), rand(100.0, MAP - 100.0)),
                };
                let near_camp = self.buildings.iter().any(|b| dist(b.x, b.y, x, y) < 160.0);
                if !near_camp {
                    self.add_node(kind, x, y);
                }
            }
        }
        if self.units.iter().filter(|u| u.kind == UK::Deer).count() < 90 {
            self.add_deer(rand(100.0, MAP - 100.0), rand(100.0, MAP - 100.0));
        }
    }

    fn target_pos(&self, id: u32) -> Option<(f64, f64, f64, bool)> {
        if let Some(&i) = self.uidx.get(&id) {
            let u = &self.units[i];
            return (!u.dead).then_some((u.x, u.y, 10.0, true));
        }
        if let Some(&i) = self.bidx.get(&id) {
            let b = &self.buildings[i];
            return (!b.dead).then_some((b.x, b.y, b.kind.stats().r, false));
        }
        None
    }

    fn walk(&mut self, i: usize, tx: f64, ty: f64, stop: f64, dt: f64) -> bool {
        let spd = {
            let u = &self.units[i];
            let s = u.kind.stats().speed;
            if u.kind == UK::Deer { if u.flee_t > 0.0 { 140.0 } else { s } } else { s * self.mods(u.owner).speed }
        };
        let u = &mut self.units[i];
        let d = dist(u.x, u.y, tx, ty);
        if d <= stop {
            u.moving = false;
            return true;
        }
        let step = (spd * dt).min(d - stop).max(0.0);
        u.ang = wd(ty - u.y).atan2(wd(tx - u.x));
        u.x = wrap(u.x + u.ang.cos() * step);
        u.y = wrap(u.y + u.ang.sin() * step);
        u.moving = true;
        false
    }

    fn step_unit(&mut self, i: usize, dt: f64) {
        {
            let u = &mut self.units[i];
            u.cd = (u.cd - dt).max(0.0);
            u.hurt_t = (u.hurt_t - dt).max(0.0);
            u.flee_t = (u.flee_t - dt).max(0.0);
            u.act = 0;
            u.moving = false;
            if u.poison_t > 0.0 {
                u.poison_t -= dt;
                u.hp -= u.poison * dt;
                if u.hp <= 0.0 {
                    self.kill_unit(i, None);
                    return;
                }
            }
        }
        let (owner, kind, task) = (self.units[i].owner, self.units[i].kind, self.units[i].task);
        if kind == UK::Deer {
            return self.step_deer(i, dt);
        }
        match task {
            Task::Idle => {
                if kind.fights() {
                    let sight = if kind == UK::Archer { 300.0 } else { 240.0 };
                    if let Some(t) = self.nearest_enemy(i, sight) {
                        self.units[i].task = Task::Attack(t);
                    }
                }
            }
            Task::Move(x, y) => {
                if self.walk(i, x, y, 6.0, dt) {
                    self.units[i].task = Task::Idle;
                }
            }
            Task::Attack(tid) => self.do_attack(i, tid, dt),
            Task::Gather(nid) => self.do_gather(i, nid, dt),
            Task::Deposit(ret) => self.do_deposit(i, ret, dt),
            Task::Build(bid) => self.do_build(i, bid, dt),
        }
        let _ = owner;
    }

    fn step_deer(&mut self, i: usize, dt: f64) {
        let u = &mut self.units[i];
        if u.flee_t > 0.0 {
            let (nx, ny) = (u.x + u.ang.cos() * 200.0, u.y + u.ang.sin() * 200.0);
            self.walk(i, nx, ny, 0.0, dt);
        } else if rand01() < dt * 0.4 {
            self.units[i].ang += rand(-1.5, 1.5);
            self.units[i].task = Task::Move(wrap(self.units[i].x + self.units[i].ang.cos() * 90.0), wrap(self.units[i].y + self.units[i].ang.sin() * 90.0));
        } else if let Task::Move(x, y) = self.units[i].task {
            if self.walk(i, x, y, 4.0, dt) {
                self.units[i].task = Task::Idle;
            }
        }
    }

    fn nearest_enemy(&self, i: usize, sight: f64) -> Option<u32> {
        let u = &self.units[i];
        let mut best: Option<(f64, u32)> = None;
        for e in self.units.iter().filter(|e| e.owner != u.owner && e.owner != 0 && !e.dead) {
            let d = dist(u.x, u.y, e.x, e.y);
            if d < sight && best.is_none_or(|b| d < b.0) {
                best = Some((d, e.id));
            }
        }
        for b in self.buildings.iter().filter(|b| b.owner != u.owner && !b.dead) {
            let d = dist(u.x, u.y, b.x, b.y) - b.kind.stats().r;
            // buildings only draw attention when nothing else is in the way
            if d < sight * 0.6 && best.is_none_or(|bb| d + 80.0 < bb.0) {
                best = Some((d + 80.0, b.id));
            }
        }
        best.map(|b| b.1)
    }

    fn do_attack(&mut self, i: usize, tid: u32, dt: f64) {
        let Some((tx, ty, tr, is_unit)) = self.target_pos(tid) else {
            self.units[i].task = Task::Idle;
            return;
        };
        let (kind, owner, x, y) = {
            let u = &self.units[i];
            (u.kind, u.owner, u.x, u.y)
        };
        if self.target_owner(tid) == owner {
            self.units[i].task = Task::Idle;
            return;
        }
        let s = kind.stats();
        let range = s.range + tr;
        let d = dist(x, y, tx, ty);
        if d > 900.0 && owner != 0 {
            self.units[i].task = Task::Idle; // lost it
            return;
        }
        if d > range {
            self.walk(i, tx, ty, range * 0.85, dt);
            return;
        }
        self.units[i].act = 2;
        self.units[i].ang = wd(ty - y).atan2(wd(tx - x));
        if self.units[i].cd > 0.0 {
            return;
        }
        self.units[i].cd = s.cd;
        let mods = self.mods(owner);
        let (_, age) = self.mult(owner);
        let mut dmg = s.dmg * age;
        match kind {
            UK::Warrior | UK::Beast => dmg *= mods.melee * if is_unit { 1.0 } else { mods.siege },
            UK::Archer => dmg *= mods.ranged,
            _ => {}
        }
        if !is_unit && kind == UK::Archer {
            dmg *= 0.5; // arrows barely scratch buildings
        }
        self.deal(i, tid, dmg, matches!(kind, UK::Warrior | UK::Beast | UK::Villager));
    }

    fn target_owner(&self, id: u32) -> u32 {
        if let Some(&i) = self.uidx.get(&id) {
            self.units[i].owner
        } else if let Some(&i) = self.bidx.get(&id) {
            self.buildings[i].owner
        } else {
            u32::MAX
        }
    }

    /// `attacker` hits `tid`; melee hits are returned in kind by thorns and may poison
    fn deal(&mut self, attacker: usize, tid: u32, dmg: f64, melee: bool) {
        let (aowner, aid, apoison) = {
            let a = &self.units[attacker];
            (a.owner, a.id, self.mods(a.owner).poison)
        };
        let (ax, ay) = (self.units[attacker].x, self.units[attacker].y);
        if let Some(&ti) = self.uidx.get(&tid) {
            let t = &mut self.units[ti];
            t.hp -= dmg;
            t.hurt_t = 0.4;
            if t.kind == UK::Deer {
                t.flee_t = 4.0;
                t.ang = wd(t.y - ay).atan2(wd(t.x - ax));
            } else if melee && apoison > 0.0 {
                t.poison = apoison;
                t.poison_t = 4.0;
            }
            let (towner, tkind, tidle) = (t.owner, t.kind, t.task == Task::Idle);
            if tkind.fights() && tidle {
                self.units[ti].task = Task::Attack(aid); // fight back
            }
            if melee {
                let th = self.mods(towner).thorns;
                if th > 0.0 {
                    self.units[attacker].hp -= dmg * th;
                    if self.units[attacker].hp <= 0.0 {
                        self.kill_unit(attacker, None);
                    }
                }
            }
            if self.units[ti].hp <= 0.0 {
                self.kill_unit(ti, Some(aowner));
            }
        } else if let Some(&bi) = self.bidx.get(&tid) {
            let b = &mut self.buildings[bi];
            b.hp -= dmg;
            b.hurt_t = 0.4;
            if b.hp <= 0.0 && !b.dead {
                b.dead = true;
                if let Some(t) = self.tribes.get_mut(&aowner) {
                    t.score += 20.0;
                }
            }
        }
    }

    fn kill_unit(&mut self, i: usize, killer: Option<u32>) {
        if self.units[i].dead {
            return;
        }
        self.units[i].dead = true;
        let (kind, x, y) = (self.units[i].kind, self.units[i].x, self.units[i].y);
        if kind == UK::Deer {
            self.add_node(RK::Meat, x, y);
            // whoever was hunting it carries on with the meat
            let meat = self.nodes.last().map(|n| n.id).unwrap();
            let id = self.units[i].id;
            for u in self.units.iter_mut().filter(|u| u.task == Task::Attack(id) && u.kind == UK::Villager) {
                u.task = Task::Gather(meat);
            }
            self.nidx.insert(meat, self.nodes.len() - 1);
        } else if let Some(k) = killer {
            if let Some(t) = self.tribes.get_mut(&k) {
                t.score += 5.0;
            }
        }
    }

    fn do_gather(&mut self, i: usize, nid: u32, dt: f64) {
        let (owner, x, y, res_now, carry) = {
            let u = &self.units[i];
            (u.owner, u.x, u.y, u.res, u.carry)
        };
        // a node or one of our farms
        let (tx, ty, tr, res, farm) = if let Some(&ni) = self.nidx.get(&nid) {
            let n = &self.nodes[ni];
            if n.amount <= 0.0 {
                return self.find_more(i, n.kind);
            }
            (n.x, n.y, 10.0, if n.kind == RK::Tree { 1 } else if n.kind == RK::Stone { 2 } else { 0 }, false)
        } else if let Some(&bi) = self.bidx.get(&nid) {
            let b = &self.buildings[bi];
            if b.dead || b.owner != owner {
                self.units[i].task = Task::Idle;
                return;
            }
            (b.x, b.y, b.kind.stats().r, 0, true)
        } else {
            self.units[i].task = Task::Idle;
            return;
        };
        if carry > 0.0 && res_now != res {
            self.units[i].carry = 0.0; // dropped what it held: it switched jobs
        }
        if dist(x, y, tx, ty) > tr + 16.0 {
            self.walk(i, tx, ty, tr + 8.0, dt);
            return;
        }
        let mods = self.mods(owner);
        let kind_rate = if farm {
            0.8 * mods.farm
        } else {
            let n = &self.nodes[self.nidx[&nid]];
            match n.kind {
                RK::Tree => 1.0,
                RK::Bush => 1.2 * mods.hunt.max(0.9),
                RK::Stone => 0.8,
                RK::Meat => 1.6 * mods.hunt,
            }
        } * mods.gather;
        let mut take = kind_rate * dt;
        if !farm {
            let ni = self.nidx[&nid];
            take = take.min(self.nodes[ni].amount);
            self.nodes[ni].amount -= take;
        }
        let u = &mut self.units[i];
        u.res = res;
        u.carry += take;
        u.act = 4;
        if u.carry >= CARRY {
            u.task = Task::Deposit(nid);
        }
    }

    fn find_more(&mut self, i: usize, kind: RK) {
        let (x, y) = (self.units[i].x, self.units[i].y);
        let next = self.nodes.iter().filter(|n| n.kind == kind && n.amount > 0.0).map(|n| (dist(x, y, n.x, n.y), n.id)).filter(|d| d.0 < 500.0).min_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
        if self.units[i].carry > 0.5 {
            self.units[i].task = Task::Deposit(next.map_or(0, |n| n.1));
        } else {
            self.units[i].task = next.map_or(Task::Idle, |n| Task::Gather(n.1));
        }
    }

    fn do_deposit(&mut self, i: usize, ret: u32, dt: f64) {
        let (owner, x, y) = (self.units[i].owner, self.units[i].x, self.units[i].y);
        let drop = self.buildings.iter().filter(|b| b.owner == owner && !b.dead && b.built >= 1.0 && matches!(b.kind, BK::Center | BK::Hut)).map(|b| (dist(x, y, b.x, b.y), b.x, b.y, b.kind.stats().r)).min_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
        let Some((d, bx, by, br)) = drop else {
            self.units[i].task = Task::Idle;
            return;
        };
        if d > br + 14.0 {
            self.walk(i, bx, by, br + 8.0, dt);
            return;
        }
        let (res, carry) = (self.units[i].res, self.units[i].carry);
        if let Some(t) = self.tribes.get_mut(&owner) {
            t.res[res] += carry;
            t.score += carry * 0.1;
        }
        let u = &mut self.units[i];
        u.carry = 0.0;
        u.task = if ret != 0 && (self.nidx.contains_key(&ret) || self.bidx.contains_key(&ret)) { Task::Gather(ret) } else { Task::Idle };
    }

    fn do_build(&mut self, i: usize, bid: u32, dt: f64) {
        let Some(&bi) = self.bidx.get(&bid) else {
            self.units[i].task = Task::Idle;
            return;
        };
        let (bx, by, r, kind, built, dead) = {
            let b = &self.buildings[bi];
            (b.x, b.y, b.kind.stats().r, b.kind, b.built, b.dead)
        };
        if dead {
            self.units[i].task = Task::Idle;
            return;
        }
        if built >= 1.0 {
            self.units[i].task = if kind == BK::Farm { Task::Gather(bid) } else { Task::Idle };
            return;
        }
        let (x, y) = (self.units[i].x, self.units[i].y);
        if dist(x, y, bx, by) > r + 18.0 {
            self.walk(i, bx, by, r + 10.0, dt);
            return;
        }
        self.units[i].act = 8;
        let b = &mut self.buildings[bi];
        b.built = (b.built + dt / kind.stats().time).min(1.0);
        b.hp = b.max * b.built.max(0.1);
    }

    fn step_building(&mut self, i: usize, dt: f64) {
        self.buildings[i].hurt_t = (self.buildings[i].hurt_t - dt).max(0.0);
        self.buildings[i].cd = (self.buildings[i].cd - dt).max(0.0);
        let (owner, kind, built, x, y) = {
            let b = &self.buildings[i];
            (b.owner, b.kind, b.built, b.x, b.y)
        };
        if built < 1.0 {
            return;
        }
        if kind == BK::Tower && self.buildings[i].cd <= 0.0 {
            let target = self.units.iter().enumerate().filter(|(_, u)| u.owner != owner && u.owner != 0 && !u.dead && dist(u.x, u.y, x, y) < 300.0).min_by(|a, b| dist(a.1.x, a.1.y, x, y).partial_cmp(&dist(b.1.x, b.1.y, x, y)).unwrap_or(std::cmp::Ordering::Equal)).map(|(ti, u)| (ti, u.id));
            if let Some((ti, tid)) = target {
                self.buildings[i].cd = 1.5;
                let dmg = 10.0 * self.mods(owner).ranged;
                let t = &mut self.units[ti];
                t.hp -= dmg;
                t.hurt_t = 0.4;
                if self.units[ti].hp <= 0.0 {
                    self.kill_unit(ti, Some(owner));
                }
                let _ = tid;
            }
        }
        // production
        if let Some(&(ukind, remaining)) = self.buildings[i].queue.first() {
            let alive_pop = self.units.iter().filter(|u| u.owner == owner && !u.dead).count();
            if alive_pop >= self.cap(owner) {
                return; // no room for a new member
            }
            let left = remaining - dt;
            if left > 0.0 {
                self.buildings[i].queue[0].1 = left;
            } else {
                self.buildings[i].queue.remove(0);
                let r = kind.stats().r;
                let a = rand(0.0, TAU);
                let id = self.spawn_unit(owner, ukind, x + a.cos() * (r + 18.0), y + a.sin() * (r + 18.0));
                if let Some(t) = self.tribes.get_mut(&owner) {
                    t.score += 1.0;
                }
                if let (Some(&ui), Some((rx, ry))) = (self.uidx.get(&id), self.buildings[i].rally) {
                    // a rally point on a resource sends the new villager straight to work
                    let node = self.nodes.iter().find(|n| dist(n.x, n.y, rx, ry) < 40.0 && n.amount > 0.0).map(|n| n.id);
                    self.units[ui].task = match (node, ukind) {
                        (Some(n), UK::Villager) => Task::Gather(n),
                        _ => Task::Move(rx, ry),
                    };
                }
            }
        }
    }

    // -- snapshots ----------------------------------------------------------------
    pub fn snapshots(&self, with_nodes: bool) -> Vec<TSnap> {
        let mut board: Vec<(String, i64, u32)> = self.tribes.values().map(|t| (t.name.clone(), t.score as i64, t.color)).collect();
        board.sort_by(|a, b| b.1.cmp(&a.1));
        board.truncate(8);
        let tribes: Vec<(u32, String, u32)> = self.tribes.values().map(|t| (t.id, t.name.clone(), t.color)).collect();
        let online = self.tribes.len() as u32;
        let mut out = Vec::new();
        for t in self.tribes.values() {
            // fog: you see what your own units and buildings can see
            let eyes: Vec<(f64, f64, f64)> = self.units.iter().filter(|u| u.owner == t.id).map(|u| (u.x, u.y, UNIT_VISION)).chain(self.buildings.iter().filter(|b| b.owner == t.id).map(|b| (b.x, b.y, BUILD_VISION))).collect();
            let seen = |x: f64, y: f64| eyes.iter().any(|e| dist(e.0, e.1, x, y) < e.2);
            let units = self.units.iter().filter(|u| u.owner == t.id || seen(u.x, u.y)).map(|u| {
                let flags = (u.moving as u8) + u.act + if u.hurt_t > 0.0 { 16 } else { 0 };
                [u.id as f64, u.owner as f64, u.kind.code(), u.x.round(), u.y.round(), (u.hp / u.max * 100.0).clamp(0.0, 100.0).round(), flags as f64, (u.ang * 100.0).round() / 100.0]
            });
            let buildings = self.buildings.iter().filter(|b| b.owner == t.id || seen(b.x, b.y)).map(|b| {
                let prog = b.queue.first().map_or(0.0, |q| {
                    let full = q.0.stats().time * self.tribes.get(&b.owner).map_or(1.0, |t| t.mods.train);
                    ((1.0 - q.1 / full) * 100.0).clamp(0.0, 100.0)
                });
                [b.id as f64, b.owner as f64, b.kind.code(), b.x.round(), b.y.round(), (b.hp / b.max * 100.0).clamp(0.0, 100.0).round(), (b.built * 100.0).round(), b.queue.len() as f64, prog.round()]
            });
            let nodes = with_nodes.then(|| self.nodes.iter().filter(|n| seen(n.x, n.y)).map(|n| [n.id as f64, n.kind as u8 as f64, n.x.round(), n.y.round(), n.amount.round()]).collect());
            let (cx, cy) = self.buildings.iter().find(|b| b.owner == t.id && b.kind == BK::Center).map_or(t.spawn, |b| (b.x, b.y));
            out.push(TSnap {
                t: "tsnap".into(),
                to: t.id,
                me: TMe { id: t.id, name: t.name.clone(), color: t.color, res: [t.res[0].floor(), t.res[1].floor(), t.res[2].floor()], pop: self.pop(t.id) as u32, cap: self.cap(t.id) as u32, age: t.age, score: t.score as i64, alive: t.alive, cx, cy, next_age: if t.age < 3 { age_cost(t.age + 1) } else { [0.0; 3] } },
                units: units.collect(),
                buildings: buildings.collect(),
                nodes,
                board: board.clone(),
                tribes: tribes.clone(),
                online,
            });
        }
        out
    }
}

impl Default for Tribes {
    fn default() -> Self {
        Tribes::new()
    }
}

pub fn rk_from_code(c: f64) -> RK {
    [RK::Tree, RK::Bush, RK::Stone, RK::Meat][(c as usize).min(3)]
}
