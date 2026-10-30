//! The HUD and the evolution shop, drawn on the same canvas. Buttons register a hit area
//! while they are drawn, so a click is matched against what was on screen that frame.
use crate::model::*;
use crate::render::G;
use crate::util::*;

#[derive(Clone, Debug, PartialEq)]
pub enum Act {
    Breed,
    Split,
    Poison,
    Befriend,
    Leave,
    Buy(&'static str, i32),
    Diet(Diet),
    Look(&'static str),
    CloseShop,
}

struct Btn {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    act: Act,
}

pub struct PlayerRow {
    pub n: String,
    pub pop: i32,
    pub mass: i64,
    pub species: i32,
    pub st: Stage,
    pub me: bool,
}

pub struct Hud {
    pub connecting: bool,
    pub net_down: bool,
    pub room: String,
    pub rec: Option<Rec>,
    pub players: Vec<PlayerRow>,
    pub toast: String,
    pub toast_alpha: f64,
    pub key_breed: String,
    pub key_split: String,
    pub key_poison: String,
    pub key_befriend: String,
    pub scroll: (f64, f64),
}

struct Speck {
    x: f64,
    y: f64,
    z: f64,
    r: f64,
    ph: f64,
}
struct Bubble {
    x: f64,
    y: f64,
    r: f64,
    s: f64,
}

pub struct Ui {
    btns: Vec<Btn>,
    specks: Vec<Speck>,
    bubbles: Vec<Bubble>,
}

impl Ui {
    pub fn new() -> Ui {
        Ui {
            btns: Vec::new(),
            specks: (0..90).map(|_| Speck { x: rand01(), y: rand01(), z: rand(0.08, 0.6), r: rand(1.0, 3.0), ph: rand(0.0, TAU) }).collect(),
            bubbles: (0..24).map(|_| Bubble { x: rand01(), y: rand01(), r: rand(2.0, 7.0), s: rand(0.02, 0.07) }).collect(),
        }
    }

    pub fn click(&self, px: f64, py: f64) -> Option<Act> {
        self.btns.iter().rev().find(|b| px >= b.x - b.w / 2.0 && px <= b.x + b.w / 2.0 && py >= b.y - b.h / 2.0 && py <= b.y + b.h / 2.0).map(|b| b.act.clone())
    }

    fn button(&mut self, g: &G, x: f64, y: f64, w: f64, h: f64, fill: u32, edge: u32, label: &str, size: f64, ok: bool, act: Act) {
        g.rect(x - w / 2.0, y - h / 2.0, w, h, fill, 1.0);
        g.stroke_style(2.0, edge, 0.85);
        g.ctx.stroke_rect(x - w / 2.0, y - h / 2.0, w, h);
        g.text(label, x, y, size, true, if ok { 0xe8fffb } else { 0x5d7f86 }, "center", None);
        self.btns.push(Btn { x, y, w, h, act });
    }

    pub fn draw(&mut self, g: &G, hud: &Hud, stage: Stage, size: (f64, f64), t: f64, dt: f64) {
        self.btns.clear();
        let (w, h) = size;
        let land = stage == Stage::Land;

        // parallax plankton specks (pollen on land) + rising bubbles (water only)
        for s in &self.specks {
            let (sx, sy) = (hud.scroll.0 * s.z * 0.6, hud.scroll.1 * s.z * 0.6);
            let x = (((s.x * w - sx + (t * 0.3 + s.ph).sin() * 12.0) % w) + w) % w;
            let y = (((s.y * h - sy + (t * 0.25 + s.ph).cos() * 12.0) % h) + h) % h;
            g.circle(x, y, s.r * (0.6 + s.z), if land { 0xfff2b0 } else { 0xbffff3 }, 0.1 + s.z * 0.35);
        }
        if !land {
            for b in self.bubbles.iter_mut() {
                b.y -= b.s * dt;
                if b.y < -0.05 {
                    b.y = 1.05;
                    b.x = rand01();
                }
                let x = b.x * w + (t + b.x * 10.0).sin() * 10.0;
                g.ring(x, b.y * h, b.r, 1.5, 0xbffff3, 0.35);
                g.circle(x - b.r * 0.3, b.y * h - b.r * 0.3, b.r * 0.3, 0xffffff, 0.15);
            }
        }

        let note = if hud.net_down { "Disconnected from the room\nreload to rejoin" } else if hud.connecting || hud.rec.is_none() { "Joining room..." } else { "" };
        g.text_lines(note, w / 2.0, h / 2.0, 30.0, true, 0xffd0ec, "center", Some((0x03222e, 6.0)));
        let Some(r) = hud.rec.as_ref() else { return };
        let multi = !hud.room.is_empty();
        let shop = r.shop && !r.dead;
        let full_water = r.st == Stage::Water && r.pop >= POP_MAX && !r.dead && !r.ext;

        if !shop {
            g.text(&format!("POINTS  {}", r.dna), 24.0, 33.0, 26.0, true, 0xe8fffb, "left", None);
            g.text(&format!("{}SPECIES #{}", if land { "LAND " } else { "" }, r.species), 24.0, 61.0, 14.0, false, 0x8fd9cf, "left", None);
            let hint = if land {
                "Breed with your own kind (pink ring)  •  befriend animals with B: Charm helps".to_string()
            } else if r.pop < POP_MAX {
                format!("Find your kind (pink ring) to breed  •  at {POP_MAX} members, breed again to evolve onto land")
            } else {
                "Full strength! Breed once more to evolve onto land".to_string()
            };
            g.text(&hint, 24.0, 118.0, 12.0, false, 0x6fb5ab, "left", None);
            g.text(&if multi { format!("ROOM  {}", hud.room) } else { "SOLO".into() }, w - 20.0, 24.0, 16.0, true, 0xb7fff0, "right", None);
            g.text("LEAVE", w - 20.0, 47.0, 13.0, true, 0xff8fa3, "right", None);
            self.btns.push(Btn { x: w - 40.0, y: 47.0, w: 70.0, h: 22.0, act: Act::Leave });
            if multi {
                g.text("LEADERBOARD", w - 20.0, 72.0, 12.0, true, 0x6fb5ab, "right", None);
                for (i, p) in hud.players.iter().take(10).enumerate() {
                    let line = format!("{}{}. {}   {}#{}  {}  {}", if p.me { "▸ " } else { "" }, i + 1, p.n, if p.st == Stage::Land { "🌿 " } else { "" }, p.species, p.mass, "●".repeat(p.pop.max(0) as usize));
                    g.text(&line, w - 20.0, 92.0 + i as f64 * 22.0, 14.0, false, 0x8fd9cf, "right", None);
                }
            }
        }
        // points + species count
        if !shop {
            for i in 0..POP_MAX {
                let x = 32.0 + i as f64 * 26.0;
                if i < r.pop {
                    g.circle(x, 94.0, 9.0, if land { 0xffb74d } else { 0x4fc3f7 }, 1.0);
                    g.ring(x, 94.0, 9.0, 2.0, 0xe8fffb, 0.8);
                } else {
                    g.ring(x, 94.0, 9.0, 2.0, 0x8fd9cf, 0.4);
                }
            }
        }

        if land && !shop {
            g.text(&format!("FRIENDS  {} / {}", r.fr, r.fm), 24.0, 136.0, 13.0, true, 0xff8fd0, "left", None);
        }
        let can_breed = !r.dead && r.nm && r.cb <= 0 && !r.shop;
        if !shop && !r.dead {
            if land && r.bt {
                self.button(g, w / 2.0, h - 150.0, 330.0, 50.0, 0x8a2f6a, 0xffd0ec, &format!("BEFRIEND {}%  ({})", r.bp, hud.key_befriend), 19.0, true, Act::Befriend);
            }
            if can_breed {
                self.button(g, w / 2.0, h - 80.0, 220.0, 56.0, 0xb03a86, 0xffd0ec, &if full_water { format!("BREED & EVOLVE  ({})", hud.key_breed) } else { format!("BREED  ({})", hud.key_breed) }, 22.0, true, Act::Breed);
            } else if r.nm && r.cb > 0 {
                g.text(&format!("Resting... {}s", r.cb), w / 2.0, h - 80.0, 22.0, true, 0xffb3e0, "center", Some((0x2a0a14, 5.0)));
            }
            let (split_name, poison_name) = if land { ("PACK", "SPIT") } else { ("SPLIT", "POISON") };
            if r.sc <= 0 && r.mass as f64 >= SPLIT_MIN_MASS && r.cs < r.tr.mitosis {
                self.button(g, w - 85.0, h - 150.0, 150.0, 52.0, 0x2b6cb0, 0xbfe3ff, &format!("{split_name}  ({})", hud.key_split), 18.0, true, Act::Split);
            }
            if r.pc <= 0 && r.tr.venom > 0 {
                self.button(g, w - 85.0, h - 210.0, 150.0, 52.0, 0x2f8f2f, 0xc8ffb0, &format!("{poison_name}  ({})", hud.key_poison), 18.0, true, Act::Poison);
            }
        }
        if !hud.toast.is_empty() && hud.toast_alpha > 0.0 {
            g.ctx.set_global_alpha(hud.toast_alpha.clamp(0.0, 1.0));
            g.text_lines(&hud.toast, w / 2.0, h * 0.28, 56.0 * (1.0 + (1.0 - hud.toast_alpha) * 0.2), true, 0xb7fff0, "center", Some((0x03222e, 8.0)));
            g.ctx.set_global_alpha(1.0);
        }
        if r.dead {
            g.rect(0.0, 0.0, w, h, 0x2a0a14, 0.35);
            let msg = if r.ext { "Your species went extinct...\na new one begins".to_string() } else { format!("You were eaten...\n{} left in your species", r.pop) };
            g.text_lines(&msg, w / 2.0, h / 2.0, 36.0, true, 0xff8fa3, "center", Some((0x2a0a14, 6.0)));
        }
        if shop {
            g.rect(0.0, 0.0, w, h, 0x000000, 0.45);
            self.draw_shop(g, r, size);
        }
    }

    fn draw_shop(&mut self, g: &G, r: &Rec, size: (f64, f64)) {
        let (w, h) = size;
        let pw = 720.0;
        let land = r.st == Stage::Land;
        let shown: Vec<&TraitDef> = trait_defs(r.st).iter().filter(|t| t.epic.is_none_or(|e| r.ul.contains(&e))).collect();
        let row_h = 62.0;
        let top = 100.0;
        let ph = top + (shown.len() + 2) as f64 * row_h + 70.0;
        let s = 1f64.min((h - 16.0) / ph).min((w - 16.0) / pw);
        let (cx, cy) = (w / 2.0, h / 2.0);
        // local panel coordinates -> screen
        let sx = |x: f64| cx + x * s;
        let sy = |y: f64| cy + y * s;
        let (bg, edge, ac) = if land { (0x10260f, 0xa6e86a, 0xffe9a8) } else { (0x03222e, 0x4cffd0, 0xb7fff0) };
        g.rect(sx(-pw / 2.0), sy(-ph / 2.0), pw * s, ph * s, bg, 0.96);
        g.stroke_style(2.0, edge, 0.7);
        g.ctx.stroke_rect(sx(-pw / 2.0), sy(-ph / 2.0), pw * s, ph * s);
        g.text(if land { "EVOLVE  (land)" } else { "EVOLVE" }, sx(0.0), sy(-ph / 2.0 + 28.0), 28.0 * s, true, ac, "center", None);
        g.text(&format!("{}   •   species {} / {}   •   points {}", r.msg, r.pop, POP_MAX, r.dna), sx(0.0), sy(-ph / 2.0 + 62.0), 14.0 * s, false, 0xffb3e0, "center", None);

        let btn_fill = |ok: bool| if ok { if land { 0x3d7a1f } else { 0x15806a } } else { 0x12262e };
        let unlocked = &r.ul;
        for (i, t) in shown.iter().enumerate() {
            let y = -ph / 2.0 + top + i as f64 * row_h + 24.0;
            let (name, desc) = t.label(r.st);
            g.text(name, sx(-pw / 2.0 + 24.0), sy(y - 14.0), 18.0 * s, true, 0xe8fffb, "left", None);
            wrap_text(g, desc, sx(-pw / 2.0 + 24.0), sy(y + 10.0), 330.0 * s, 12.0 * s, 0x8fd9cf);
            let cur = r.tr.get(t.key);
            let max = t.max_for(unlocked);
            let val = if t.min < 0 { if cur == 0 { "Normal".to_string() } else if cur > 0 { format!("Bigger +{cur}") } else { format!("Smaller {cur}") } } else { format!("{cur} / {max}") };
            g.text(&val, sx(pw / 2.0 - 250.0), sy(y), 14.0 * s, false, ac, "center", None);
            if t.min < 0 {
                let to = cur - 1;
                let can = to >= t.min;
                let ok = can && r.dna >= t.cost(to) as i64;
                let label = if can { format!("Smaller {}", t.cost(to)) } else { "MIN".into() };
                self.button(g, sx(pw / 2.0 - 170.0), sy(y), 84.0 * s, 36.0 * s, btn_fill(ok), edge, &label, 15.0 * s, ok, Act::Buy(t.key, -1));
            }
            let to = cur + 1;
            let can = to <= max;
            let ok = can && r.dna >= t.cost(to) as i64;
            let label = if can { format!("{} {}", if t.min < 0 { "Bigger" } else { "Buy" }, t.cost(to)) } else { "MAX".into() };
            self.button(g, sx(pw / 2.0 - 70.0), sy(y), 100.0 * s, 36.0 * s, btn_fill(ok), edge, &label, 15.0 * s, ok, Act::Buy(t.key, 1));
        }
        let y = -ph / 2.0 + top + shown.len() as f64 * row_h + 24.0;
        g.text("Diet", sx(-pw / 2.0 + 24.0), sy(y - 14.0), 18.0 * s, true, 0xe8fffb, "left", None);
        wrap_text(g, "Herbivore: eats only plants. Carnivore: eats only meat, bites faster. Omnivore: eats everything.", sx(-pw / 2.0 + 24.0), sy(y + 10.0), 290.0 * s, 12.0 * s, 0x8fd9cf);
        for (k, d) in DIETS.iter().enumerate() {
            let cur = r.tr.diet == d.diet;
            let ok = cur || r.dna >= d.cost as i64;
            let label = if cur { format!("{} ✓", d.name) } else { format!("{} {}", d.name, d.cost) };
            self.button(g, sx(pw / 2.0 - 330.0 + k as f64 * 110.0), sy(y), 104.0 * s, 36.0 * s, btn_fill(ok), edge, &label, 15.0 * s, ok, Act::Diet(d.diet));
        }
        let y = y + row_h;
        g.text("Look", sx(-pw / 2.0 + 24.0), sy(y - 14.0), 18.0 * s, true, 0xe8fffb, "left", None);
        wrap_text(g, if land { "Free. Colour, eyes, and your body shape: lean is fast but frail, stocky is tough but slow, long reaches far." } else { "Free. Change your colour and how many eyes you have." }, sx(-pw / 2.0 + 24.0), sy(y + 10.0), 290.0 * s, 12.0 * s, 0x8fd9cf);
        g.circle(sx(pw / 2.0 - 390.0), sy(y), 12.0 * s, r.col, 1.0);
        g.ring(sx(pw / 2.0 - 390.0), sy(y), 12.0 * s, 2.0, 0xffffff, 0.8);
        self.button(g, sx(pw / 2.0 - 330.0 + 55.0), sy(y), 104.0 * s, 36.0 * s, btn_fill(true), edge, "Color", 15.0 * s, true, Act::Look("color"));
        self.button(g, sx(pw / 2.0 - 330.0 + 165.0), sy(y), 104.0 * s, 36.0 * s, btn_fill(true), edge, &if r.tr.eyes > 0 { format!("Eyes: {}", r.tr.eyes) } else { "Eyes: auto".into() }, 15.0 * s, true, Act::Look("eyes"));
        if land {
            self.button(g, sx(pw / 2.0 - 330.0 + 275.0), sy(y), 104.0 * s, 36.0 * s, btn_fill(true), edge, &format!("Body: {}", SHAPES[(r.tr.shape.max(0) as usize) % SHAPES.len()]), 13.0 * s, true, Act::Look("shape"));
        }
        let y = ph / 2.0 - 36.0;
        self.button(g, sx(0.0), sy(y), 160.0 * s, 40.0 * s, btn_fill(true), edge, "DONE  (Esc)", 15.0 * s, true, Act::CloseShop);
    }
}

// left-aligned text wrapped to a width, vertically centred on the first line's y
fn wrap_text(g: &G, text: &str, x: f64, y: f64, width: f64, size: f64, color: u32) {
    g.ctx.set_font(&format!("{}px system-ui, sans-serif", size));
    let mut line = String::new();
    let mut yy = y;
    for word in text.split(' ') {
        let test = if line.is_empty() { word.to_string() } else { format!("{line} {word}") };
        let wd = g.ctx.measure_text(&test).map(|m| m.width()).unwrap_or(0.0);
        if wd > width && !line.is_empty() {
            g.text(&line, x, yy, size, false, color, "left", None);
            yy += size * 1.2;
            line = word.to_string();
        } else {
            line = test;
        }
    }
    g.text(&line, x, yy, size, false, color, "left", None);
}
