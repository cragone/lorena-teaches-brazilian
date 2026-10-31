//! The tribal stage in the browser: an Age of Empires style view of the tribes' world. It sends
//! commands and draws the snapshots the tribe server streams; nothing is simulated here.
use crate::net::Net;
use crate::render::G;
use evo_core::tribe::*;
use serde_json::json;
use std::collections::{HashMap, HashSet};

#[derive(Clone)]
struct UnitV {
    owner: u32,
    kind: UK,
    x: f64,
    y: f64,
    tx: f64,
    ty: f64,
    hp: f64,
    flags: u32,
    ang: f64,
}
#[derive(Clone)]
struct BuildV {
    owner: u32,
    kind: BK,
    x: f64,
    y: f64,
    hp: f64,
    built: f64,
    queue: u32,
    prog: f64,
}
#[derive(Clone)]
struct NodeV {
    id: u32,
    kind: RK,
    x: f64,
    y: f64,
    amount: f64,
}

#[derive(Clone, Debug, PartialEq)]
enum TAct {
    Build(BK),
    Train(u32, UK),
    Age,
    Respawn,
    CancelPlace,
}
struct Btn {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    act: TAct,
}

pub struct TribeGame {
    net: Net,
    my_id: u32,
    me: Option<TMe>,
    units: HashMap<u32, UnitV>,
    buildings: HashMap<u32, BuildV>,
    nodes: Vec<NodeV>,
    board: Vec<(String, i64, u32)>,
    names: HashMap<u32, (String, u32)>,
    online: u32,
    cam: (f64, f64),
    zoom: f64,
    size: (f64, f64),
    sel: HashSet<u32>,
    drag: Option<((f64, f64), (f64, f64))>,
    place: Option<BK>,
    pointer: (f64, f64),
    down: HashSet<String>,
    btns: Vec<Btn>,
    toast: String,
    toast_t: f64,
    t: f64,
    ready: bool,
    minimap_drag: bool,
    centered: bool,
}

const AGES: [&str; 3] = ["Gathering Age", "Hunter Age", "Chief Age"];

fn owner_color(g: &TribeGame, owner: u32) -> u32 {
    if owner == 0 { 0x9a8a6a } else { g.names.get(&owner).map_or(0xcccccc, |n| n.1) }
}

impl TribeGame {
    pub fn new(net: Net, my_id: u32, size: (f64, f64)) -> TribeGame {
        TribeGame {
            net, my_id, me: None, units: HashMap::new(), buildings: HashMap::new(), nodes: Vec::new(), board: Vec::new(), names: HashMap::new(), online: 1,
            cam: (MAP / 2.0, MAP / 2.0), zoom: 0.9, size, sel: HashSet::new(), drag: None, place: None, pointer: (0.0, 0.0), down: HashSet::new(), btns: Vec::new(),
            toast: String::new(), toast_t: 0.0, t: 0.0, ready: false, minimap_drag: false, centered: false,
        }
    }

    pub fn closed(&self) -> bool {
        self.net.closed.get()
    }

    fn say(&mut self, m: &str) {
        self.toast = m.to_string();
        self.toast_t = 2.2;
    }

    // -- network -------------------------------------------------------------------
    fn poll(&mut self) {
        let msgs: Vec<serde_json::Value> = self.net.inbox.borrow_mut().drain(..).collect();
        for m in msgs {
            if m["t"] == "tsnap" {
                if let Ok(s) = serde_json::from_value::<TSnap>(m) {
                    self.apply(s);
                }
            }
        }
    }

    fn apply(&mut self, s: TSnap) {
        let mut seen = HashSet::new();
        for a in &s.units {
            let id = a[0] as u32;
            seen.insert(id);
            let kind = UK::from_code(a[2]);
            match self.units.get_mut(&id) {
                Some(u) => {
                    u.tx = a[3];
                    u.ty = a[4];
                    u.hp = a[5];
                    u.flags = a[6] as u32;
                    u.ang = a[7];
                }
                None => {
                    self.units.insert(id, UnitV { owner: a[1] as u32, kind, x: a[3], y: a[4], tx: a[3], ty: a[4], hp: a[5], flags: a[6] as u32, ang: a[7] });
                }
            }
        }
        self.units.retain(|k, _| seen.contains(k));
        self.sel.retain(|k| seen.contains(k) || self.buildings.contains_key(k));
        self.buildings = s.buildings.iter().map(|a| (a[0] as u32, BuildV { owner: a[1] as u32, kind: BK::from_code(a[2]), x: a[3], y: a[4], hp: a[5], built: a[6] / 100.0, queue: a[7] as u32, prog: a[8] })).collect();
        self.sel.retain(|k| seen.contains(k) || self.buildings.contains_key(k));
        if let Some(n) = s.nodes {
            self.nodes = n.iter().map(|a| NodeV { id: a[0] as u32, kind: rk_from_code(a[1]), x: a[2], y: a[3], amount: a[4] }).collect();
        }
        self.names = s.tribes.iter().map(|(id, n, c)| (*id, (n.clone(), *c))).collect();
        self.board = s.board;
        self.online = s.online;
        if !self.centered {
            self.cam = (s.me.cx, s.me.cy);
            self.centered = true;
        }
        self.me = Some(s.me);
        self.ready = true;
    }

    fn cmd(&self, v: serde_json::Value) {
        self.net.send(&v);
    }

    // -- input ---------------------------------------------------------------------
    /// the point under a screen position, as drawn (next to the camera, possibly past the map edge)
    fn s2w_near(&self, sx: f64, sy: f64) -> (f64, f64) {
        (self.cam.0 + (sx - self.size.0 / 2.0) / self.zoom, self.cam.1 + (sy - self.size.1 / 2.0) / self.zoom)
    }
    /// the same point as a real map coordinate: the world wraps around
    fn s2w(&self, sx: f64, sy: f64) -> (f64, f64) {
        let (x, y) = self.s2w_near(sx, sy);
        (wrap(x), wrap(y))
    }
    fn w2s(&self, x: f64, y: f64) -> (f64, f64) {
        (wd(x - self.cam.0) * self.zoom + self.size.0 / 2.0, wd(y - self.cam.1) * self.zoom + self.size.1 / 2.0)
    }
    /// where to draw something so that it is on the copy of the world nearest the camera
    fn near(&self, x: f64, y: f64) -> (f64, f64) {
        (self.cam.0 + wd(x - self.cam.0), self.cam.1 + wd(y - self.cam.1))
    }
    fn minimap_rect(&self) -> (f64, f64, f64) {
        (12.0, self.size.1 - 192.0, 180.0)
    }
    fn on_minimap(&self, x: f64, y: f64) -> bool {
        let (mx, my, ms) = self.minimap_rect();
        x >= mx && x <= mx + ms && y >= my && y <= my + ms
    }
    fn minimap_to_cam(&mut self, x: f64, y: f64) {
        let (mx, my, ms) = self.minimap_rect();
        self.cam = (((x - mx) / ms * MAP).clamp(0.0, MAP - 1.0), ((y - my) / ms * MAP).clamp(0.0, MAP - 1.0));
    }

    pub fn on_key(&mut self, code: &str, down: bool) {
        if down {
            self.down.insert(code.to_string());
            match code {
                "Escape" => {
                    self.place = None;
                    self.sel.clear();
                }
                "KeyX" => {
                    let ids = self.my_selected_units();
                    if !ids.is_empty() {
                        self.cmd(json!({ "t": "stop", "ids": ids }));
                    }
                }
                _ => {}
            }
        } else {
            self.down.remove(code);
        }
    }
    pub fn clear_keys(&mut self) {
        self.down.clear();
    }

    pub fn on_wheel(&mut self, dy: f64) {
        self.zoom = (self.zoom * if dy > 0.0 { 0.9 } else { 1.1 }).clamp(0.45, 1.6);
    }

    pub fn on_move(&mut self, x: f64, y: f64) {
        self.pointer = (x, y);
        if self.minimap_drag {
            self.minimap_to_cam(x, y);
        }
        if let Some(d) = self.drag.as_mut() {
            d.1 = (x, y);
        }
    }

    fn pick(&self, wx: f64, wy: f64) -> Option<u32> {
        let mut best: Option<(f64, u32)> = None;
        for (id, u) in &self.units {
            let d = wd(u.x - wx).hypot(wd(u.y - wy));
            if d < 18.0 && best.is_none_or(|b| d < b.0) {
                best = Some((d, *id));
            }
        }
        if best.is_some() {
            return best.map(|b| b.1);
        }
        for (id, b) in &self.buildings {
            let d = wd(b.x - wx).hypot(wd(b.y - wy));
            if d < b.kind.stats().r && best.is_none_or(|bb| d < bb.0) {
                best = Some((d, *id));
            }
        }
        if best.is_some() {
            return best.map(|b| b.1);
        }
        for n in &self.nodes {
            let d = wd(n.x - wx).hypot(wd(n.y - wy));
            if d < 20.0 && best.is_none_or(|bb| d < bb.0) {
                best = Some((d, n.id));
            }
        }
        best.map(|b| b.1)
    }

    fn my_selected_units(&self) -> Vec<u32> {
        self.sel.iter().copied().filter(|id| self.units.get(id).is_some_and(|u| u.owner == self.my_id)).collect()
    }
    fn selected_building(&self) -> Option<(u32, &BuildV)> {
        let mut it = self.sel.iter().filter_map(|id| self.buildings.get(id).filter(|b| b.owner == self.my_id).map(|b| (*id, b)));
        let first = it.next()?;
        it.next().is_none().then_some(first)
    }

    pub fn on_down(&mut self, x: f64, y: f64, button: i16, shift: bool) {
        self.pointer = (x, y);
        if button == 2 {
            if self.place.take().is_some() {
                return;
            }
            return self.right_click(x, y);
        }
        if let Some(a) = self.btns.iter().rev().find(|b| x >= b.x - b.w / 2.0 && x <= b.x + b.w / 2.0 && y >= b.y - b.h / 2.0 && y <= b.y + b.h / 2.0).map(|b| b.act.clone()) {
            return self.do_act(a);
        }
        if self.on_minimap(x, y) {
            self.minimap_drag = true;
            return self.minimap_to_cam(x, y);
        }
        if let Some(kind) = self.place {
            let (wx, wy) = self.s2w(x, y);
            let ids = self.my_selected_units();
            self.cmd(json!({ "t": "build", "ids": ids, "b": format!("{kind:?}").to_lowercase(), "x": wx.round(), "y": wy.round() }));
            if !shift {
                self.place = None;
            }
            return;
        }
        self.drag = Some(((x, y), (x, y)));
        let _ = shift;
    }

    pub fn on_up(&mut self, x: f64, y: f64, shift: bool) {
        self.minimap_drag = false;
        let Some((a, _)) = self.drag.take() else { return };
        if (x - a.0).abs() < 6.0 && (y - a.1).abs() < 6.0 {
            let (wx, wy) = self.s2w(x, y);
            let picked = self.pick(wx, wy);
            if !shift {
                self.sel.clear();
            }
            if let Some(id) = picked {
                let mine = self.units.get(&id).map(|u| u.owner == self.my_id).or_else(|| self.buildings.get(&id).map(|b| b.owner == self.my_id)).unwrap_or(false);
                // you can look at anything, but only your own things take commands
                if mine || self.sel.is_empty() {
                    self.sel.insert(id);
                }
            }
        } else {
            let (x0, y0, x1, y1) = (a.0.min(x), a.1.min(y), a.0.max(x), a.1.max(y));
            if !shift {
                self.sel.clear();
            }
            let hits: Vec<u32> = self
                .units
                .iter()
                .filter(|(_, u)| u.owner == self.my_id && u.kind != UK::Deer)
                .filter(|(_, u)| {
                    let (sx, sy) = self.w2s(u.x, u.y);
                    sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1
                })
                .map(|(id, _)| *id)
                .collect();
            self.sel.extend(hits);
        }
    }

    fn right_click(&mut self, x: f64, y: f64) {
        let (wx, wy) = self.s2w(x, y);
        let ids = self.my_selected_units();
        if ids.is_empty() {
            if let Some((bid, _)) = self.selected_building() {
                self.cmd(json!({ "t": "rally", "b": bid, "x": wx.round(), "y": wy.round() }));
                self.say("Rally point set");
            }
            return;
        }
        let target = self.pick(wx, wy);
        let villagers_only = ids.iter().all(|id| self.units.get(id).is_some_and(|u| u.kind == UK::Villager));
        if let Some(t) = target {
            if let Some(u) = self.units.get(&t) {
                if u.kind == UK::Deer {
                    return self.cmd(json!({ "t": if villagers_only { "gather" } else { "attack" }, "ids": ids, "target": t }));
                } else if u.owner != self.my_id {
                    return self.cmd(json!({ "t": "attack", "ids": ids, "target": t }));
                }
            } else if let Some(b) = self.buildings.get(&t) {
                if b.owner != self.my_id {
                    return self.cmd(json!({ "t": "attack", "ids": ids, "target": t }));
                } else if b.built < 1.0 {
                    return self.cmd(json!({ "t": "help", "ids": ids, "target": t }));
                } else if b.kind == BK::Farm {
                    return self.cmd(json!({ "t": "gather", "ids": ids, "target": t }));
                }
            } else if self.nodes.iter().any(|n| n.id == t) {
                return self.cmd(json!({ "t": "gather", "ids": ids, "target": t }));
            }
        }
        self.cmd(json!({ "t": "move", "ids": ids, "x": wx.round(), "y": wy.round() }));
    }

    fn can_afford(&self, cost: [f64; 3]) -> bool {
        self.me.as_ref().is_some_and(|m| (0..3).all(|k| m.res[k] >= cost[k]))
    }

    fn do_act(&mut self, a: TAct) {
        let Some(me) = self.me.clone() else { return };
        match a {
            TAct::Build(k) => {
                let s = k.stats();
                if me.age < s.age {
                    return self.say("Reach the next age first");
                }
                if !self.can_afford(s.cost) {
                    return self.say("Not enough resources");
                }
                self.place = Some(k);
                self.say("Click the ground to build (right click cancels)");
            }
            TAct::Train(b, u) => {
                let s = u.stats();
                if me.age < u.age() {
                    return self.say("Reach the next age first");
                }
                if me.pop >= me.cap {
                    return self.say("Build more huts for room");
                }
                if !self.can_afford(s.cost) {
                    return self.say("Not enough resources");
                }
                self.cmd(json!({ "t": "train", "b": b, "u": format!("{u:?}").to_lowercase() }));
            }
            TAct::Age => {
                if !self.can_afford(me.next_age) {
                    return self.say("Not enough resources to age up");
                }
                self.cmd(json!({ "t": "age" }));
            }
            TAct::Respawn => self.cmd(json!({ "t": "respawn" })),
            TAct::CancelPlace => self.place = None,
        }
    }

    // -- frame ---------------------------------------------------------------------
    pub fn frame(&mut self, g: &G, dt: f64, size: (f64, f64)) {
        self.size = size;
        self.t += dt;
        self.toast_t = (self.toast_t - dt).max(0.0);
        self.poll();
        // pan with the keys, or by pushing the pointer against the screen edge
        let key = |c: &str| self.down.contains(c) as i32 as f64;
        let (mut dx, mut dy) = (key("KeyD") + key("ArrowRight") - key("KeyA") - key("ArrowLeft"), key("KeyS") + key("ArrowDown") - key("KeyW") - key("ArrowUp"));
        let (px, py) = self.pointer;
        if self.pointer != (0.0, 0.0) && !self.minimap_drag && self.drag.is_none() {
            if px < 6.0 { dx -= 1.0 } else if px > size.0 - 6.0 { dx += 1.0 }
            if py < 6.0 { dy -= 1.0 } else if py > size.1 - 6.0 { dy += 1.0 }
        }
        self.cam.0 = wrap(self.cam.0 + dx * 900.0 * dt / self.zoom);
        self.cam.1 = wrap(self.cam.1 + dy * 900.0 * dt / self.zoom);
        let k = 1.0 - (-dt * 18.0).exp();
        for u in self.units.values_mut() {
            u.x = wrap(u.x + wd(u.tx - u.x) * k);
            u.y = wrap(u.y + wd(u.ty - u.y) * k);
        }
        self.draw(g);
    }

    fn draw(&mut self, g: &G) {
        let (w, h) = self.size;
        g.ctx.set_fill_style_str("#1c2a14");
        g.ctx.fill_rect(0.0, 0.0, w, h);
        g.ctx.save();
        let _ = g.ctx.translate(w / 2.0, h / 2.0);
        let _ = g.ctx.scale(self.zoom, self.zoom);
        let _ = g.ctx.translate(-self.cam.0, -self.cam.1);
        let view = (self.cam.0 - w / 2.0 / self.zoom, self.cam.1 - h / 2.0 / self.zoom, w / self.zoom, h / self.zoom);
        self.draw_ground(g, view);
        let inv = |x: f64, y: f64, m: f64| x > view.0 - m && x < view.0 + view.2 + m && y > view.1 - m && y < view.1 + view.3 + m;

        for n in &self.nodes {
            let (x, y) = self.near(n.x, n.y);
            if inv(x, y, 40.0) {
                self.draw_node(g, &NodeV { x, y, ..n.clone() });
            }
        }
        let mut ids: Vec<u32> = self.buildings.keys().copied().collect();
        ids.sort();
        for id in ids {
            let b = &self.buildings[&id];
            let (x, y) = self.near(b.x, b.y);
            if inv(x, y, 100.0) {
                self.draw_building(g, id, &BuildV { x, y, ..b.clone() });
            }
        }
        let mut uids: Vec<&u32> = self.units.keys().collect();
        uids.sort_by(|a, b| self.near(0.0, self.units[a].y).1.partial_cmp(&self.near(0.0, self.units[b].y).1).unwrap_or(std::cmp::Ordering::Equal));
        for id in uids {
            let u = &self.units[id];
            let (x, y) = self.near(u.x, u.y);
            if inv(x, y, 40.0) {
                self.draw_unit(g, *id, &UnitV { x, y, ..u.clone() });
            }
        }
        // the ghost of a building being placed
        if let Some(k) = self.place {
            let (wx, wy) = self.s2w_near(self.pointer.0, self.pointer.1);
            let r = k.stats().r;
            let ok = self.can_afford(k.stats().cost);
            g.circle(wx, wy, r, if ok { 0xffffff } else { 0xff5050 }, 0.28);
            g.ring(wx, wy, r, 2.0, if ok { 0xb7ffb0 } else { 0xff7070 }, 0.9);
        }
        g.ctx.restore();

        // selection box
        if let Some((a, b)) = self.drag {
            if (a.0 - b.0).abs() > 6.0 || (a.1 - b.1).abs() > 6.0 {
                g.rect(a.0.min(b.0), a.1.min(b.1), (a.0 - b.0).abs(), (a.1 - b.1).abs(), 0xb7ffb0, 0.12);
                g.stroke_style(1.5, 0xb7ffb0, 0.9);
                g.ctx.stroke_rect(a.0.min(b.0), a.1.min(b.1), (a.0 - b.0).abs(), (a.1 - b.1).abs());
            }
        }
        self.draw_ui(g);
    }

    fn draw_ground(&self, g: &G, view: (f64, f64, f64, f64)) {
        // the world wraps around, so the same tiles repeat in every direction
        g.rect(view.0, view.1, view.2, view.3, 0x5a8a3a, 1.0);
        let tile = 128.0; // MAP / tile is a whole number, so the pattern joins up at the seam
        let n = (MAP / tile) as i32;
        let (x0, y0) = ((view.0 / tile).floor() as i32, (view.1 / tile).floor() as i32);
        let (x1, y1) = (((view.0 + view.2) / tile).ceil() as i32, ((view.1 + view.3) / tile).ceil() as i32);
        for tx in x0..x1 {
            for ty in y0..y1 {
                let hsh = (tx.rem_euclid(n) as u32).wrapping_mul(73856093) ^ (ty.rem_euclid(n) as u32).wrapping_mul(19349663);
                let v = (hsh % 100) as f64 / 100.0;
                let col = if v < 0.25 { 0x4f7e33 } else if v < 0.55 { 0x5f9440 } else if v < 0.62 { 0x8a7a4a } else { 0x558a38 };
                g.rect(tx as f64 * tile, ty as f64 * tile, tile + 1.0, tile + 1.0, col, 0.3);
                if v > 0.8 {
                    for k in 0..3u32 {
                        let (gx, gy) = (tx as f64 * tile + ((hsh >> (k * 3)) % 110) as f64, ty as f64 * tile + ((hsh >> (k * 4 + 1)) % 110) as f64);
                        let sway = (self.t * 1.4 + gx).sin() * 2.5;
                        g.line(gx, gy, gx + sway, gy - 12.0, 2.0, 0x2f5a22, 0.8);
                    }
                }
            }
        }
    }

    fn draw_node(&self, g: &G, n: &NodeV) {
        let frac = (n.amount / match n.kind { RK::Tree => 100.0, RK::Bush => 120.0, RK::Stone => 200.0, RK::Meat => 100.0 }).clamp(0.2, 1.0);
        match n.kind {
            RK::Tree => {
                g.ellipse(n.x + 4.0, n.y + 12.0, 34.0, 12.0, 0x000000, 0.2);
                g.rect(n.x - 3.0, n.y - 2.0, 6.0, 14.0, 0x5a3a1a, 1.0);
                g.circle(n.x, n.y - 12.0, 16.0 * (0.6 + 0.4 * frac), 0x2a6a2a, 1.0);
                g.circle(n.x - 5.0, n.y - 16.0, 9.0 * (0.6 + 0.4 * frac), 0x3a8a3a, 1.0);
            }
            RK::Bush => {
                g.circle(n.x, n.y, 14.0, 0x2e7d32, 1.0);
                for k in 0..4 {
                    let a = k as f64 * 1.6 + n.x;
                    g.circle(n.x + a.cos() * 7.0, n.y + a.sin() * 7.0, 3.2 * frac.max(0.5), 0xe53950, 1.0);
                }
            }
            RK::Stone => {
                g.ellipse(n.x + 3.0, n.y + 8.0, 34.0, 10.0, 0x000000, 0.2);
                g.ellipse(n.x, n.y, 30.0 * (0.6 + 0.4 * frac), 22.0 * (0.6 + 0.4 * frac), 0x8a8f96, 1.0);
                g.ellipse(n.x - 5.0, n.y - 5.0, 12.0, 8.0, 0xc3c8cf, 0.8);
            }
            RK::Meat => {
                g.ellipse(n.x, n.y, 26.0, 16.0, 0xc2475a, 1.0);
                g.circle(n.x - 14.0, n.y - 6.0, 4.0, 0xf5efe0, 1.0);
            }
        }
    }

    fn draw_building(&self, g: &G, id: u32, b: &BuildV) {
        let col = owner_color(self, b.owner);
        let r = b.kind.stats().r;
        let a = if b.built < 1.0 { 0.55 } else { 1.0 };
        g.ellipse(b.x + 6.0, b.y + r * 0.7, r * 2.2, r * 0.9, 0x000000, 0.22);
        match b.kind {
            BK::Center => {
                g.circle(b.x, b.y, r, 0x7a5a32, a);
                g.circle(b.x, b.y, r * 0.78, 0xb8884a, a);
                g.tri([(b.x - r * 0.9, b.y - r * 0.2), (b.x, b.y - r * 1.5), (b.x + r * 0.9, b.y - r * 0.2)], 0xd8b060, a);
                g.line(b.x, b.y - r * 1.5, b.x, b.y - r * 2.0, 3.0, 0x4a3a20, a);
                g.tri([(b.x, b.y - r * 2.0), (b.x + 26.0, b.y - r * 1.8), (b.x, b.y - r * 1.6)], col, a);
                g.circle(b.x, b.y + r * 0.35, r * 0.2, 0x3a2a14, a);
            }
            BK::Hut => {
                g.circle(b.x, b.y, r, 0x8a6a3a, a);
                g.tri([(b.x - r, b.y), (b.x, b.y - r * 1.5), (b.x + r, b.y)], 0xd2aa5a, a);
                g.circle(b.x, b.y + r * 0.35, r * 0.22, 0x3a2a14, a);
            }
            BK::Farm => {
                g.rect(b.x - r, b.y - r * 0.8, r * 2.0, r * 1.6, 0x6a4a28, a);
                for k in 0..5 {
                    let yy = b.y - r * 0.65 + k as f64 * r * 0.32;
                    g.line(b.x - r * 0.9, yy, b.x + r * 0.9, yy, 4.0, if b.built >= 1.0 { 0xb8c84a } else { 0x4a6a2a }, a);
                }
            }
            BK::Barracks => {
                g.rect(b.x - r, b.y - r, r * 2.0, r * 2.0, 0x6a4a2a, a);
                g.stroke_style(3.0, 0x3a2a14, a);
                g.ctx.stroke_rect(b.x - r, b.y - r, r * 2.0, r * 2.0);
                g.line(b.x - r * 0.5, b.y - r * 0.3, b.x + r * 0.5, b.y + r * 0.5, 4.0, 0xc8c8d0, a);
                g.line(b.x + r * 0.5, b.y - r * 0.3, b.x - r * 0.5, b.y + r * 0.5, 4.0, 0xc8c8d0, a);
                g.rect(b.x - 4.0, b.y - r - 14.0, 22.0, 14.0, col, a);
            }
            BK::Tower => {
                g.circle(b.x, b.y, r, 0x8a8f96, a);
                g.circle(b.x, b.y, r * 0.65, 0x6a6f76, a);
                g.circle(b.x, b.y - r * 0.2, r * 0.3, 0xff9a2e, a);
                g.ring(b.x, b.y, r + 3.0, 3.0, col, a);
            }
        }
        // a colour ring so you can tell whose it is
        if b.kind != BK::Tower {
            g.ring(b.x, b.y, r + 3.0, 2.5, col, a * 0.9);
        }
        if self.sel.contains(&id) {
            g.ring(b.x, b.y, r + 8.0, 3.0, 0xffffff, 0.9);
        }
        if b.built < 1.0 {
            g.rect(b.x - r, b.y + r + 4.0, r * 2.0, 5.0, 0x000000, 0.6);
            g.rect(b.x - r, b.y + r + 4.0, r * 2.0 * b.built, 5.0, 0xf2c14a, 1.0);
        } else if b.hp < 99.0 {
            g.rect(b.x - r, b.y + r + 4.0, r * 2.0, 5.0, 0x2a0a14, 0.7);
            g.rect(b.x - r, b.y + r + 4.0, r * 2.0 * b.hp / 100.0, 5.0, 0xff4d6d, 1.0);
        }
        if b.queue > 0 {
            g.rect(b.x - r, b.y - r - 10.0, r * 2.0, 5.0, 0x000000, 0.6);
            g.rect(b.x - r, b.y - r - 10.0, r * 2.0 * b.prog / 100.0, 5.0, 0x7fd0ff, 1.0);
        }
        if b.kind == BK::Center && b.owner != 0 {
            if let Some(n) = self.names.get(&b.owner) {
                g.text(&n.0, b.x, b.y - r * 2.4, 15.0, true, 0xffffff, "center", Some((0x142010, 3.0)));
            }
        }
    }

    fn draw_unit(&self, g: &G, id: u32, u: &UnitV) {
        let col = owner_color(self, u.owner);
        let t = self.t;
        let (ca, sa) = (u.ang.cos(), u.ang.sin());
        let moving = u.flags & 1 != 0;
        let bob = if moving { (t * 12.0 + id as f64).sin() * 2.0 } else { 0.0 };
        let (x, y) = (u.x, u.y + bob);
        let to = |lx: f64, ly: f64| (x + lx * ca - ly * sa, y + lx * sa + ly * ca);
        let hurt = u.flags & 16 != 0;
        let body = if hurt { 0xffffff } else { col };
        g.ellipse(x + 2.0, u.y + 9.0, 20.0, 8.0, 0x000000, 0.22);
        match u.kind {
            UK::Deer => {
                g.ellipse(x, y, 26.0, 14.0, 0xa8794a, 1.0);
                let h = to(14.0, 0.0);
                g.circle(h.0, h.1, 6.0, 0xb98a5a, 1.0);
                for s in [-1.0, 1.0] {
                    let a = to(15.0, s * 4.0);
                    let b = to(22.0, s * 9.0);
                    g.line(a.0, a.1, b.0, b.1, 1.5, 0xe8dcc0, 1.0);
                }
            }
            UK::Beast => {
                g.ellipse(x, y, 30.0, 18.0, body, 1.0);
                g.ring(x, y, 13.0, 2.0, 0xffffff, 0.25);
                let h = to(15.0, 0.0);
                g.circle(h.0, h.1, 8.0, body, 1.0);
                let e = to(18.0, -3.0);
                g.circle(e.0, e.1, 1.8, 0x111111, 1.0);
                for s in [-1.0, 1.0] {
                    let paw = to(8.0 + (t * 10.0).sin() * 3.0 * moving as i32 as f64, s * 10.0);
                    g.circle(paw.0, paw.1, 3.5, 0x3a2a22, 1.0);
                }
            }
            _ => {
                // a tribe member: a body in the tribe's colour, a round head, and a tool
                g.ellipse(x, y, 16.0, 20.0, body, 1.0);
                g.ring(x, y, 8.0, 1.5, 0x000000, 0.25);
                let hd = to(2.0, 0.0);
                g.circle(hd.0, hd.1 - 8.0, 6.5, 0xe0b58a, 1.0);
                match u.kind {
                    UK::Warrior => {
                        let a = to(-4.0, 11.0);
                        let b = to(20.0, 11.0 + if u.flags & 2 != 0 { (t * 14.0).sin() * 5.0 } else { 0.0 });
                        g.line(a.0, a.1, b.0, b.1, 2.5, 0x8a6a3a, 1.0);
                        g.tri([(b.0, b.1), (b.0 - 5.0 * ca + 3.0 * sa, b.1 - 5.0 * sa - 3.0 * ca), (b.0 + 8.0 * ca, b.1 + 8.0 * sa)], 0xd8d8e0, 1.0);
                        let sh = to(2.0, -10.0);
                        g.circle(sh.0, sh.1, 6.0, 0x7a5a32, 1.0);
                    }
                    UK::Archer => {
                        let a = to(10.0, -9.0);
                        let b = to(10.0, 9.0);
                        g.stroke_style(2.0, 0x6a4a2a, 1.0);
                        g.ctx.begin_path();
                        g.ctx.move_to(a.0, a.1);
                        let c = to(22.0, 0.0);
                        g.ctx.quadratic_curve_to(c.0, c.1, b.0, b.1);
                        g.ctx.stroke();
                        g.line(a.0, a.1, b.0, b.1, 1.0, 0xeeeeee, 0.8);
                    }
                    _ => {
                        if u.flags & 4 != 0 {
                            let a = to(8.0, 6.0);
                            let sw = (t * 9.0).sin() * 6.0;
                            g.line(a.0, a.1, a.0 + 8.0 * ca - sw * sa, a.1 + 8.0 * sa + sw * ca, 2.5, 0x8a6a3a, 1.0);
                        }
                    }
                }
            }
        }
        if self.sel.contains(&id) {
            g.ring(u.x, u.y + 3.0, 16.0, 2.5, if u.owner == self.my_id { 0xb7ffb0 } else { 0xffd0d0 }, 0.95);
        }
        if u.hp < 99.0 && u.kind != UK::Deer || self.sel.contains(&id) {
            g.rect(u.x - 12.0, u.y - 24.0, 24.0, 4.0, 0x2a0a14, 0.7);
            g.rect(u.x - 12.0, u.y - 24.0, 24.0 * u.hp / 100.0, 4.0, if u.owner == self.my_id { 0x7dff7a } else { 0xff4d6d }, 1.0);
        }
    }

    // -- the interface -----------------------------------------------------------------
    fn button(&mut self, g: &G, x: f64, y: f64, w: f64, h: f64, label: &str, sub: &str, ok: bool, act: TAct) {
        g.rect(x - w / 2.0, y - h / 2.0, w, h, if ok { 0x3d6a2a } else { 0x23301c }, 0.95);
        g.stroke_style(2.0, if ok { 0xb7e87a } else { 0x4a5a3a }, 0.9);
        g.ctx.stroke_rect(x - w / 2.0, y - h / 2.0, w, h);
        let c = if ok { 0xf4ffe6 } else { 0x7a8a6a };
        g.text(label, x, y - if sub.is_empty() { 0.0 } else { 8.0 }, 14.0, true, c, "center", None);
        if !sub.is_empty() {
            g.text(sub, x, y + 11.0, 11.0, false, c, "center", None);
        }
        self.btns.push(Btn { x, y, w, h, act });
    }

    fn draw_ui(&mut self, g: &G) {
        self.btns.clear();
        let (w, h) = self.size;
        let Some(me) = self.me.clone() else {
            g.text_lines("Your tribe is gathering...", w / 2.0, h / 2.0, 28.0, true, 0xf4ffe6, "center", Some((0x142010, 5.0)));
            return;
        };
        // resources
        g.rect(0.0, 0.0, w, 40.0, 0x10200c, 0.82);
        let items = [(0xe53950, format!("{}", me.res[0] as i64)), (0x8a6a3a, format!("{}", me.res[1] as i64)), (0x9aa0a8, format!("{}", me.res[2] as i64))];
        let labels = ["Food", "Wood", "Stone"];
        for (k, (c, v)) in items.iter().enumerate() {
            let x = 22.0 + k as f64 * 120.0;
            g.circle(x, 20.0, 9.0, *c, 1.0);
            g.text(&format!("{v}"), x + 16.0, 20.0, 17.0, true, 0xf4ffe6, "left", None);
            g.text(labels[k], x + 16.0, 33.0, 9.0, false, 0xa8c890, "left", None);
        }
        g.text(&format!("POP {} / {}", me.pop, me.cap), 400.0, 20.0, 17.0, true, if me.pop >= me.cap { 0xff9a7a } else { 0xf4ffe6 }, "left", None);
        g.text(AGES[(me.age as usize - 1).min(2)], 520.0, 20.0, 15.0, true, 0xffe9a8, "left", None);
        if me.age < 3 {
            let cost = me.next_age;
            let ok = self.can_afford(cost);
            self.button(g, 760.0, 20.0, 250.0, 32.0, &format!("AGE UP: {}", AGES[me.age as usize]), &format!("{}F {}W {}S", cost[0] as i64, cost[1] as i64, cost[2] as i64), ok, TAct::Age);
        }
        // board
        g.text("TRIBES", w - 20.0, 56.0, 12.0, true, 0xa8c890, "right", None);
        for (i, (n, s, c)) in self.board.iter().enumerate() {
            g.circle(w - 150.0, 76.0 + i as f64 * 20.0, 5.0, *c, 1.0);
            g.text(&format!("{}. {}  {}", i + 1, n, s), w - 20.0, 76.0 + i as f64 * 20.0, 14.0, false, 0xe0f0d0, "right", None);
        }
        g.text(&format!("{} tribes online", self.online), w - 20.0, 52.0 + 8.0 + 20.0 * (self.board.len() as f64) + 20.0, 11.0, false, 0x8aa870, "right", None);

        // minimap
        let (mx, my, ms) = self.minimap_rect();
        g.rect(mx - 3.0, my - 3.0, ms + 6.0, ms + 6.0, 0x10200c, 0.9);
        g.rect(mx, my, ms, ms, 0x3a5a28, 1.0);
        let k = ms / MAP;
        for n in &self.nodes {
            g.rect(mx + n.x * k, my + n.y * k, 2.0, 2.0, match n.kind { RK::Tree => 0x1f5a1f, RK::Bush => 0xe53950, RK::Stone => 0xcfd4da, RK::Meat => 0xc2475a }, 1.0);
        }
        for b in self.buildings.values() {
            g.rect(mx + b.x * k - 2.0, my + b.y * k - 2.0, 5.0, 5.0, owner_color(self, b.owner), 1.0);
        }
        for u in self.units.values().filter(|u| u.kind != UK::Deer) {
            g.rect(mx + u.x * k - 1.0, my + u.y * k - 1.0, 2.5, 2.5, owner_color(self, u.owner), 1.0);
        }
        let (vw, vh) = (w / self.zoom * k, h / self.zoom * k);
        g.ctx.save();
        g.ctx.begin_path();
        g.ctx.rect(mx, my, ms, ms);
        g.ctx.clip();
        g.stroke_style(1.5, 0xffffff, 0.9);
        for ox in [-ms, 0.0, ms] {
            for oy in [-ms, 0.0, ms] {
                g.ctx.stroke_rect(mx + self.cam.0 * k - vw / 2.0 + ox, my + self.cam.1 * k - vh / 2.0 + oy, vw, vh);
            }
        }
        g.ctx.restore();

        // the command panel
        let px = 210.0;
        g.rect(px, h - 104.0, w - px - 12.0, 92.0, 0x10200c, 0.88);
        let sel_units = self.my_selected_units();
        let villagers = sel_units.iter().filter(|id| self.units[id].kind == UK::Villager).count();
        let bsel = self.selected_building().map(|(id, b)| (id, b.kind, b.built));
        let mut x = px + 70.0;
        if let Some((bid, kind, built)) = bsel {
            g.text(&format!("{kind:?}"), px + 12.0, h - 92.0, 13.0, true, 0xffe9a8, "left", None);
            if built >= 1.0 {
                match kind {
                    BK::Center => {
                        let c = UK::Villager.stats().cost;
                        self.button(g, x, h - 52.0, 120.0, 56.0, "Villager", &format!("{}F", c[0] as i64), self.can_afford(c), TAct::Train(bid, UK::Villager));
                    }
                    BK::Barracks => {
                        for (k, u) in [UK::Warrior, UK::Archer].into_iter().enumerate() {
                            let c = u.stats().cost;
                            let ok = self.can_afford(c) && me.age >= u.age();
                            self.button(g, x + k as f64 * 130.0, h - 52.0, 120.0, 56.0, &format!("{u:?}"), &if me.age < u.age() { "Hunter Age".to_string() } else { format!("{}F {}W", c[0] as i64, c[1] as i64) }, ok, TAct::Train(bid, u));
                        }
                    }
                    _ => {}
                }
                g.text("Right-click the ground to set a rally point", px + 12.0, h - 20.0, 11.0, false, 0x8aa870, "left", None);
            } else {
                g.text("Under construction: right-click it with villagers to help", px + 12.0, h - 52.0, 13.0, false, 0xe0f0d0, "left", None);
            }
        } else if villagers > 0 {
            g.text(&format!("{} villagers: build something", villagers), px + 12.0, h - 92.0, 13.0, true, 0xffe9a8, "left", None);
            for (k, kind) in [BK::Hut, BK::Farm, BK::Barracks, BK::Tower].into_iter().enumerate() {
                let s = kind.stats();
                let ok = me.age >= s.age && self.can_afford(s.cost);
                let sub = if me.age < s.age { "Hunter Age".to_string() } else { format!("{}W{}", s.cost[1] as i64, if s.cost[2] > 0.0 { format!(" {}S", s.cost[2] as i64) } else { String::new() }) };
                self.button(g, x + k as f64 * 130.0, h - 52.0, 120.0, 56.0, &format!("{kind:?}"), &sub, ok, TAct::Build(kind));
            }
            g.text("Right-click: gather, hunt, build, or move", px + 12.0, h - 20.0, 11.0, false, 0x8aa870, "left", None);
        } else if !sel_units.is_empty() {
            g.text(&format!("{} selected. Right-click to move or attack. X stops.", sel_units.len()), px + 12.0, h - 60.0, 13.0, false, 0xe0f0d0, "left", None);
        } else {
            g.text("Drag to select your tribe. Right-click to command. WASD pans, wheel zooms.", px + 12.0, h - 60.0, 13.0, false, 0xe0f0d0, "left", None);
            x += 0.0;
        }
        if self.place.is_some() {
            self.button(g, w / 2.0, 70.0, 160.0, 30.0, "Cancel building", "", true, TAct::CancelPlace);
        }
        if self.toast_t > 0.0 {
            g.ctx.set_global_alpha(self.toast_t.min(1.0));
            g.text(&self.toast, w / 2.0, h - 130.0, 17.0, true, 0xfff2c0, "center", Some((0x142010, 4.0)));
            g.ctx.set_global_alpha(1.0);
        }
        if !me.alive {
            g.rect(0.0, 0.0, w, h, 0x2a0a14, 0.55);
            g.text_lines("Your tribe has fallen...", w / 2.0, h / 2.0 - 30.0, 40.0, true, 0xff8fa3, "center", Some((0x2a0a14, 6.0)));
            self.button(g, w / 2.0, h / 2.0 + 40.0, 260.0, 50.0, "BEGIN AGAIN", "your genes stay with you", true, TAct::Respawn);
        }
        let _ = x;
    }
}
