//! evo: eat, breed and evolve your species. Rust all the way down: this crate is the browser
//! client (compiled to WASM); the relay server lives in ../server.
//!
//! One browser in each room is the host and runs the whole simulation (bots, food, every
//! player). The server only relays. Everyone else sends inputs and draws the snapshots the host
//! broadcasts. Solo play is just a host with nobody else.
mod lobby;
mod model;
mod net;
mod render;
mod settings;
mod sim;
mod ui;
mod util;

use model::*;
use net::Net;
use render::{G, Scene};
use sim::Sim;
use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::rc::Rc;
use ui::{Act, Hud, PlayerRow, Ui};
use util::*;
use wasm_bindgen::prelude::*;
use web_sys::{HtmlCanvasElement, KeyboardEvent, PointerEvent};

struct Game {
    canvas: HtmlCanvasElement,
    g: G,
    ui: Ui,
    net: Option<Net>,
    my_id: u32,
    name: String,
    room: String,
    is_host: bool,
    sim: Sim,
    // client side: what the latest snapshots showed
    views: HashMap<(bool, u32), Cell>,
    plants: [Vec<Food>; 2],
    meat: Vec<Food>,
    toxins: Vec<(f64, f64, f64, f64)>,
    recs: Vec<Rec>,
    view_stage: Stage,
    ready: bool,
    particles: Vec<Particle>,
    t: f64,
    toast: String,
    toast_t: f64,
    shake_t: f64,
    shake_i: f64,
    cam: (f64, f64),
    zoom: f64,
    focus: (f64, f64, f64),
    down: HashSet<String>,
    kb_mode: bool,
    pointer: (f64, f64),
    ui_click_at: f64,
    snap_t: f64,
    in_t: f64,
    hello_t: f64,
    last_ts: f64,
    size: (f64, f64),
    last_stage: Stage,
}

type Shared = Rc<RefCell<Game>>;

impl Game {
    fn new(boot: lobby::Boot) -> Game {
        let canvas = by_id::<HtmlCanvasElement>("game");
        let ctx = canvas.get_context("2d").ok().flatten().and_then(|c| c.dyn_into::<web_sys::CanvasRenderingContext2d>().ok()).expect("2d context");
        let is_host = boot.is_host;
        let sim = if is_host { Sim::new(boot.my_id, &boot.name) } else { Sim::new(boot.my_id, "") };
        let mut g = Game {
            canvas, g: G { ctx }, ui: Ui::new(), net: boot.net, my_id: boot.my_id, name: boot.name, room: boot.room, is_host, sim, views: HashMap::new(),
            plants: [Vec::new(), Vec::new()], meat: Vec::new(), toxins: Vec::new(), recs: Vec::new(), view_stage: Stage::Water, ready: false, particles: Vec::new(),
            t: 0.0, toast: String::new(), toast_t: 0.0, shake_t: 0.0, shake_i: 0.0, cam: (4000.0, 4000.0), zoom: 1.1, focus: (4000.0, 4000.0, START_MASS),
            down: HashSet::new(), kb_mode: false, pointer: (0.0, 0.0), ui_click_at: 0.0, snap_t: 0.0, in_t: 0.0, hello_t: 0.0, last_ts: 0.0, size: (0.0, 0.0), last_stage: Stage::Water,
        };
        if is_host {
            g.ready = true;
            if let Some((w, i)) = g.sim.pcell(g.my_id) {
                let c = &g.sim.worlds[w].cells[i];
                g.cam = (c.x, c.y);
            }
        }
        g
    }

    fn my_stage(&self) -> Stage {
        if self.is_host { self.sim.pls.get(&self.my_id).map_or(Stage::Water, |p| p.stage) } else { self.view_stage }
    }

    fn me_rec(&self) -> Option<Rec> {
        if self.is_host { self.sim.rec(self.my_id) } else { self.recs.iter().find(|r| r.id == self.my_id).cloned() }
    }

    fn say(&mut self, m: &str, secs: f64) {
        self.toast = m.to_string();
        self.toast_t = secs;
    }

    // -- input ---------------------------------------------------------------------
    fn send_act(&mut self, m: serde_json::Value) {
        if self.is_host {
            self.sim.act(self.my_id, &m);
        } else if let Some(n) = &self.net {
            n.send(&m);
        }
    }

    fn local_bite(&mut self) {
        let Some(r) = self.me_rec() else { return };
        if r.shop || r.dead || now_ms() - self.ui_click_at < 250.0 {
            return;
        }
        self.send_act(serde_json::json!({ "t": "bite" }));
    }

    fn do_act(&mut self, a: Act) {
        self.ui_click_at = now_ms();
        let m = match a {
            Act::Breed => serde_json::json!({ "t": "breed" }),
            Act::Split => serde_json::json!({ "t": "split" }),
            Act::Poison => serde_json::json!({ "t": "poison" }),
            Act::Advance => serde_json::json!({ "t": "advance" }),
            Act::Leave => {
                let _ = window().location().reload();
                return;
            }
            Act::Buy(key, dir) => serde_json::json!({ "t": "buy", "key": key, "dir": dir }),
            Act::Diet(d) => serde_json::json!({ "t": "diet", "key": d.def().key }),
            Act::Look(what) => serde_json::json!({ "t": "look", "what": what }),
            Act::CloseShop => serde_json::json!({ "t": "close" }),
        };
        self.send_act(m);
    }

    fn on_key(&mut self, e: &KeyboardEvent) {
        if settings::open() {
            return;
        }
        if let Some(t) = e.target().and_then(|t| t.dyn_into::<web_sys::Element>().ok()) {
            if t.tag_name() == "INPUT" {
                return;
            }
        }
        let code = e.code();
        let bound = ["up", "down", "left", "right", "bite", "breed", "split", "poison", "advance"].iter().any(|a| settings::key(a) == code);
        if bound {
            e.prevent_default();
        }
        if e.repeat() {
            return;
        }
        self.down.insert(code.clone());
        if code == settings::key("bite") {
            self.local_bite();
        } else if code == settings::key("breed") {
            let shop = self.me_rec().is_some_and(|r| r.shop);
            self.send_act(serde_json::json!({ "t": if shop { "close" } else { "breed" } }));
        } else if code == settings::key("split") {
            self.send_act(serde_json::json!({ "t": "split" }));
        } else if code == settings::key("poison") {
            self.send_act(serde_json::json!({ "t": "poison" }));
        } else if code == settings::key("advance") {
            self.send_act(serde_json::json!({ "t": "advance" }));
        } else if code == "Escape" || code == "Enter" {
            self.send_act(serde_json::json!({ "t": "close" }));
        }
    }

    fn on_pointer_down(&mut self, x: f64, y: f64) {
        self.pointer = (x, y);
        if let Some(a) = self.ui.click(x, y) {
            return self.do_act(a);
        }
        self.local_bite();
    }

    /// where the local player is steering: held move keys win, then the mouse; None = coast
    fn local_target(&mut self, px: f64, py: f64) -> Option<(f64, f64)> {
        let d = &self.down;
        let key = |a: &str| d.contains(&settings::key(a)) as i32 as f64;
        let dx = key("right") - key("left");
        let dy = key("down") - key("up");
        if dx != 0.0 || dy != 0.0 {
            self.kb_mode = true;
            let len = dx.hypot(dy);
            return Some((px + dx / len * 400.0, py + dy / len * 400.0));
        }
        if self.kb_mode {
            return None;
        }
        let (w, h) = self.size;
        Some((self.cam.0 + (self.pointer.0 - w / 2.0) / self.zoom, self.cam.1 + (self.pointer.1 - h / 2.0) / self.zoom))
    }

    // -- networking ------------------------------------------------------------------
    fn poll_net(&mut self) {
        let msgs: Vec<serde_json::Value> = match &self.net {
            Some(n) => n.inbox.borrow_mut().drain(..).collect(),
            None => return,
        };
        for m in msgs {
            if self.is_host {
                self.on_net_host(&m);
            } else {
                self.on_net_client(m);
            }
        }
    }

    fn on_net_host(&mut self, m: &serde_json::Value) {
        let t = m["t"].as_str().unwrap_or("");
        match t {
            "join" => {
                let id = m["id"].as_u64().unwrap_or(0) as u32;
                if !self.sim.pls.contains_key(&id) {
                    self.sim.add_player(id, m["name"].as_str().unwrap_or("cell"), None);
                }
                self.sim.pending_state.push((id, 0));
            }
            "leave" => self.sim.remove_player(m["id"].as_u64().unwrap_or(0) as u32),
            _ => {
                let Some(from) = m["from"].as_u64().map(|f| f as u32) else { return };
                if t == "hello" && !self.sim.pls.contains_key(&from) {
                    // a joiner still waiting on us (its join was missed or the state was lost): add it and resend
                    self.sim.add_player(from, m["name"].as_str().unwrap_or("cell"), None);
                    self.sim.pending_state.push((from, 0));
                } else if t == "hello" {
                    let w = self.sim.pls[&from].stage.idx();
                    self.sim.pending_state.push((from, w));
                }
                self.sim.act(from, m);
            }
        }
    }

    fn on_net_client(&mut self, m: serde_json::Value) {
        match m["t"].as_str().unwrap_or("") {
            "state" => {
                let w = m["w"].as_u64().unwrap_or(0).min(1) as usize;
                self.plants[w] = m["plants"]
                    .as_array()
                    .map(|a| a.iter().map(|p| Food { x: p[0].as_f64().unwrap_or(0.0), y: p[1].as_f64().unwrap_or(0.0), kind: 0, mass: 1.0, bob: rand(0.0, TAU), size: p[2].as_f64().unwrap_or(5.0), vx: 0.0, vy: 0.0, ttl: 0.0, eaten: false }).collect())
                    .unwrap_or_default();
                self.ready = true;
            }
            "snap" => {
                if let Ok(s) = serde_json::from_value::<Snap>(m) {
                    if self.ready && !self.plants[(s.w as usize).min(1)].is_empty() {
                        self.apply_snap(s);
                    }
                }
            }
            "host" => self.become_host(m["left"].as_u64().unwrap_or(0) as u32),
            _ => {}
        }
    }

    // the host left: carry on from what we have been seeing
    fn become_host(&mut self, left: u32) {
        if self.is_host {
            return;
        }
        let mut sim = Sim::new(self.my_id, "");
        let recs = std::mem::take(&mut self.recs);
        for r in recs.iter().filter(|r| r.id != left) {
            sim.add_player(r.id, &r.n, Some(r));
            if r.id != self.my_id {
                sim.pending_state.push((r.id, r.st.idx()));
            }
        }
        if !sim.pls.contains_key(&self.my_id) {
            sim.add_player(self.my_id, &self.name, None);
        }
        self.sim = sim;
        self.is_host = true;
        self.views.clear();
        self.say("Host left: you are now running the room", 3.0);
    }

    fn apply_snap(&mut self, s: Snap) {
        let stage = Stage::from_idx(s.w);
        self.view_stage = stage;
        let mut seen: HashSet<(bool, u32)> = HashSet::new();
        for a in &s.c {
            if a.len() < 27 {
                continue;
            }
            let is_p = a[1] as i32 == 2;
            let key = (is_p, a[0] as u32);
            seen.insert(key);
            match self.views.get_mut(&key) {
                Some(v) => v.update_from(a),
                None => {
                    self.views.insert(key, Cell::unpack(a));
                }
            }
        }
        self.views.retain(|k, _| seen.contains(k));
        for r in &s.pl {
            if let Some(v) = self.views.get_mut(&(true, r.id)) {
                v.name = r.n.clone();
            }
        }
        self.recs = s.pl;
        let plants = &mut self.plants[stage.idx()];
        for (i, x, y, size) in s.pe {
            if i < plants.len() {
                plants[i] = Food { x, y, kind: 0, mass: 1.0, bob: rand(0.0, TAU), size, vx: 0.0, vy: 0.0, ttl: 0.0, eaten: false };
            }
        }
        self.toxins = s.tx.iter().map(|&(x, y, r, a)| (x, y, r, a / 100.0)).collect();
        self.meat = s.m.iter().map(|&(x, y, size)| Food { x, y, kind: 1, mass: 1.0, bob: 0.0, size, vx: 0.0, vy: 0.0, ttl: 0.0, eaten: false }).collect();
        for ev in s.ev {
            self.apply_fx(ev);
        }
    }

    fn apply_fx(&mut self, ev: Fx) {
        let stage = self.my_stage();
        match ev {
            Fx::Burst { w, x, y, c, n, s } => {
                if w as usize == stage.idx() {
                    for _ in 0..n {
                        let a = rand(0.0, TAU);
                        let sp = rand(0.2, 1.0) * s;
                        self.particles.push(Particle { x, y, vx: a.cos() * sp, vy: a.sin() * sp, life: rand(0.4, 0.9), color: c, size: rand(2.0, 5.0) });
                    }
                }
            }
            Fx::Sfx { p, a, d, .. } if p == self.my_id => {
                if d > 0.0 {
                    let cb = Closure::once_into_js(move || sfx(a.0, a.1, &a.2, a.3, a.4));
                    let _ = window().set_timeout_with_callback_and_timeout_and_arguments_0(cb.unchecked_ref(), d as i32);
                } else {
                    sfx(a.0, a.1, &a.2, a.3, a.4);
                }
            }
            Fx::Shake { p, ms, i } if p == self.my_id => {
                self.shake_t = ms / 1000.0;
                self.shake_i = i;
            }
            Fx::Toast { p, m, s } if p == self.my_id => self.say(&m, s),
            _ => {}
        }
    }

    // -- frame -------------------------------------------------------------------------
    fn fit_canvas(&mut self) {
        let win = window();
        let (w, h) = (win.inner_width().ok().and_then(|v| v.as_f64()).unwrap_or(800.0), win.inner_height().ok().and_then(|v| v.as_f64()).unwrap_or(600.0));
        let dpr = win.device_pixel_ratio().max(1.0);
        let (pw, ph) = ((w * dpr) as u32, (h * dpr) as u32);
        if self.canvas.width() != pw || self.canvas.height() != ph {
            self.canvas.set_width(pw);
            self.canvas.set_height(ph);
        }
        let _ = self.g.ctx.set_transform(dpr, 0.0, 0.0, dpr, 0.0, 0.0);
        self.size = (w, h);
    }

    fn frame(&mut self, ts: f64) {
        let dt = if self.last_ts == 0.0 { 0.016 } else { ((ts - self.last_ts) / 1000.0).min(0.05) };
        self.last_ts = ts;
        self.t += dt;
        self.toast_t = (self.toast_t - dt).max(0.0);
        self.shake_t = (self.shake_t - dt).max(0.0);
        self.fit_canvas();
        self.poll_net();
        if self.is_host {
            self.step_host(dt);
        } else {
            self.step_client(dt);
        }
        for p in self.particles.iter_mut() {
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            let drag = 1.0 - (dt * 3.0).min(1.0);
            p.vx *= drag;
            p.vy *= drag;
        }
        self.particles.retain(|p| p.life > 0.0);
        let stage = self.my_stage();
        if stage != self.last_stage {
            // evolved onto land: jump the camera to the new body
            self.last_stage = stage;
            self.cam = (self.focus.0, self.focus.1);
            self.particles.clear();
        }
        self.update_camera(dt);
        self.draw(stage, dt);
        let shop = self.me_rec().is_some_and(|r| r.shop && !r.dead);
        settings::set_button_visible(!shop);
    }

    fn step_host(&mut self, dt: f64) {
        // aim the local player before the world steps
        if let Some((w, i)) = self.sim.pcell(self.my_id) {
            let (px, py) = (self.sim.worlds[w].cells[i].x, self.sim.worlds[w].cells[i].y);
            let target = self.local_target(px, py);
            if let Some(p) = self.sim.pls.get_mut(&self.my_id) {
                p.inp = target;
            }
        }
        self.sim.step(dt);
        for ev in std::mem::take(&mut self.sim.local_fx) {
            self.apply_fx(ev);
        }
        for wd in self.sim.worlds.iter_mut() {
            for c in wd.cells.iter_mut() {
                c.local = c.pid == Some(self.my_id);
            }
        }
        if let Some((w, i)) = self.sim.pcell(self.my_id) {
            let c = &self.sim.worlds[w].cells[i];
            self.focus = (c.x, c.y, c.mass);
        }
        let multi = self.net.is_some() && self.sim.pls.len() > 1;
        for (pid, w) in std::mem::take(&mut self.sim.pending_state) {
            if let (Some(n), true) = (&self.net, pid != self.my_id && self.sim.pls.contains_key(&pid)) {
                n.send(&self.sim.plants_msg(pid, w));
            }
        }
        self.snap_t += dt;
        if self.snap_t >= if self.sim.pls.len() > 4 { 1.0 / 12.0 } else { 1.0 / 20.0 } {
            self.snap_t = 0.0;
            if multi {
                let my = self.my_id;
                for s in self.sim.snapshots(my) {
                    if let (Some(n), Ok(text)) = (&self.net, serde_json::to_string(&s)) {
                        n.send_str(&text);
                    }
                }
            } else {
                self.sim.evq.clear();
                for wd in self.sim.worlds.iter_mut() {
                    wd.plant_diff.clear();
                }
            }
        }
    }

    fn step_client(&mut self, dt: f64) {
        if !self.ready {
            self.hello_t -= dt;
            if self.hello_t <= 0.0 {
                self.hello_t = 2.0;
                if let Some(n) = &self.net {
                    n.send(&serde_json::json!({ "t": "hello", "name": self.name }));
                }
            }
            return;
        }
        let k = 1.0 - (-dt * 22.0).exp();
        for v in self.views.values_mut() {
            v.x = wrap_pos(v.x + wrap_d(v.tx - v.x) * k);
            v.y = wrap_pos(v.y + wrap_d(v.ty - v.y) * k);
            v.angle += wrap_angle(v.tangle - v.angle) * k;
            v.local = v.pid == Some(self.my_id);
        }
        let st = self.view_stage.idx();
        for f in self.plants[st].iter_mut() {
            f.bob += dt * 2.0;
        }
        let t = self.t;
        for m in self.meat.iter_mut() {
            m.bob = t * 2.0 + m.x * 0.37;
        }
        let me = self.views.get(&(true, self.my_id)).map(|v| (v.x, v.y, v.mass));
        if let Some(m) = me {
            self.focus = m;
        }
        self.in_t += dt;
        if self.in_t >= 0.05 {
            self.in_t = 0.0;
            let w = match me {
                Some((x, y, _)) => self.local_target(x, y).unwrap_or((x, y)),
                None => (self.focus.0, self.focus.1),
            };
            if let Some(n) = &self.net {
                n.send(&serde_json::json!({ "t": "in", "x": w.0.round(), "y": w.1.round() }));
            }
        }
    }

    fn update_camera(&mut self, dt: f64) {
        let f = self.focus;
        let k = 1.0 - (-dt * 6.0).exp();
        // the camera never wraps itself; it takes the short way round to the target
        self.cam.0 += wrap_d(f.0 - self.cam.0) * k;
        self.cam.1 += wrap_d(f.1 - self.cam.1) * k;
        let target = (1.25 - f.2.sqrt() * 0.032).max(0.3);
        self.zoom += (target - self.zoom) * (1.0 - (-dt * 1.8).exp());
    }

    fn draw(&mut self, stage: Stage, dt: f64) {
        let rec = self.me_rec();
        let breed_ready = rec.as_ref().is_none_or(|r| r.cb <= 0);
        let food_client;
        let (cells, food): (Vec<&Cell>, &[Food]) = if self.is_host {
            (self.sim.worlds[stage.idx()].cells.iter().filter(|c| !c.dead).collect(), &self.sim.worlds[stage.idx()].food)
        } else {
            food_client = self.plants[stage.idx()].iter().chain(self.meat.iter()).cloned().collect::<Vec<_>>();
            (self.views.values().collect(), &food_client)
        };
        let toxins: Vec<(f64, f64, f64, f64)> = if self.is_host {
            self.sim.worlds[stage.idx()].toxins.iter().map(|t| (t.x, t.y, t.r, t.life / t.max)).collect()
        } else {
            self.toxins.clone()
        };
        let mut cam = self.cam;
        if self.shake_t > 0.0 {
            cam.0 += rand(-1.0, 1.0) * self.shake_i * self.size.0;
            cam.1 += rand(-1.0, 1.0) * self.shake_i * self.size.0;
        }
        let scene = Scene { stage, cells, food, toxins, particles: &self.particles, cam, zoom: self.zoom, size: self.size, t: self.t, show_names: !self.room.is_empty(), breed_ready };
        render::draw_world(&self.g, &scene);

        let players: Vec<PlayerRow> = {
            let list: Vec<Rec> = if self.is_host { self.sim.pls.keys().filter_map(|&p| self.sim.rec(p)).collect() } else { self.recs.clone() };
            let mut rows: Vec<PlayerRow> = list.iter().map(|x| PlayerRow { n: x.n.clone(), pop: x.pop, mass: x.mass, species: x.species, st: x.st, me: x.id == self.my_id }).collect();
            rows.sort_by(|a, b| b.mass.cmp(&a.mass));
            rows
        };
        let hud = Hud {
            connecting: !self.ready,
            net_down: self.net.as_ref().is_some_and(|n| n.closed.get()),
            room: self.room.clone(),
            rec,
            players,
            toast: if self.toast_t > 0.0 { self.toast.clone() } else { String::new() },
            toast_alpha: self.toast_t.min(1.0),
            key_breed: settings::key_label(&settings::key("breed")),
            key_split: settings::key_label(&settings::key("split")),
            key_poison: settings::key_label(&settings::key("poison")),
            key_advance: settings::key_label(&settings::key("advance")),
            scroll: (self.cam.0 * self.zoom, self.cam.1 * self.zoom),
        };
        self.ui.draw(&self.g, &hud, stage, self.size, self.t, dt);
    }
}

#[cfg(feature = "debug")]
thread_local! {
    static DEBUG_GAME: RefCell<Option<Shared>> = const { RefCell::new(None) };
}

/// test hook: put the local player's species at `n` members
#[cfg(feature = "debug")]
#[wasm_bindgen]
pub fn debug_set_pop(n: i32) {
    DEBUG_GAME.with(|g| {
        if let Some(g) = g.borrow().as_ref() {
            let mut g = g.borrow_mut();
            let id = g.my_id;
            if let Some(p) = g.sim.pls.get_mut(&id) {
                p.pop = n;
                p.dna += 5000.0;
            }
        }
    });
}

fn run(game: Game) {
    let game: Shared = Rc::new(RefCell::new(game));
    #[cfg(feature = "debug")]
    DEBUG_GAME.with(|g| *g.borrow_mut() = Some(game.clone()));
    let win = window();
    {
        let g = game.clone();
        let cb = Closure::<dyn FnMut(KeyboardEvent)>::new(move |e: KeyboardEvent| g.borrow_mut().on_key(&e));
        let _ = win.add_event_listener_with_callback("keydown", cb.as_ref().unchecked_ref());
        cb.forget();
        let g = game.clone();
        let cb = Closure::<dyn FnMut(KeyboardEvent)>::new(move |e: KeyboardEvent| {
            g.borrow_mut().down.remove(&e.code());
        });
        let _ = win.add_event_listener_with_callback("keyup", cb.as_ref().unchecked_ref());
        cb.forget();
        let g = game.clone();
        let cb = Closure::<dyn FnMut()>::new(move || g.borrow_mut().down.clear());
        let _ = win.add_event_listener_with_callback("blur", cb.as_ref().unchecked_ref());
        cb.forget();
    }
    {
        let canvas = game.borrow().canvas.clone();
        let g = game.clone();
        let cb = Closure::<dyn FnMut(PointerEvent)>::new(move |e: PointerEvent| g.borrow_mut().on_pointer_down(e.client_x() as f64, e.client_y() as f64));
        let _ = canvas.add_event_listener_with_callback("pointerdown", cb.as_ref().unchecked_ref());
        cb.forget();
        let g = game.clone();
        let cb = Closure::<dyn FnMut(PointerEvent)>::new(move |e: PointerEvent| {
            let mut g = g.borrow_mut();
            let p = (e.client_x() as f64, e.client_y() as f64);
            if (p.0 - g.pointer.0).abs() + (p.1 - g.pointer.1).abs() > 2.0 {
                g.kb_mode = false;
            }
            g.pointer = p;
        });
        let _ = canvas.add_event_listener_with_callback("pointermove", cb.as_ref().unchecked_ref());
        cb.forget();
    }
    // the animation loop
    let f: Rc<RefCell<Option<Closure<dyn FnMut(f64)>>>> = Rc::new(RefCell::new(None));
    let f2 = f.clone();
    *f2.borrow_mut() = Some(Closure::new(move |ts: f64| {
        game.borrow_mut().frame(ts);
        let _ = window().request_animation_frame(f.borrow().as_ref().unwrap().as_ref().unchecked_ref());
    }));
    let _ = window().request_animation_frame(f2.borrow().as_ref().unwrap().as_ref().unchecked_ref());
    std::mem::forget(f2);
}

#[wasm_bindgen(start)]
pub fn start() {
    std::panic::set_hook(Box::new(|info| web_sys::console::error_1(&format!("{info}").into())));
    settings::mount();
    lobby::run(|boot| run(Game::new(boot)));
}
