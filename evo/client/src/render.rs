//! Canvas drawing for both worlds: the pond with its microbes and the land with its animals.
use crate::model::*;
use crate::util::*;
use web_sys::CanvasRenderingContext2d;

pub struct G {
    pub ctx: CanvasRenderingContext2d,
}

impl G {
    pub fn fill_style(&self, color: u32, a: f64) {
        self.ctx.set_fill_style_str(&css(color, a));
    }
    pub fn stroke_style(&self, lw: f64, color: u32, a: f64) {
        self.ctx.set_stroke_style_str(&css(color, a));
        self.ctx.set_line_width(lw);
    }
    pub fn circle(&self, x: f64, y: f64, r: f64, color: u32, a: f64) {
        self.fill_style(color, a);
        self.ctx.begin_path();
        let _ = self.ctx.arc(x, y, r.max(0.01), 0.0, TAU);
        self.ctx.fill();
    }
    pub fn ring(&self, x: f64, y: f64, r: f64, lw: f64, color: u32, a: f64) {
        self.stroke_style(lw, color, a);
        self.ctx.begin_path();
        let _ = self.ctx.arc(x, y, r.max(0.01), 0.0, TAU);
        self.ctx.stroke();
    }
    pub fn line(&self, x0: f64, y0: f64, x1: f64, y1: f64, lw: f64, color: u32, a: f64) {
        self.stroke_style(lw, color, a);
        self.ctx.begin_path();
        self.ctx.move_to(x0, y0);
        self.ctx.line_to(x1, y1);
        self.ctx.stroke();
    }
    pub fn tri(&self, p: [(f64, f64); 3], color: u32, a: f64) {
        self.fill_style(color, a);
        self.ctx.begin_path();
        self.ctx.move_to(p[0].0, p[0].1);
        self.ctx.line_to(p[1].0, p[1].1);
        self.ctx.line_to(p[2].0, p[2].1);
        self.ctx.close_path();
        self.ctx.fill();
    }
    /// full width and height, like Phaser's fillEllipse
    pub fn ellipse(&self, x: f64, y: f64, w: f64, h: f64, color: u32, a: f64) {
        self.fill_style(color, a);
        self.ctx.begin_path();
        let _ = self.ctx.ellipse(x, y, (w / 2.0).max(0.01), (h / 2.0).max(0.01), 0.0, 0.0, TAU);
        self.ctx.fill();
    }
    pub fn rect(&self, x: f64, y: f64, w: f64, h: f64, color: u32, a: f64) {
        self.fill_style(color, a);
        self.ctx.fill_rect(x, y, w, h);
    }
    pub fn path(&self, pts: &[(f64, f64)], close: bool) {
        self.ctx.begin_path();
        for (i, p) in pts.iter().enumerate() {
            if i == 0 {
                self.ctx.move_to(p.0, p.1);
            } else {
                self.ctx.line_to(p.0, p.1);
            }
        }
        if close {
            self.ctx.close_path();
        }
    }
    pub fn text(&self, s: &str, x: f64, y: f64, size: f64, bold: bool, color: u32, align: &str, outline: Option<(u32, f64)>) {
        let ctx = &self.ctx;
        ctx.set_font(&format!("{}{}px system-ui, sans-serif", if bold { "bold " } else { "" }, size));
        ctx.set_text_align(align);
        ctx.set_text_baseline("middle");
        if let Some((oc, ow)) = outline {
            ctx.set_line_join("round");
            self.stroke_style(ow, oc, 1.0);
            let _ = ctx.stroke_text(s, x, y);
        }
        self.fill_style(color, 1.0);
        let _ = ctx.fill_text(s, x, y);
    }
    /// multi-line, centred on y
    pub fn text_lines(&self, s: &str, x: f64, y: f64, size: f64, bold: bool, color: u32, align: &str, outline: Option<(u32, f64)>) {
        let lines: Vec<&str> = s.split('\n').collect();
        let lh = size * 1.25;
        let top = y - lh * (lines.len() as f64 - 1.0) / 2.0;
        for (i, l) in lines.iter().enumerate() {
            self.text(l, x, top + i as f64 * lh, size, bold, color, align, outline);
        }
    }
}

pub struct Scene<'a> {
    pub stage: Stage,
    pub cells: Vec<&'a Cell>,
    pub food: &'a [Food],
    pub toxins: Vec<(f64, f64, f64, f64)>, // x, y, r, alpha
    pub particles: &'a [Particle],
    pub cam: (f64, f64),
    pub zoom: f64,
    pub size: (f64, f64),
    pub t: f64,
    pub show_names: bool,
    pub breed_ready: bool,
}

pub fn draw_world(g: &G, sc: &Scene) {
    let ctx = &g.ctx;
    let (w, h) = sc.size;
    ctx.clear_rect(0.0, 0.0, w, h);
    ctx.save();
    let _ = ctx.translate(w / 2.0, h / 2.0);
    let _ = ctx.scale(sc.zoom, sc.zoom);
    let _ = ctx.translate(-sc.cam.0, -sc.cam.1);
    let view = View { x: sc.cam.0 - w / 2.0 / sc.zoom, y: sc.cam.1 - h / 2.0 / sc.zoom, w: w / sc.zoom, h: h / sc.zoom };
    let (cx, cy) = sc.cam;
    match sc.stage {
        Stage::Water => draw_pond_floor(g, sc, &view),
        Stage::Land => draw_land_floor(g, sc, &view),
    }
    let in_view = |x: f64, y: f64, m: f64| x > view.x - m && x < view.x + view.w + m && y > view.y - m && y < view.y + view.h + m;
    for f in sc.food {
        let fx = cx + wrap_d(f.x - cx);
        let fy = cy + wrap_d(f.y - cy);
        if !in_view(fx, fy, 30.0) {
            continue;
        }
        let bob = f.bob.sin() * 2.0;
        match (sc.stage, f.kind) {
            (Stage::Water, 0) => {
                g.circle(fx, fy + bob, f.size * 2.6, 0x6bff7a, 0.14);
                g.circle(fx, fy + bob, f.size, 0x4cdc6a, 1.0);
                g.circle(fx - f.size * 0.3, fy + bob - f.size * 0.3, f.size * 0.4, 0xb9ffc4, 0.8);
            }
            (Stage::Land, 0) => {
                // a berry bush
                g.ellipse(fx, fy + f.size * 0.9, f.size * 3.0, f.size * 1.0, 0x000000, 0.18);
                g.circle(fx, fy + bob * 0.4, f.size * 1.5, 0x2e7d32, 1.0);
                g.circle(fx - f.size * 0.5, fy - f.size * 0.3, f.size * 1.0, 0x43a047, 1.0);
                for k in 0..3 {
                    let a = f.bob * 0.0 + k as f64 * 2.1 + f.size;
                    g.circle(fx + a.cos() * f.size * 0.8, fy + a.sin() * f.size * 0.8, f.size * 0.3, 0xe53950, 1.0);
                }
            }
            (Stage::Water, _) => {
                g.circle(fx, fy + bob, f.size * 2.2, 0xff4d6d, 0.16);
                g.circle(fx, fy + bob, f.size, 0xe8566f, 1.0);
                g.circle(fx + f.size * 0.25, fy + bob - f.size * 0.2, f.size * 0.4, 0xffb3c0, 0.7);
                g.circle(fx - f.size * 0.3, fy + bob + f.size * 0.3, f.size * 0.3, 0xa8243e, 0.9);
            }
            (Stage::Land, _) => {
                g.circle(fx, fy + bob, f.size * 2.0, 0xff4d6d, 0.14);
                g.circle(fx, fy + bob, f.size, 0xc2475a, 1.0);
                g.circle(fx + f.size * 0.25, fy + bob - f.size * 0.2, f.size * 0.4, 0xffb3c0, 0.7);
                g.circle(fx - f.size * 0.9, fy + bob - f.size * 0.4, f.size * 0.28, 0xf5efe0, 1.0); // a bone end
                g.circle(fx - f.size * 1.15, fy + bob - f.size * 0.2, f.size * 0.22, 0xf5efe0, 1.0);
            }
        }
    }
    for &(tx, ty, r, a) in &sc.toxins {
        let (tx, ty) = (cx + wrap_d(tx - cx), cy + wrap_d(ty - cy));
        if !in_view(tx, ty, r) {
            continue;
        }
        let (c1, c2) = if sc.stage == Stage::Water { (0x7dff3a, 0xb6ff7a) } else { (0xc8d23a, 0xeeff8a) };
        g.circle(tx, ty, r, c1, 0.12 + 0.2 * a);
        g.circle(tx, ty, r * 0.55, c2, 0.1 + 0.2 * a);
    }

    let mut cells: Vec<&Cell> = sc.cells.clone();
    cells.sort_by(|a, b| a.mass.partial_cmp(&b.mass).unwrap_or(std::cmp::Ordering::Equal));
    for c in cells {
        let (x, y) = (cx + wrap_d(c.x - cx), cy + wrap_d(c.y - cy));
        let rad = radius(c.mass);
        if !in_view(x, y, rad * 3.0) {
            continue;
        }
        match sc.stage {
            Stage::Water => draw_microbe(g, sc, c, x, y),
            Stage::Land => draw_animal(g, sc, c, x, y),
        }
        if c.epic.is_some() || c.shock_lvl > 0 || c.toxic_lvl > 0 || c.fins_lvl > 0 {
            draw_epic(g, sc, c, x, y);
        }
        if c.hpf < 0.99 {
            let w = rad * 1.6;
            let yy = y - rad * 1.5;
            g.rect(x - w / 2.0, yy, w, 5.0, 0x2a0a14, 0.7);
            g.rect(x - w / 2.0, yy, w * c.hpf, 5.0, if c.psn { 0x7dff3a } else { 0xff4d6d }, 1.0);
        }
        if c.is_player() && !c.name.is_empty() && sc.show_names {
            g.text(&c.name, x, y - rad * 1.8 - 14.0, 16.0, false, 0xe8fffb, "center", Some((0x03222e, 4.0)));
        }
    }
    for p in sc.particles {
        let a = (p.life / 0.9).max(0.0);
        g.circle(cx + wrap_d(p.x - cx), cy + wrap_d(p.y - cy), p.size * (0.4 + a), p.color, a * 0.9);
    }
    ctx.restore();
}

struct View {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

fn draw_pond_floor(g: &G, sc: &Scene, v: &View) {
    let (cx, cy) = sc.cam;
    g.rect(v.x, v.y, v.w, v.h, 0x03222e, 0.55);
    for i in 0..70 {
        // slow drifting caustic blobs (deterministic so they don't flicker)
        let bx = cx + wrap_d(((i * 977) % 8000) as f64 + (sc.t * 0.2 + i as f64).sin() * 60.0 - cx);
        let by = cy + wrap_d(((i * 1543) % 8000) as f64 + (sc.t * 0.17 + i as f64 * 2.0).cos() * 60.0 - cy);
        let br = 120.0 + (i % 5) as f64 * 50.0;
        if bx < v.x - br || bx > v.x + v.w + br || by < v.y - br || by > v.y + v.h + br {
            continue;
        }
        g.circle(bx, by, br, 0x2fd6c0, 0.035);
        g.circle(bx, by, br * 0.6, 0x2fd6c0, 0.03);
    }
}

fn draw_land_floor(g: &G, sc: &Scene, v: &View) {
    let (cx, cy) = sc.cam;
    g.rect(v.x, v.y, v.w, v.h, 0x4a7a35, 1.0);
    let at = |ox: f64, oy: f64| (cx + wrap_d(ox - cx), cy + wrap_d(oy - cy));
    let vis = |x: f64, y: f64, m: f64| x > v.x - m && x < v.x + v.w + m && y > v.y - m && y < v.y + v.h + m;
    // big soft patches of meadow, dirt and shade
    for i in 0..110u32 {
        let (x, y) = at(((i * 977 + 131) % 8000) as f64, ((i * 1543 + 517) % 8000) as f64);
        let r = 140.0 + (i % 5) as f64 * 60.0;
        if !vis(x, y, r) {
            continue;
        }
        let col = [0x3b6a2a, 0x5a8f3c, 0x8a7440, 0x35602a, 0x6a9a44][(i % 5) as usize];
        g.circle(x, y, r, col, 0.42);
        g.circle(x, y, r * 0.6, col, 0.3);
    }
    // a few ponds so the land still remembers where it came from
    for i in 0..9u32 {
        let (x, y) = at(((i * 3301 + 700) % 8000) as f64, ((i * 2111 + 1900) % 8000) as f64);
        let r = 150.0 + (i % 3) as f64 * 55.0;
        if !vis(x, y, r) {
            continue;
        }
        g.ellipse(x, y, r * 2.1, r * 1.5, 0x2a6f8a, 0.55);
        g.ellipse(x, y, r * 1.6, r * 1.1, 0x3b8fb0, 0.45);
    }
    for i in 0..320u32 {
        let (x, y) = at(((i * 1237 + 311) % 8000) as f64, ((i * 2711 + 97) % 8000) as f64);
        if !vis(x, y, 20.0) {
            continue;
        }
        let sway = (sc.t * 1.5 + i as f64).sin() * 3.0;
        for k in -1..=1 {
            g.line(x + k as f64 * 5.0, y, x + k as f64 * 8.0 + sway, y - 16.0 - (i % 4) as f64 * 3.0, 2.0, 0x2f5a22, 0.8);
        }
    }
    for i in 0..60u32 {
        let (x, y) = at(((i * 2399 + 211) % 8000) as f64, ((i * 1087 + 1301) % 8000) as f64);
        if !vis(x, y, 60.0) {
            continue;
        }
        let r = 14.0 + (i % 4) as f64 * 9.0;
        g.ellipse(x + 4.0, y + 6.0, r * 2.4, r * 1.5, 0x000000, 0.18);
        g.ellipse(x, y, r * 2.2, r * 1.5, 0x8a8f96, 1.0);
        g.ellipse(x - r * 0.3, y - r * 0.3, r * 1.0, r * 0.6, 0xc3c8cf, 0.8);
    }
    for i in 0..160u32 {
        let (x, y) = at(((i * 1709 + 53) % 8000) as f64, ((i * 3259 + 701) % 8000) as f64);
        if !vis(x, y, 10.0) {
            continue;
        }
        g.circle(x, y, 3.2, [0xffe066, 0xff8fd0, 0xffffff, 0xb28dff][(i % 4) as usize], 0.9);
    }
}

// glows and effects for epics and the traits they grant
fn draw_epic(g: &G, sc: &Scene, c: &Cell, x: f64, y: f64) {
    let t = sc.t;
    let rr = radius(c.mass);
    let pulse = 0.5 + 0.5 * (t * 5.0 + c.seed).sin();
    let col = c.epic.map(|e| e.color(sc.stage)).unwrap_or(if c.shock_lvl > 0 { 0x6bf3ff } else if c.toxic_lvl > 0 { 0x3cff3c } else { 0xff9a2e });
    if c.epic.is_some() {
        g.ring(x, y, rr * (1.5 + 0.12 * pulse), 3.0, col, 0.5 + 0.4 * pulse);
        g.ring(x, y, rr * (1.85 + 0.12 * pulse), 2.0, 0xffffff, 0.25 + 0.25 * pulse);
    }
    if c.toxic_lvl > 0 {
        for i in 0..6 {
            let a = (i as f64 / 6.0) * TAU + t;
            g.circle(x + a.cos() * rr * 1.2, y + a.sin() * rr * 1.2, rr * 0.12, 0x3cff3c, 0.5 + 0.3 * pulse);
        }
    }
    if c.shock_lvl > 0 {
        // crackling arcs out to the zap radius
        let reach = rr + 90.0 + 55.0 * c.shock_lvl as f64;
        g.ring(x, y, reach * (0.9 + 0.1 * pulse), 2.0, 0xfff36b, 0.35 + 0.4 * pulse);
        for _ in 0..3 {
            let mut a = rand01() * TAU;
            let (mut px, mut py) = (x + a.cos() * rr, y + a.sin() * rr);
            let mut pts = vec![(px, py)];
            for _ in 0..4 {
                a += rand(-0.7, 0.7);
                px += a.cos() * reach * 0.22;
                py += a.sin() * reach * 0.22;
                pts.push((px, py));
            }
            g.stroke_style(2.0, 0xfff9b0, 0.8);
            g.path(&pts, false);
            g.ctx.stroke();
        }
    }
    if c.fins_lvl > 0 && sc.stage == Stage::Water {
        // fins swept back from both sides
        let fl = rr * (0.7 + 0.12 * (c.fins_lvl.min(5)) as f64);
        for side in [-1.0, 1.0] {
            let a = c.angle + side * (PI / 2.0);
            let (bx, by) = (x + a.cos() * rr * 0.9, y + a.sin() * rr * 0.9);
            let back = c.angle + PI + side * 0.6;
            g.tri([(bx, by), (bx + back.cos() * fl, by + back.sin() * fl), (bx + a.cos() * fl * 0.5, by + a.sin() * fl * 0.5)], 0xffb347, 0.85);
        }
    }
    if c.fins_lvl > 0 && sc.stage == Stage::Land {
        // dust kicked up behind a sprinter
        for k in 0..4 {
            let back = c.angle + PI;
            let d = rr * (1.3 + k as f64 * 0.5) + (t * 6.0 + k as f64).sin() * 4.0;
            g.circle(x + back.cos() * d, y + back.sin() * d, rr * (0.25 - k as f64 * 0.04), 0xd9c8a0, 0.35 * c.sp);
        }
    }
    if let Some(e) = c.epic {
        g.text(&format!("★ {}", e.name(sc.stage).to_uppercase()), x, y - rr * 2.0 - 12.0, 14.0, true, 0xffe9a8, "center", Some((0x2a0a14, 4.0)));
    }
}

// ---- the microbe ---------------------------------------------------------------
fn draw_microbe(g: &G, sc: &Scene, c: &Cell, x: f64, y: f64) {
    let rr = radius(c.mass);
    let t = sc.t;
    let sp = c.sp;
    let (ca, sa) = (c.angle.cos(), c.angle.sin());
    let to = |lx: f64, ly: f64| (x + lx * ca - ly * sa, y + lx * sa + ly * ca);
    // your diet tints the body: plant eaters go green, meat eaters go red
    let col = match c.diet {
        Diet::Herb => mix_color(c.color, 0x5fe07a, 0.45),
        Diet::Carn => mix_color(c.color, 0xe8505a, 0.45),
        Diet::Omni => c.color,
    };
    let spike_lvl = if c.spikes > 0 { (c.spikes - 2) as f64 / 3.0 } else { 0.0 };
    let light = shade(col, 0.45);
    let dark = shade(col, -0.45);
    let el = c.elong;

    // aura (the player glows brighter so you never lose yourself)
    let aura = if c.local { 0.12 } else if c.is_player() { 0.09 } else { 0.05 };
    g.circle(x, y, rr * 1.7, col, aura);
    g.circle(x, y, rr * 1.3, col, aura);
    if c.is_mate() && sc.breed_ready {
        g.ring(x, y, rr * (1.5 + 0.1 * (t * 5.0).sin()), 3.0, 0xff8fd0, 0.5 + 0.4 * (t * 5.0).sin());
    }
    if c.psn {
        g.circle(x, y, rr * 1.15, 0x7dff3a, 0.22);
    }
    if c.pulse > 0.0 {
        g.ring(x, y, rr * (1.2 + (1.0 - c.pulse) * 2.5), 4.0, 0xb7fff0, c.pulse);
    }

    // flagella: sine-wave tails trailing behind
    for f in 0..c.flagella {
        let off = (f as f64 - (c.flagella as f64 - 1.0) / 2.0) * 0.5;
        let segs = 12;
        let len = rr * (1.6 + 0.4 * c.speed_lvl as f64 + sp * 0.6);
        let mut prev = to(-rr * el * 0.9, off * rr * 0.6);
        for s in 1..=segs {
            let u = s as f64 / segs as f64;
            let wave = (t * (7.0 + sp * 8.0) - u * 6.0 + f as f64 * 1.7 + c.seed).sin() * rr * 0.35 * u;
            let next = to(-rr * el * 0.9 - u * len, off * rr * 0.6 + wave);
            g.line(prev.0, prev.1, next.0, next.1, (rr * 0.16 * (1.0 - u)).max(1.0), light, 0.75 * (1.0 - u * 0.6));
            prev = next;
        }
    }

    // spikes
    if c.spikes > 0 {
        for s in 0..c.spikes {
            let a = (s as f64 / c.spikes as f64) * TAU + (t + s as f64).sin() * 0.04;
            if a.cos() > 0.8 {
                continue; // keep the mouth clear
            }
            let a2 = TAU / c.spikes as f64 / 4.0;
            let p0 = to((a - a2).cos() * rr * el * 0.95, (a - a2).sin() * rr * 0.95);
            let reach = 1.25 + 0.15 * spike_lvl;
            let p1 = to(a.cos() * rr * el * reach, a.sin() * rr * reach);
            let p2 = to((a + a2).cos() * rr * el * 0.95, (a + a2).sin() * rr * 0.95);
            g.tri([p0, p1, p2], dark, 1.0);
        }
    }

    // cilia
    for i in 0..22 {
        let a = (i as f64 / 22.0) * TAU;
        let w = (t * 9.0 + i as f64 * 1.3 + c.seed).sin() * 0.25;
        let p0 = to(a.cos() * rr * el, a.sin() * rr);
        let p1 = to((a + w).cos() * rr * el * 1.22, (a + w).sin() * rr * 1.22);
        g.line(p0.0, p0.1, p1.0, p1.1, (rr * 0.05).max(1.0), light, 0.5);
    }

    // wobbling membrane
    let n = 40;
    let tough = c.tough as f64;
    let pts: Vec<(f64, f64)> = (0..n)
        .map(|i| {
            let a = (i as f64 / n as f64) * TAU;
            let wob = 1.0
                + (0.05 * (a * 3.0 + t * 2.2 + c.seed).sin()
                    + 0.03 * (a * 5.0 - t * 3.1 + c.seed * 2.0).sin()
                    + if c.bite > 0.0 { 0.06 * (a * 2.0 + t * 30.0).sin() * (c.bite / 0.35) } else { 0.0 })
                    * (1.0 - 0.25 * tough);
            to(a.cos() * rr * el * wob * (1.0 + 0.1 * sp), a.sin() * rr * wob * (1.0 - 0.08 * sp))
        })
        .collect();
    g.path(&pts, true);
    g.fill_style(col, (0.82 + 0.06 * tough).min(1.0));
    g.ctx.fill();
    let rim = if c.venom_lvl > 0 { mix_color(light, 0x7dff3a, 0.25 * c.venom_lvl as f64) } else { light };
    g.stroke_style((rr * 0.1 * (1.0 + 0.9 * tough)).max(2.0), rim, 0.95);
    g.path(&pts, true);
    g.ctx.stroke();
    // thick membrane = a hard, plated wall instead of soft jelly: dark segment seams around the rim
    if c.tough > 0 {
        let seams = 8 + 4 * c.tough;
        for k in 0..seams {
            let a = (k as f64 / seams as f64) * TAU;
            let p0 = to(a.cos() * rr * el * 0.8, a.sin() * rr * 0.8);
            let p1 = to(a.cos() * rr * el * 0.99, a.sin() * rr * 0.99);
            g.line(p0.0, p0.1, p1.0, p1.1, (rr * 0.05).max(1.5), shade(col, -0.55), 0.8);
        }
        let ring: Vec<(f64, f64)> = (0..=36).map(|k| { let a = (k as f64 / 36.0) * TAU; to(a.cos() * rr * el * 0.8, a.sin() * rr * 0.8) }).collect();
        g.stroke_style((rr * 0.04).max(1.5), shade(col, -0.55), 0.8);
        g.path(&ring, false);
        g.ctx.stroke();
    }
    // inner membrane + specular highlight
    if c.tough == 0 {
        g.ring(x, y, rr * 0.78, 1.5, light, 0.35);
    }
    g.ellipse(x - rr * 0.35, y - rr * 0.45, rr * 0.7, rr * 0.35, 0xffffff, 0.22 * (1.0 - 0.3 * tough));

    // organelles drifting inside
    for i in 0..6 {
        let oa = c.seed * 3.0 + i as f64 * 1.9 + (t * 0.6 + i as f64).sin() * 0.3;
        let od = rr * (0.25 + ((i as f64 * 37.0 + c.seed * 11.0) % 40.0) / 100.0);
        let op = to(oa.cos() * od * el - rr * 0.1, oa.sin() * od);
        g.circle(op.0, op.1, rr * (0.06 + (i % 3) as f64 * 0.025), light, 0.5);
    }
    // venom glands
    for i in 0..c.venom_lvl * 2 {
        let va = (i as f64 / (c.venom_lvl * 2) as f64) * TAU + t * 0.5;
        let vp = to(va.cos() * rr * 0.62 * el, va.sin() * rr * 0.62);
        let gr = rr * (0.08 + 0.03 * c.venom_lvl as f64);
        g.circle(vp.0, vp.1, gr * 1.8, 0x7dff3a, 0.25 + 0.15 * (t * 4.0 + i as f64).sin());
        g.circle(vp.0, vp.1, gr, 0x7dff3a, 0.95);
    }
    // chloroplasts: plant eaters carry green spots
    if c.diet == Diet::Herb {
        for i in 0..5 {
            let a = c.seed + i as f64 * 1.26;
            let cp = to(a.cos() * rr * 0.5 * el, a.sin() * rr * 0.5);
            g.ellipse(cp.0, cp.1, rr * 0.2, rr * 0.12, 0x2fae4a, 0.8);
        }
    }
    // nucleus
    let nuc = to(-rr * 0.2, (t * 1.3 + c.seed).sin() * rr * 0.05);
    g.circle(nuc.0, nuc.1, rr * 0.3, dark, 0.55);
    g.ring(nuc.0, nuc.1, rr * 0.3, 1.5, light, 0.5);
    g.circle(nuc.0 - rr * 0.06, nuc.1 - rr * 0.06, rr * 0.1, light, 0.7);

    // eyes track the target direction
    let look = c.looky.atan2(c.lookx) - c.angle;
    for k in 0..c.eyes {
        let side = if k % 2 == 0 { 1.0 } else { -1.0 };
        let tier = ((k + 1) / 2) as f64;
        let (ex, ey) = (rr * el * (0.45 - tier * 0.28), side * rr * (0.4 + tier * 0.15));
        let ep = to(ex, ey);
        let er = rr * 0.2;
        g.circle(ep.0, ep.1, er, 0xffffff, 1.0);
        g.ring(ep.0, ep.1, er, 1.5, dark, 0.8);
        let pp = to(ex + look.cos() * er * 0.45, ey + look.sin() * er * 0.45);
        g.circle(pp.0, pp.1, er * 0.55, 0x0b0f14, 1.0);
        g.circle(pp.0 - er * 0.15, pp.1 - er * 0.2, er * 0.18, 0xffffff, 0.9);
    }

    // mouth
    let open = if c.bite > 0.0 { ((c.bite / 0.35) * PI).sin() } else { 0.08 + 0.04 * (t * 3.0 + c.seed).sin() };
    let m = to(rr * el * 0.92, 0.0);
    let mr = rr * (0.1 + open * 0.28);
    g.circle(m.0, m.1, mr, 0x2a0a14, 1.0);
    g.ring(m.0, m.1, mr, (rr * 0.06).max(1.5), light, 0.9);
    if c.diet == Diet::Carn {
        for s in [-1.0, 1.0] {
            let f0 = to(rr * el * 0.9, s * mr * 0.7);
            let f1 = to(rr * el * 1.12, s * mr * 0.45);
            let f2 = to(rr * el * 0.9, s * mr * 0.15);
            g.tri([f0, f1, f2], 0xffffff, 1.0);
        }
    } else if open > 0.5 {
        for s in [-1.0, 1.0] {
            let tp = to(rr * el * 0.92, s * mr * 0.55);
            g.circle(tp.0, tp.1, rr * 0.04, 0xffffff, 0.9);
        }
    }
    // spawn / shop protection bubble
    if c.shield > 0.0 {
        g.ring(x, y, rr * 1.45, 3.0, 0xffffff, 0.45 + 0.2 * (t * 8.0).sin());
    }
}

// ---- the land animal: a Spore-style critter with a body, head, legs and a tail --------
fn draw_animal(g: &G, sc: &Scene, c: &Cell, x: f64, y: f64) {
    let rr = radius(c.mass);
    let t = sc.t;
    let sp = c.sp;
    let (ca, sa) = (c.angle.cos(), c.angle.sin());
    let to = |lx: f64, ly: f64| (x + lx * ca - ly * sa, y + lx * sa + ly * ca);
    let col = match c.diet {
        Diet::Herb => mix_color(c.color, 0x8bd45a, 0.4),
        Diet::Carn => mix_color(c.color, 0xd0504a, 0.4),
        Diet::Omni => c.color,
    };
    let light = shade(col, 0.4);
    let dark = shade(col, -0.45);
    let len = rr * c.elong * 1.2; // half length of the body
    let wid = rr * 0.82;
    let tough = c.tough as f64;

    // shadow + aura
    g.ellipse(x + rr * 0.15, y + rr * 0.35, len * 2.3, wid * 2.1, 0x000000, 0.2);
    let aura = if c.local { 0.14 } else if c.is_player() { 0.1 } else { 0.0 };
    if aura > 0.0 {
        g.circle(x, y, rr * 1.8, col, aura);
    }
    if c.is_mate() && sc.breed_ready {
        g.ring(x, y, rr * (1.6 + 0.1 * (t * 5.0).sin()), 3.0, 0xff8fd0, 0.5 + 0.4 * (t * 5.0).sin());
    }
    if c.psn {
        g.circle(x, y, rr * 1.2, 0xc8d23a, 0.22);
    }
    if c.pulse > 0.0 {
        g.ring(x, y, rr * (1.3 + (1.0 - c.pulse) * 2.5), 4.0, 0xfff1b0, c.pulse);
    }

    // tail, swaying behind
    let mut prev = to(-len * 0.85, 0.0);
    let tail_len = rr * (1.2 + 0.3 * c.speed_lvl as f64);
    for s in 1..=7 {
        let u = s as f64 / 7.0;
        let sway = (t * (4.0 + sp * 6.0) - u * 3.5 + c.seed).sin() * rr * 0.5 * u;
        let next = to(-len * 0.85 - u * tail_len, sway);
        g.line(prev.0, prev.1, next.0, next.1, (rr * 0.28 * (1.0 - u * 0.75)).max(1.5), dark, 1.0);
        prev = next;
    }
    g.circle(prev.0, prev.1, rr * 0.12, light, 1.0);

    // legs: more legs with the Legs trait; they swing as the animal runs
    let pairs = if c.speed_lvl >= 3 { 3 } else { 2 };
    let hoof = if c.fins_lvl > 0 { 0xffc04a } else { dark };
    for k in 0..pairs {
        let lx = -len * 0.55 + k as f64 * (len * 1.0 / (pairs as f64 - 0.5));
        for s in [-1.0f64, 1.0] {
            let phase = t * (5.0 + sp * 9.0) + k as f64 * 1.9 + if s > 0.0 { 0.0 } else { PI } + c.seed;
            let swing = phase.sin() * rr * 0.4 * (0.25 + sp);
            let hip = to(lx, s * wid * 0.75);
            let knee = to(lx + swing * 0.5, s * (wid + rr * 0.3));
            let foot = to(lx + swing, s * (wid + rr * 0.52));
            g.line(hip.0, hip.1, knee.0, knee.1, rr * 0.2, dark, 1.0);
            g.line(knee.0, knee.1, foot.0, foot.1, rr * 0.16, dark, 1.0);
            g.circle(foot.0, foot.1, rr * 0.12, hoof, 1.0);
        }
    }

    // horns & quills along the back edge
    if c.spikes > 0 {
        let n = 3 + c.spike_lvl * 2;
        for k in 0..n {
            let lx = -len * 0.7 + (k as f64 / (n as f64 - 1.0).max(1.0)) * len * 1.4;
            for s in [-1.0f64, 1.0] {
                let b0 = to(lx - rr * 0.14, s * wid * 0.92);
                let b1 = to(lx + rr * 0.14, s * wid * 0.92);
                let tip = to(lx + rr * 0.05, s * wid * (1.35 + 0.1 * c.spike_lvl as f64));
                g.tri([b0, tip, b1], 0xf2e9d0, 1.0);
            }
        }
    }

    // body
    let n = 36;
    let pts: Vec<(f64, f64)> = (0..n)
        .map(|i| {
            let a = (i as f64 / n as f64) * TAU;
            let breathe = 1.0 + 0.03 * (t * 2.0 + c.seed).sin() + if c.bite > 0.0 { 0.05 * (c.bite / 0.35) } else { 0.0 };
            to(a.cos() * len * breathe, a.sin() * wid * breathe * (1.0 - 0.06 * sp))
        })
        .collect();
    g.path(&pts, true);
    g.fill_style(col, 1.0);
    g.ctx.fill();
    g.stroke_style((rr * 0.1 * (1.0 + 0.8 * tough)).max(2.0), dark, 0.9);
    g.path(&pts, true);
    g.ctx.stroke();
    // belly + fur
    let belly = to(len * 0.05, 0.0);
    g.ellipse(belly.0, belly.1, len * 1.1, wid * 0.9, light, 0.35);
    for i in 0..20 {
        let a = (i as f64 / 20.0) * TAU;
        let p0 = to(a.cos() * len * 0.96, a.sin() * wid * 0.96);
        let p1 = to(a.cos() * len * 1.12, a.sin() * wid * 1.12);
        g.line(p0.0, p0.1, p1.0, p1.1, (rr * 0.05).max(1.0), light, 0.55);
    }
    // thick hide: bony plates across the back
    for k in 0..c.tough * 2 {
        let lx = -len * 0.55 + k as f64 * (len * 1.0 / (c.tough * 2).max(1) as f64);
        let a = to(lx, -wid * 0.8);
        let b = to(lx, wid * 0.8);
        g.line(a.0, a.1, b.0, b.1, (rr * 0.1).max(2.0), shade(col, -0.6), 0.85);
    }
    // stink glands: green pustules on the back
    for i in 0..c.venom_lvl * 2 {
        let p = to(-len * 0.4 + (i as f64) * len * 0.3, if i % 2 == 0 { -wid * 0.4 } else { wid * 0.4 });
        g.circle(p.0, p.1, rr * (0.1 + 0.03 * c.venom_lvl as f64) * 1.7, 0xc8d23a, 0.25 + 0.15 * (t * 4.0 + i as f64).sin());
        g.circle(p.0, p.1, rr * (0.1 + 0.03 * c.venom_lvl as f64), 0xc8d23a, 0.95);
    }
    // plant eaters carry a leafy tuft
    if c.diet == Diet::Herb {
        for i in 0..4 {
            let p = to(-len * 0.3 + i as f64 * len * 0.18, ((i as f64) * 1.7 + c.seed).sin() * wid * 0.35);
            g.ellipse(p.0, p.1, rr * 0.3, rr * 0.16, 0x3f9a45, 0.85);
        }
    }

    // head
    let hc = to(len * 0.85, 0.0);
    let hr = rr * (0.52 + 0.04 * (t * 3.0 + c.seed).sin());
    g.circle(hc.0, hc.1, hr, col, 1.0);
    g.ring(hc.0, hc.1, hr, (rr * 0.08).max(1.5), dark, 0.9);
    // snout, mouth and teeth
    let sn = to(len * 0.85 + hr * 0.9, 0.0);
    let open = if c.bite > 0.0 { ((c.bite / 0.35) * PI).sin() } else { 0.1 };
    g.ellipse(sn.0, sn.1, hr * 1.1, hr * (0.7 + open * 0.5), shade(col, -0.2), 1.0);
    let mouth = to(len * 0.85 + hr * 1.35, 0.0);
    g.circle(mouth.0, mouth.1, hr * (0.12 + open * 0.3), 0x2a0a14, 1.0);
    if c.diet == Diet::Carn {
        for s in [-1.0, 1.0] {
            let f0 = to(len * 0.85 + hr * 1.2, s * hr * 0.32);
            let f1 = to(len * 0.85 + hr * 1.6, s * hr * 0.22);
            let f2 = to(len * 0.85 + hr * 1.2, s * hr * 0.08);
            g.tri([f0, f1, f2], 0xffffff, 1.0);
        }
    }
    // eyes track the target direction
    let look = c.looky.atan2(c.lookx) - c.angle;
    for k in 0..c.eyes {
        let side = if k % 2 == 0 { 1.0 } else { -1.0 };
        let tier = ((k + 1) / 2) as f64;
        let (ex, ey) = (len * 0.85 + hr * (0.25 - tier * 0.32), side * hr * (0.62 + tier * 0.1));
        let ep = to(ex, ey);
        let er = hr * 0.34;
        g.circle(ep.0, ep.1, er, 0xffffff, 1.0);
        g.ring(ep.0, ep.1, er, 1.5, dark, 0.8);
        let pp = to(ex + look.cos() * er * 0.45, ey + look.sin() * er * 0.45);
        g.circle(pp.0, pp.1, er * 0.55, 0x0b0f14, 1.0);
        g.circle(pp.0 - er * 0.15, pp.1 - er * 0.2, er * 0.18, 0xffffff, 0.9);
    }
    // ears
    for s in [-1.0, 1.0] {
        let e = to(len * 0.62, s * hr * 1.0);
        g.circle(e.0, e.1, hr * 0.32, light, 1.0);
        g.circle(e.0, e.1, hr * 0.17, shade(col, -0.2), 1.0);
    }
    if c.shield > 0.0 {
        g.ring(x, y, rr * 1.6, 3.0, 0xffffff, 0.45 + 0.2 * (t * 8.0).sin());
    }
}
