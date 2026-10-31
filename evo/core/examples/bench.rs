//! how long one server tick takes with N players: `cargo run --release --example bench -- 40`
use evo_core::sim::Sim;
use serde_json::json;
use std::time::Instant;

fn main() {
    let n: u32 = std::env::args().nth(1).and_then(|s| s.parse().ok()).unwrap_or(40);
    let mut sim = Sim::new();
    for id in 1..=n {
        sim.add_player(id, "p", None);
    }
    let (mut step_t, mut snap_t, mut bytes) = (0.0, 0.0, 0usize);
    let ticks = 600;
    for tick in 0..ticks {
        for id in 1..=n {
            let a = tick as f64 * 0.01 + id as f64 * 2.4;
            // players are spread over the whole world, each wandering around its own spot
            let (cx, cy) = ((id as f64 * 1973.0) % 8000.0, (id as f64 * 3217.0) % 8000.0);
            sim.act(id, &json!({ "t": "in", "x": cx + a.cos() * 700.0, "y": cy + a.sin() * 700.0 }));
        }
        let t = Instant::now();
        sim.step(1.0 / 30.0);
        sim.local_fx.clear();
        step_t += t.elapsed().as_secs_f64();
        if tick % 2 == 0 {
            let t = Instant::now();
            for s in sim.snapshots(u32::MAX) {
                bytes += serde_json::to_string(&s).unwrap().len();
            }
            snap_t += t.elapsed().as_secs_f64();
        }
    }
    println!("{n} players: step {:.2} ms/tick, snapshots {:.2} ms each, {:.0} KB/s total out", step_t / ticks as f64 * 1000.0, snap_t / (ticks / 2) as f64 * 1000.0, bytes as f64 / (ticks as f64 / 30.0) / 1024.0);
}
