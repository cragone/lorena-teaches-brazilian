use wasm_bindgen::JsCast;

pub const WORLD: f64 = 8000.0;
/// cells and meat further than this from a player are left out of that player's snapshots
pub const RENDER_DISTANCE: f64 = 1800.0;
pub const START_MASS: f64 = 20.0;
pub const PLANT_COUNT: usize = 1100;
pub const ENEMY_COUNT: usize = 100; // includes ~40% harmless amoebas
pub const MATE_COUNT: usize = 4;
/// land herds of grazers and hunting packs, and how many animals each has
pub const HERD_COUNT: usize = 4;
pub const HERD_SIZE: usize = 4;
pub const PACK_COUNT: usize = 3;
pub const PACK_SIZE: usize = 3;
pub const FOOD_CELL: f64 = 250.0; // WORLD / FOOD_CELL = 32 cells per side, so the grid wraps cleanly
pub const GRID_N: i32 = 32;
pub const HP_REGEN: f64 = 0.4;
pub const POISON_COOL: f64 = 7.0;
pub const POP_START: i32 = 1;
pub const POP_MAX: i32 = 6;
/// a species that has just crawled onto land starts with this many members
pub const LAND_START_POP: i32 = 2;
pub const BREED_COOLDOWN: f64 = 20.0;
pub const EAT_RATIO: f64 = 1.15;
pub const SPLIT_COOLDOWN: f64 = 10.0;
pub const SPLIT_MIN_MASS: f64 = 28.0;
pub const COLONY_LIFE: f64 = 30.0;
pub const EPIC_CHANCE: f64 = 0.025;
pub const EPIC_MAX: usize = 3;
pub const TAU: f64 = std::f64::consts::TAU;
pub const PI: f64 = std::f64::consts::PI;

// the world is a torus: leave one side and you arrive on the other
pub fn wrap_d(d: f64) -> f64 {
    d - WORLD * (d / WORLD).round()
}
pub fn wrap_pos(v: f64) -> f64 {
    ((v % WORLD) + WORLD) % WORLD
}
pub fn dist2(ax: f64, ay: f64, bx: f64, by: f64) -> f64 {
    wrap_d(ax - bx).hypot(wrap_d(ay - by))
}
pub fn wrap_angle(a: f64) -> f64 {
    let mut a = (a + PI) % TAU;
    if a < 0.0 {
        a += TAU;
    }
    a - PI
}

pub fn rand01() -> f64 {
    js_sys::Math::random()
}
pub fn rand(a: f64, b: f64) -> f64 {
    a + rand01() * (b - a)
}
pub fn rand_int(n: usize) -> usize {
    ((rand01() * n as f64) as usize).min(n - 1)
}

pub fn radius(mass: f64) -> f64 {
    mass.sqrt() * 4.2
}
pub fn base_mass(size: i32) -> f64 {
    START_MASS * 1.4f64.powi(size)
}
pub fn spike_count(lvl: i32) -> i32 {
    if lvl > 0 { 2 + lvl * 3 } else { 0 }
}
pub fn max_speed(mass: f64, speed_lvl: i32, fins_lvl: i32) -> f64 {
    (300.0 / mass.powf(0.22)) * (1.0 + 0.18 * speed_lvl as f64 + 0.35 * fins_lvl as f64)
}

pub fn mix_color(a: u32, b: u32, t: f64) -> u32 {
    let ch = |v: u32, w: u32| ((v as f64) + ((w as f64) - (v as f64)) * t).round() as u32;
    (ch((a >> 16) & 255, (b >> 16) & 255) << 16) | (ch((a >> 8) & 255, (b >> 8) & 255) << 8) | ch(a & 255, b & 255)
}

pub fn shade(c: u32, amt: f64) -> u32 {
    let to = if amt > 0.0 { 255.0 } else { 0.0 };
    let t = amt.abs();
    let ch = |v: u32| ((v as f64) + (to - v as f64) * t).round() as u32;
    (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255)
}

pub fn hsl(h: f64, s: f64, l: f64) -> u32 {
    let h = ((h % 1.0) + 1.0) % 1.0;
    let q = if l < 0.5 { l * (1.0 + s) } else { l + s - l * s };
    let p = 2.0 * l - q;
    let f = |mut t: f64| {
        if t < 0.0 {
            t += 1.0;
        }
        if t > 1.0 {
            t -= 1.0;
        }
        if t < 1.0 / 6.0 {
            p + (q - p) * 6.0 * t
        } else if t < 0.5 {
            q
        } else if t < 2.0 / 3.0 {
            p + (q - p) * (2.0 / 3.0 - t) * 6.0
        } else {
            p
        }
    };
    let c = |v: f64| (v * 255.0).round() as u32;
    (c(f(h + 1.0 / 3.0)) << 16) | (c(f(h)) << 8) | c(f(h - 1.0 / 3.0))
}

pub fn css(color: u32, alpha: f64) -> String {
    format!("rgba({},{},{},{:.3})", (color >> 16) & 255, (color >> 8) & 255, color & 255, alpha.clamp(0.0, 1.0))
}

// ---- tiny procedural audio ---------------------------------------------------
thread_local! {
    static AUDIO: std::cell::RefCell<Option<web_sys::AudioContext>> = const { std::cell::RefCell::new(None) };
}

pub fn sfx(freq: f64, dur: f64, kind: &str, vol: f64, slide: f64) {
    let _ = (|| -> Result<(), wasm_bindgen::JsValue> {
        AUDIO.with(|a| {
            let mut a = a.borrow_mut();
            if a.is_none() {
                *a = Some(web_sys::AudioContext::new()?);
            }
            let ctx = a.as_ref().unwrap();
            let _ = ctx.resume();
            let now = ctx.current_time();
            let o = ctx.create_oscillator()?;
            let g = ctx.create_gain()?;
            o.set_type(match kind {
                "square" => web_sys::OscillatorType::Square,
                "sawtooth" => web_sys::OscillatorType::Sawtooth,
                "triangle" => web_sys::OscillatorType::Triangle,
                _ => web_sys::OscillatorType::Sine,
            });
            o.frequency().set_value_at_time(freq as f32, now)?;
            if slide != 0.0 {
                o.frequency().exponential_ramp_to_value_at_time((freq + slide).max(30.0) as f32, now + dur)?;
            }
            g.gain().set_value_at_time(vol as f32, now)?;
            g.gain().exponential_ramp_to_value_at_time(0.0001, now + dur)?;
            o.connect_with_audio_node(&g)?;
            g.connect_with_audio_node(&ctx.destination())?;
            o.start()?;
            o.stop_with_when(now + dur)?;
            Ok(())
        })
    })();
}

pub fn window() -> web_sys::Window {
    web_sys::window().expect("no window")
}
pub fn document() -> web_sys::Document {
    window().document().expect("no document")
}
pub fn by_id<T: JsCast>(id: &str) -> T {
    document().get_element_by_id(id).unwrap_or_else(|| panic!("missing #{id}")).dyn_into::<T>().unwrap()
}
pub fn now_ms() -> f64 {
    js_sys::Date::now()
}
