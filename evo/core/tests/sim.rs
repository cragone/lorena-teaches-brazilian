use evo_core::model::*;
use evo_core::sim::Sim;
use evo_core::util::*;
use serde_json::json;

fn world_with(n: u32) -> Sim {
    let mut sim = Sim::new();
    for id in 1..=n {
        sim.add_player(id, &format!("p{id}"), None);
    }
    sim
}

#[test]
fn the_world_runs_without_players_waiting() {
    let sim = Sim::new();
    assert!(sim.pls.is_empty());
    assert_eq!(sim.worlds[0].food.len(), PLANT_COUNT);
    // herds and packs live on the land only
    assert!(sim.worlds[1].cells.iter().any(|c| c.pack != 0));
    assert!(!sim.worlds[0].cells.iter().any(|c| c.pack != 0));
}

#[test]
fn many_players_step_and_snapshot_for_a_minute() {
    let mut sim = world_with(8);
    for tick in 0..1800 {
        // everybody wanders and bites
        for id in 1..=8u32 {
            let a = (tick as f64 * 0.01) + id as f64;
            sim.act(id, &json!({ "t": "in", "x": 4000.0 + a.cos() * 900.0, "y": 4000.0 + a.sin() * 900.0 }));
            if tick % 40 == 0 {
                sim.act(id, &json!({ "t": "bite" }));
            }
        }
        sim.step(1.0 / 30.0);
        sim.local_fx.clear();
        if tick % 2 == 0 {
            let snaps = sim.snapshots(u32::MAX);
            assert_eq!(snaps.len(), sim.pls.len());
            for s in &snaps {
                let text = serde_json::to_string(s).unwrap();
                let back: Snap = serde_json::from_str(&text).unwrap();
                assert_eq!(back.to, s.to);
                assert!(back.c.iter().all(|c| c.len() >= 35));
                assert_eq!(back.me.as_ref().map(|r| r.id), Some(s.to));
                assert!(back.top.len() <= 10);
            }
        }
    }
    // everybody is still somewhere in the world, alive or waiting to respawn
    for id in 1..=8u32 {
        assert!(sim.rec(id).is_some());
    }
}

#[test]
fn players_can_leave_and_the_world_keeps_going() {
    let mut sim = world_with(3);
    sim.step(0.03);
    let before = sim.worlds[0].cells.len();
    sim.remove_player(2);
    assert!(sim.rec(2).is_none());
    assert_eq!(sim.worlds[0].cells.len(), before - 1);
    sim.remove_player(1);
    sim.remove_player(3);
    // an empty world is left exactly as it was and can take new players
    let id = 7;
    sim.add_player(id, "late", None);
    for _ in 0..60 {
        sim.step(1.0 / 30.0);
    }
    assert!(sim.rec(id).is_some());
}

#[test]
fn breeding_at_full_strength_evolves_onto_land() {
    let mut sim = world_with(1);
    sim.pls.get_mut(&1).unwrap().pop = POP_MAX;
    // put a mate right next to the player
    let (w, i) = sim.pcell(1).unwrap();
    let (x, y) = (sim.worlds[w].cells[i].x, sim.worlds[w].cells[i].y);
    let m = sim.worlds[w].cells.iter_mut().find(|c| c.is_mate()).unwrap();
    m.x = x + 30.0;
    m.y = y;
    sim.step(1.0 / 30.0); // lets the player notice the mate
    sim.act(1, &json!({ "t": "breed" }));
    let pl = &sim.pls[&1];
    assert_eq!(pl.stage, Stage::Land);
    assert_eq!(pl.pop, LAND_START_POP);
    assert!(sim.worlds[1].cells.iter().any(|c| c.pid == Some(1)));
    assert!(!sim.worlds[0].cells.iter().any(|c| c.pid == Some(1)));
    assert!(sim.pending_state.contains(&(1, 1)), "the client needs the land's plants");
}

#[test]
fn nobody_can_skip_the_breeding() {
    let mut sim = world_with(1);
    sim.pls.get_mut(&1).unwrap().pop = POP_MAX;
    sim.act(1, &json!({ "t": "advance" }));
    assert_eq!(sim.pls[&1].stage, Stage::Water);
}

#[test]
fn water_traits_carry_over_at_half_strength() {
    let t = Traits { speed: 3, fins: 2, spikes: 2, venom: 1, shock: 2, mitosis: 4, tough: 3, size: 3, diet: Diet::Carn, ..Default::default() };
    let l = t.onto_land();
    assert_eq!((l.speed, l.spikes, l.venom, l.shock, l.mitosis, l.tough, l.size), (3, 1, 1, 1, 2, 2, 1));
    assert_eq!(l.diet, Diet::Carn);
}

#[test]
fn land_costs_more() {
    let water = trait_defs(Stage::Water).iter().find(|t| t.key == "speed").unwrap();
    let land = trait_defs(Stage::Land).iter().find(|t| t.key == "speed").unwrap();
    assert_eq!(land.cost(1), (water.cost(1) as f64 * LAND_COST_MULT) as i32);
}

#[test]
fn nobody_can_act_for_somebody_else() {
    let mut sim = world_with(2);
    sim.act(99, &json!({ "t": "bite" })); // unknown player: ignored
    sim.act(1, &json!({ "t": "buy", "key": "speed", "dir": 1 })); // shop closed: ignored
    assert_eq!(sim.pls[&1].traits.speed, 0);
}
