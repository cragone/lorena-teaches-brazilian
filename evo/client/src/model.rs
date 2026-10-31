use crate::util::*;
use serde::{Deserialize, Serialize};

// ---- stages ----------------------------------------------------------------
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default, Serialize, Deserialize)]
pub enum Stage {
    #[default]
    Water,
    Land,
}
impl Stage {
    pub fn idx(self) -> usize {
        self as usize
    }
    pub fn from_idx(i: u8) -> Stage {
        if i == 1 { Stage::Land } else { Stage::Water }
    }
}

// ---- traits ----------------------------------------------------------------
pub struct TraitDef {
    pub stage: Stage,
    pub key: &'static str,
    pub min: i32,
    pub max: i32,
    pub base: f64,
    pub growth: f64,
    pub epic: Option<Epic>,
}
impl TraitDef {
    pub fn cost(&self, to: i32) -> i32 {
        let mult = if self.stage == Stage::Land { LAND_COST_MULT } else { 1.0 };
        (self.base * self.growth.powi(to.abs() - 1) * mult).round() as i32
    }
    pub fn max_for(&self, unlocks: &[Epic]) -> i32 {
        if self.stage == Stage::Water && self.key == "mitosis" && unlocks.contains(&Epic::Mitosis) { 6 } else { self.max }
    }
    /// (name, description) for the shop; the land animal wears the same genes differently
    pub fn label(&self, stage: Stage) -> (&'static str, &'static str) {
        match (stage, self.key) {
            (_, "size") => ("Size", "Big eats nearly anything but is slow and easy to spot. Small is fast and hard to see."),
            (Stage::Water, "speed") => ("Flagella", "+18% swim speed per level."),
            (Stage::Land, "speed") => ("Legs", "Longer, stronger legs: +18% running speed per level."),
            (Stage::Water, "spikes") => ("Spikes", "Hurts anything that touches or bites you, even bigger cells."),
            (Stage::Land, "spikes") => ("Horns & quills", "Hurts anything that touches or bites you, even bigger animals."),
            (Stage::Water, "venom") => ("Venom", "Shoot a poison cloud behind you to stop chasers (key F). Each level reaches farther, hurts more and recharges faster."),
            (Stage::Land, "venom") => ("Poison spit", "Spit a poison cloud ahead of you (key F). Each level reaches farther and hurts more."),
            (Stage::Water, "mitosis") => ("Mitosis", "Split in half to send out colony cells. Each level allows one more colony."),
            (Stage::Land, "mitosis") => ("Pack animals", "Call pack mates to fight beside you, then they rejoin. Each level allows one more."),
            (Stage::Water, "toxic") => ("Super venom", "EPIC: toxic skin. Anything that touches you dies."),
            (Stage::Land, "toxic") => ("Deadly skin", "EPIC: poison skin. Anything that touches you dies."),
            (Stage::Water, "fins") => ("Fins", "EPIC: huge swim speed, +35% per level (stacks with flagella)."),
            (Stage::Land, "fins") => ("Hooves", "EPIC: huge running speed, +35% per level (stacks with legs)."),
            (Stage::Water, "shock") => ("Electric buzz", "EPIC: zaps every cell around you. Bigger reach and damage per level."),
            (Stage::Land, "shock") => ("Venom", "Fangs and stingers: anything you bite is poisoned and keeps losing health."),
            (Stage::Water, "tough") => ("Thick membrane", "+60% health and 12% less damage per level."),
            (Stage::Land, "tough") => ("Thick hide", "+60% health and 12% less damage per level."),
            (Stage::Land, "claws") => ("Claws", "Sharp claws on every paw: +30% bite damage and faster bites per level."),
            (Stage::Land, "tail") => ("Tail club", "A heavy spiked tail that whips anything touching your rear. Stronger per level."),
            (Stage::Land, "charm") => ("Charm", "Befriend animals (key B): +18% chance per level, and room for one more friend per level. Herbivores make friends easily, carnivores barely."),
            (Stage::Land, "thorns") => ("Thorn armor", "EPIC: attackers take a share of the damage they deal back. Stronger per level."),
            (Stage::Land, "pounce") => ("Pounce", "EPIC: lunge much farther and hit harder while running. Stronger per level."),
            (Stage::Land, "alpha") => ("Alpha aura", "EPIC: your befriend chance rises 10% per level and friends are easier to keep."),
            (Stage::Land, "ambush") => ("Ambush", "EPIC: the first bite after staying hidden for 3s deals +50% damage per level."),
            _ => ("?", ""),
        }
    }
}

pub const WATER_TRAITS: &[TraitDef] = &[
    TraitDef { stage: Stage::Water, key: "size", min: -3, max: 5, base: 400.0, growth: 2.3, epic: None },
    TraitDef { stage: Stage::Water, key: "speed", min: 0, max: 4, base: 200.0, growth: 2.2, epic: None },
    TraitDef { stage: Stage::Water, key: "spikes", min: 0, max: 3, base: 250.0, growth: 2.5, epic: None },
    TraitDef { stage: Stage::Water, key: "venom", min: 0, max: 3, base: 300.0, growth: 2.5, epic: None },
    TraitDef { stage: Stage::Water, key: "mitosis", min: 0, max: 4, base: 350.0, growth: 2.5, epic: None },
    TraitDef { stage: Stage::Water, key: "toxic", min: 0, max: 1, base: 8000.0, growth: 1.0, epic: Some(Epic::Venom) },
    TraitDef { stage: Stage::Water, key: "fins", min: 0, max: 3, base: 2500.0, growth: 2.6, epic: Some(Epic::Fins) },
    TraitDef { stage: Stage::Water, key: "shock", min: 0, max: 3, base: 2000.0, growth: 2.6, epic: Some(Epic::Jelly) },
    TraitDef { stage: Stage::Water, key: "tough", min: 0, max: 3, base: 200.0, growth: 2.4, epic: None },
];
pub const LAND_TRAITS: &[TraitDef] = &[
    // size is capped on land: it is the gear you carry that wins fights
    TraitDef { stage: Stage::Land, key: "size", min: -2, max: 2, base: 400.0, growth: 2.3, epic: None },
    TraitDef { stage: Stage::Land, key: "speed", min: 0, max: 4, base: 200.0, growth: 2.2, epic: None },
    TraitDef { stage: Stage::Land, key: "spikes", min: 0, max: 3, base: 250.0, growth: 2.5, epic: None },
    TraitDef { stage: Stage::Land, key: "claws", min: 0, max: 3, base: 250.0, growth: 2.4, epic: None },
    TraitDef { stage: Stage::Land, key: "tail", min: 0, max: 3, base: 300.0, growth: 2.5, epic: None },
    TraitDef { stage: Stage::Land, key: "venom", min: 0, max: 3, base: 300.0, growth: 2.5, epic: None },
    TraitDef { stage: Stage::Land, key: "shock", min: 0, max: 3, base: 350.0, growth: 2.6, epic: None },
    TraitDef { stage: Stage::Land, key: "mitosis", min: 0, max: 4, base: 350.0, growth: 2.5, epic: None },
    TraitDef { stage: Stage::Land, key: "charm", min: 0, max: 4, base: 250.0, growth: 2.2, epic: None },
    TraitDef { stage: Stage::Land, key: "tough", min: 0, max: 3, base: 200.0, growth: 2.4, epic: None },
    TraitDef { stage: Stage::Land, key: "thorns", min: 0, max: 3, base: 1500.0, growth: 2.4, epic: Some(Epic::Thornback) },
    TraitDef { stage: Stage::Land, key: "pounce", min: 0, max: 3, base: 1500.0, growth: 2.4, epic: Some(Epic::Stormwing) },
    TraitDef { stage: Stage::Land, key: "alpha", min: 0, max: 3, base: 1800.0, growth: 2.4, epic: Some(Epic::Matriarch) },
    TraitDef { stage: Stage::Land, key: "ambush", min: 0, max: 3, base: 1500.0, growth: 2.4, epic: Some(Epic::Stalker) },
];
pub fn trait_defs(stage: Stage) -> &'static [TraitDef] {
    if stage == Stage::Land { LAND_TRAITS } else { WATER_TRAITS }
}
/// the heaviest a land animal can get, as a multiple of its starting weight for its size gene
pub const LAND_MASS_CAP: f64 = 1.6;
/// NPC land animals never grow past this many START_MASS
pub const LAND_NPC_CAP: f64 = 3.6;
pub const SHAPES: [&str; 4] = ["Balanced", "Lean", "Stocky", "Long"];


#[derive(Clone, Copy, PartialEq, Eq, Debug, Serialize, Deserialize)]
pub enum Epic {
    Venom,
    Mitosis,
    Fins,
    Jelly,
    // the land has its own, completely different mutants
    Thornback,
    Stormwing,
    Matriarch,
    Stalker,
}
pub const EPIC_LIST: [Epic; 8] = [Epic::Venom, Epic::Mitosis, Epic::Fins, Epic::Jelly, Epic::Thornback, Epic::Stormwing, Epic::Matriarch, Epic::Stalker];
pub fn epics_for(stage: Stage) -> &'static [Epic] {
    if stage == Stage::Land { &EPIC_LIST[4..] } else { &EPIC_LIST[..4] }
}
impl Epic {
    pub fn code(self) -> f64 {
        match self {
            Epic::Venom => 1.0,
            Epic::Mitosis => 2.0,
            Epic::Fins => 3.0,
            Epic::Jelly => 4.0,
            Epic::Thornback => 5.0,
            Epic::Stormwing => 6.0,
            Epic::Matriarch => 7.0,
            Epic::Stalker => 8.0,
        }
    }
    pub fn from_code(c: f64) -> Option<Epic> {
        EPIC_LIST.get((c as usize).wrapping_sub(1)).copied()
    }
    pub fn color(self, _stage: Stage) -> u32 {
        match self {
            Epic::Venom => 0x3cff3c,
            Epic::Mitosis => 0xb36bff,
            Epic::Fins => 0xff9a2e,
            Epic::Jelly => 0x6bf3ff,
            Epic::Thornback => 0xc9a05a,
            Epic::Stormwing => 0x7fd0ff,
            Epic::Matriarch => 0xff8fb8,
            Epic::Stalker => 0x9a6bff,
        }
    }
    pub fn name(self, _stage: Stage) -> &'static str {
        match self {
            Epic::Venom => "Toxic Mutant",
            Epic::Mitosis => "Swarm Mother",
            Epic::Fins => "Finned Sprinter",
            Epic::Jelly => "Electric Jelly",
            Epic::Thornback => "Thornback",
            Epic::Stormwing => "Stormwing",
            Epic::Matriarch => "Matriarch",
            Epic::Stalker => "Shadow Stalker",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default, Serialize, Deserialize)]
pub enum Diet {
    Herb,
    #[default]
    Omni,
    Carn,
}
pub struct DietDef {
    pub diet: Diet,
    pub key: &'static str,
    pub name: &'static str,
    pub cost: i32,
    pub plant: f64,
    pub meat: f64,
}
pub const DIETS: [DietDef; 3] = [
    DietDef { diet: Diet::Herb, key: "herb", name: "Herbivore", cost: 300, plant: 1.5, meat: 0.0 },
    DietDef { diet: Diet::Omni, key: "omni", name: "Omnivore", cost: 900, plant: 1.0, meat: 1.0 },
    DietDef { diet: Diet::Carn, key: "carn", name: "Carnivore", cost: 300, plant: 0.0, meat: 1.5 },
];
impl DietDef {
    pub fn cost_at(&self, stage: Stage) -> i32 {
        (self.cost as f64 * if stage == Stage::Land { LAND_COST_MULT } else { 1.0 }).round() as i32
    }
}

impl Traits {
    /// what a species keeps when it crawls out of the water: each gene becomes its land counterpart at
    /// about half strength (flagella to legs, venom cloud to poison spit, electric buzz to venom bite,
    /// mitosis to pack, membrane to hide, fins and super venom boost legs and venom)
    pub fn onto_land(&self) -> Traits {
        let half = |l: i32| (l + 1) / 2;
        Traits {
            size: (self.size / 2).clamp(-2, 2),
            speed: (half(self.speed) + half(self.fins)).min(4),
            spikes: half(self.spikes).min(3),
            venom: half(self.venom).min(3),
            shock: (half(self.shock) + half(self.toxic)).min(3),
            mitosis: half(self.mitosis).min(4),
            tough: half(self.tough).min(3),
            eyes: self.eyes,
            diet: self.diet,
            ..Traits::default()
        }
    }
}

impl Diet {
    pub fn def(self) -> &'static DietDef {
        DIETS.iter().find(|d| d.diet == self).unwrap()
    }
    pub fn index(self) -> usize {
        DIETS.iter().position(|d| d.diet == self).unwrap()
    }
    pub fn from_key(k: &str) -> Option<Diet> {
        DIETS.iter().find(|d| d.key == k).map(|d| d.diet)
    }
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct Traits {
    pub size: i32,
    pub speed: i32,
    pub spikes: i32,
    pub venom: i32,
    pub tough: i32,
    pub mitosis: i32,
    pub eyes: i32,
    pub fins: i32,
    pub shock: i32,
    pub toxic: i32,
    pub claws: i32,
    pub tail: i32,
    pub charm: i32,
    pub thorns: i32,
    pub pounce: i32,
    pub alpha: i32,
    pub ambush: i32,
    pub shape: i32,
    pub diet: Diet,
}
impl Traits {
    pub fn fresh() -> Traits {
        Traits { diet: Diet::Herb, ..Default::default() }
    }
    pub fn get(&self, key: &str) -> i32 {
        match key {
            "size" => self.size,
            "speed" => self.speed,
            "spikes" => self.spikes,
            "venom" => self.venom,
            "tough" => self.tough,
            "mitosis" => self.mitosis,
            "fins" => self.fins,
            "shock" => self.shock,
            "toxic" => self.toxic,
            "claws" => self.claws,
            "tail" => self.tail,
            "charm" => self.charm,
            "thorns" => self.thorns,
            "pounce" => self.pounce,
            "alpha" => self.alpha,
            "ambush" => self.ambush,
            _ => 0,
        }
    }
    pub fn set(&mut self, key: &str, v: i32) {
        match key {
            "size" => self.size = v,
            "speed" => self.speed = v,
            "spikes" => self.spikes = v,
            "venom" => self.venom = v,
            "tough" => self.tough = v,
            "mitosis" => self.mitosis = v,
            "fins" => self.fins = v,
            "shock" => self.shock = v,
            "toxic" => self.toxic = v,
            "claws" => self.claws = v,
            "tail" => self.tail = v,
            "charm" => self.charm = v,
            "thorns" => self.thorns = v,
            "pounce" => self.pounce = v,
            "alpha" => self.alpha = v,
            "ambush" => self.ambush = v,
            _ => {}
        }
    }
}

pub const EYE_CHOICES: [i32; 4] = [0, 1, 2, 3]; // 0 = grows with size
pub const PLAYER_COLORS: [u32; 9] = [0x4fc3f7, 0xffb74d, 0xba68c8, 0x81c784, 0xf06292, 0xfff176, 0x4dd0e1, 0xa1887f, 0xe53935];

// ---- entities --------------------------------------------------------------
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Kind {
    Enemy,
    Mate,
    Player,
    Colony,
}

#[derive(Clone, Copy, Debug)]
pub struct Poison {
    pub dps: f64,
    pub t: f64,
    pub by: u32,
}

/// One creature: a microbe in the water, an animal on land. Also what clients keep for each
/// cell in a snapshot (only the drawing fields are filled in then).
#[derive(Clone, Debug)]
pub struct Cell {
    pub id: u32,
    pub pid: Option<u32>,
    pub kind: Kind,
    pub color: u32,
    pub x: f64,
    pub y: f64,
    pub mass: f64,
    pub vx: f64,
    pub vy: f64,
    pub angle: f64,
    pub seed: f64,
    pub bite: f64,
    pub cool: f64,
    pub lookx: f64,
    pub looky: f64,
    pub elong: f64,
    pub eyes: i32,
    pub flagella: i32,
    pub spikes: i32,
    pub pulse: f64,
    pub spike_lvl: i32,
    pub venom_lvl: i32,
    pub speed_lvl: i32,
    pub fins_lvl: i32,
    pub shock_lvl: i32,
    pub toxic_lvl: i32,
    pub claws: i32,
    pub tail_lvl: i32,
    pub thorns: i32,
    pub pounce: i32,
    pub ambush: i32,
    pub charm: i32,
    pub shape: i32,
    pub friend: bool,
    pub trust: f64, // befriending: each failed attempt makes this animal a little friendlier
    pub pack: u32, // herd or hunting pack this animal belongs to (0 = alone)
    pub epic: Option<Epic>,
    pub tough: i32,
    pub diet: Diet,
    pub poison: Option<Poison>,
    pub last_poison: f64,
    pub last_hit: f64,
    pub shield: f64,
    pub hp: f64,
    pub hpf: f64,
    pub psn: bool,
    pub sp: f64,
    pub aggressive: bool,
    pub amoeba: bool,
    pub splitter: bool,
    pub wander: f64,
    pub split_cool: f64,
    pub spray_cool: f64,
    pub zap_t: f64,
    pub foe: Option<u32>,
    pub foe_t: f64,
    pub owner: Option<u32>,
    pub pside: bool,
    pub life: f64,
    pub spread: Option<f64>,
    pub dead: bool,
    pub name: String,
    // client interpolation targets
    pub tx: f64,
    pub ty: f64,
    pub tangle: f64,
    pub local: bool,
}

pub fn max_hp(c: &Cell) -> f64 {
    (60.0 + c.mass * 2.0) * (1.0 + 0.6 * c.tough as f64) * shape_hp(c.shape)
}
pub fn shape_hp(shape: i32) -> f64 {
    match shape {
        1 => 0.85,
        2 => 1.25,
        _ => 1.0,
    }
}
pub fn shape_speed(shape: i32) -> f64 {
    match shape {
        1 => 1.15,
        2 => 0.9,
        _ => 1.0,
    }
}

impl Cell {
    pub fn new(id: u32, color: u32, x: f64, y: f64, mass: f64, seed: f64) -> Cell {
        let mut c = Cell {
            id, pid: None, kind: Kind::Enemy, color, x, y, mass, vx: 0.0, vy: 0.0, angle: rand(0.0, TAU), seed: seed * 17.3, bite: 0.0, cool: 0.0,
            lookx: 1.0, looky: 0.0, elong: 1.0, eyes: 1, flagella: 1, spikes: 0, pulse: 0.0, spike_lvl: 0, venom_lvl: 0, speed_lvl: 0, fins_lvl: 0,
            shock_lvl: 0, toxic_lvl: 0, claws: 0, tail_lvl: 0, thorns: 0, pounce: 0, ambush: 0, charm: 0, shape: 0, friend: false, trust: 0.0, pack: 0, epic: None, tough: 0, diet: Diet::Omni, poison: None, last_poison: -9.0, last_hit: -9.0, shield: 0.0, hp: 0.0,
            hpf: 1.0, psn: false, sp: 0.0, aggressive: false, amoeba: false, splitter: false, wander: 0.0, split_cool: 0.0, spray_cool: 2.0, zap_t: 0.0,
            foe: None, foe_t: 0.0, owner: None, pside: false, life: 0.0, spread: None, dead: false, name: String::new(), tx: x, ty: y, tangle: 0.0, local: false,
        };
        c.hp = max_hp(&c);
        c
    }
    pub fn is_player(&self) -> bool {
        self.kind == Kind::Player
    }
    pub fn is_mate(&self) -> bool {
        self.kind == Kind::Mate
    }
    /// cells that belong to the same player (the main cell and its colony) never fight
    pub fn family(&self) -> Option<u32> {
        match self.kind {
            Kind::Player => Some(self.id),
            Kind::Colony => self.owner,
            _ => self.splitter.then_some(self.id),
        }
    }
    pub fn allied(&self, o: &Cell) -> bool {
        self.family().is_some() && self.family() == o.family()
    }
    /// player cells and their colonies; NPC epics only ever hurt these
    pub fn player_side(&self) -> bool {
        self.kind == Kind::Player || self.pside
    }
    pub fn mouth(&self) -> (f64, f64) {
        let r = radius(self.mass) * self.elong * 0.9;
        (self.x + self.angle.cos() * r, self.y + self.angle.sin() * r)
    }
    // health is a fraction of max, so gaining mass must not look like damage
    pub fn add_mass(&mut self, amount: f64) {
        let frac = self.hp / max_hp(self);
        self.mass += amount;
        self.hp = frac * max_hp(self);
    }

    /// snapshot form, one flat number array per cell (kind: 0 peaceful, 1 mate, 2 player, 3 hunter, 4 colony)
    pub fn pack(&self, shown_id: u32) -> Vec<f64> {
        let r1 = |v: f64| (v * 10.0).round() / 10.0;
        let r2 = |v: f64| (v * 100.0).round() / 100.0;
        let kind = match self.kind {
            Kind::Player => 2.0,
            Kind::Mate => 1.0,
            Kind::Colony => 4.0,
            Kind::Enemy => if self.aggressive { 3.0 } else { 0.0 },
        };
        vec![
            shown_id as f64, kind, self.color as f64, r1(self.x), r1(self.y), r2(self.angle), r2(self.sp), r1(self.mass), r2(self.bite),
            r2(self.looky.atan2(self.lookx)), r2(self.elong), self.eyes as f64, self.flagella as f64, self.spikes as f64, r2(self.pulse),
            self.venom_lvl as f64, self.tough as f64, self.speed_lvl as f64, self.diet.index() as f64, r2(self.hpf), if self.psn { 1.0 } else { 0.0 },
            r1(self.seed), if self.shield > 0.0 { 1.0 } else { 0.0 }, self.epic.map_or(0.0, |e| e.code()), self.fins_lvl as f64,
            self.shock_lvl as f64, self.toxic_lvl as f64, self.claws as f64, self.tail_lvl as f64, self.thorns as f64, self.pounce as f64,
            self.ambush as f64, self.shape as f64, self.charm as f64, if self.friend { 1.0 } else { 0.0 },
        ]
    }
    pub fn unpack(a: &[f64]) -> Cell {
        let kindc = a[1] as i32;
        let mut c = Cell::new(a[0] as u32, a[2] as u32, a[3], a[4], a[7], 0.0);
        c.angle = a[5];
        c.tx = a[3];
        c.ty = a[4];
        c.tangle = a[5];
        c.kind = match kindc {
            1 => Kind::Mate,
            2 => Kind::Player,
            4 => Kind::Colony,
            _ => Kind::Enemy,
        };
        c.aggressive = kindc == 3;
        c.pid = (kindc == 2).then_some(a[0] as u32);
        c.update_from(a);
        c
    }
    pub fn update_from(&mut self, a: &[f64]) {
        self.color = a[2] as u32;
        self.tx = a[3];
        self.ty = a[4];
        self.tangle = a[5];
        self.sp = a[6];
        self.mass = a[7];
        self.bite = a[8];
        self.lookx = a[9].cos();
        self.looky = a[9].sin();
        self.elong = a[10];
        self.eyes = a[11] as i32;
        self.flagella = a[12] as i32;
        self.spikes = a[13] as i32;
        self.pulse = a[14];
        self.venom_lvl = a[15] as i32;
        self.tough = a[16] as i32;
        self.speed_lvl = a[17] as i32;
        self.diet = DIETS.get(a[18] as usize).map_or(Diet::Omni, |d| d.diet);
        self.hpf = a[19];
        self.psn = a[20] > 0.5;
        self.seed = a[21];
        self.shield = a[22];
        self.epic = Epic::from_code(a[23]);
        self.fins_lvl = a[24] as i32;
        self.shock_lvl = a[25] as i32;
        self.toxic_lvl = a[26] as i32;
        self.claws = a[27] as i32;
        self.tail_lvl = a[28] as i32;
        self.thorns = a[29] as i32;
        self.pounce = a[30] as i32;
        self.ambush = a[31] as i32;
        self.shape = a[32] as i32;
        self.charm = a[33] as i32;
        self.friend = a[34] > 0.5;
    }
}

#[derive(Clone, Debug)]
pub struct Food {
    pub x: f64,
    pub y: f64,
    pub kind: u8, // 0 plant, 1 meat
    pub mass: f64,
    pub bob: f64,
    pub size: f64,
    pub vx: f64,
    pub vy: f64,
    pub ttl: f64,
    pub eaten: bool,
}

#[derive(Clone, Debug)]
pub struct Toxin {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub r: f64,
    pub life: f64,
    pub max: f64,
    pub dps: f64,
    pub owner: u32,
}

pub struct Particle {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub life: f64,
    pub color: u32,
    pub size: f64,
}

// ---- players + network records -------------------------------------------------
pub struct Player {
    pub id: u32,
    pub name: String,
    pub color: u32,
    pub dna: f64,
    pub traits: Traits,
    pub pop: i32,
    pub species: i32,
    pub extinct: bool,
    pub respawn_t: f64,
    pub unlocks: Vec<Epic>,
    pub breed_cool: f64,
    pub split_cool: f64,
    pub poison_cool: f64,
    pub near_mate: Option<u32>,
    pub near_friend: Option<u32>,
    pub befriend_cool: f64,
    pub shop_open: bool,
    pub shop_msg: String,
    pub inp: Option<(f64, f64)>,
    pub stage: Stage,
    pub cell_id: u32,
}

/// what everybody sees about a player (also drives the HUD)
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct Rec {
    pub id: u32,
    pub n: String,
    pub col: u32,
    pub dna: i64,
    pub pop: i32,
    pub species: i32,
    pub cb: i32,
    pub sc: i32,
    pub pc: i32,
    pub ul: Vec<Epic>,
    pub cs: i32,
    pub nm: bool,
    pub bt: bool,  // an animal nearby could be befriended
    pub bp: i32,   // percent chance
    pub fr: i32,   // friends now
    pub fm: i32,   // friends allowed
    pub bi: u32,   // id of the animal that B would try
    pub dead: bool,
    pub ext: bool,
    pub shop: bool,
    pub msg: String,
    pub tr: Traits,
    pub mass: i64,
    pub st: Stage,
    pub x: f64,
    pub y: f64,
}

/// visual / audio events, queued for everybody
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "k")]
pub enum Fx {
    #[serde(rename = "b")]
    Burst { w: u8, x: f64, y: f64, c: u32, n: u32, s: f64 },
    #[serde(rename = "s")]
    Sfx { p: u32, a: (f64, f64, String, f64, f64), d: f64 },
    #[serde(rename = "sh")]
    Shake { p: u32, ms: f64, i: f64 },
    #[serde(rename = "t")]
    Toast { p: u32, m: String, s: f64 },
}

#[derive(Serialize, Deserialize)]
pub struct Snap {
    pub t: String,
    pub to: u32,
    pub w: u8,
    pub c: Vec<Vec<f64>>,
    pub pe: Vec<(usize, f64, f64, f64)>,
    pub m: Vec<(f64, f64, f64)>,
    pub tx: Vec<(f64, f64, f64, f64)>,
    pub pl: Vec<Rec>,
    pub ev: Vec<Fx>,
}
