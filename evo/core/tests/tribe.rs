use evo_core::model::*;
use evo_core::tribe::*;
use serde_json::json;

fn carry(name: &str, traits: Traits) -> TribeCarry {
    TribeCarry { name: name.into(), color: 0x4fc3f7, dna: 1000.0, traits, unlocks: vec![], friends: 0, species: 1 }
}

fn villagers(w: &Tribes, owner: u32) -> Vec<u32> {
    w.units.iter().filter(|u| u.owner == owner && u.kind == UK::Villager).map(|u| u.id).collect()
}
fn center(w: &Tribes, owner: u32) -> (u32, f64, f64) {
    let b = w.buildings.iter().find(|b| b.owner == owner && b.kind == BK::Center).unwrap();
    (b.id, b.x, b.y)
}
fn run(w: &mut Tribes, secs: f64) {
    for _ in 0..(secs * 20.0) as usize {
        w.step(0.05);
    }
}

#[test]
fn a_new_tribe_gets_a_camp_and_carried_over_bonuses() {
    let mut w = Tribes::new();
    let t = Traits { speed: 2, claws: 3, mitosis: 2, tough: 1, diet: Diet::Herb, ..Default::default() };
    w.add_tribe(1, carry("fern", t));
    assert!(w.buildings.iter().any(|b| b.owner == 1 && b.kind == BK::Center));
    assert_eq!(villagers(&w, 1).len(), 3 + 2, "pack animals become extra first villagers");
    let tribe = &w.tribes[&1];
    assert!(tribe.res[1] > 200.0, "points carry over as starting stores");
    assert!(tribe.mods.speed > 1.1 && tribe.mods.melee > 1.3 && tribe.mods.farm > 1.3);
}

#[test]
fn befriended_animals_join_as_beasts() {
    let mut w = Tribes::new();
    let mut c = carry("pack", Traits::default());
    c.friends = 2;
    w.add_tribe(1, c);
    assert_eq!(w.units.iter().filter(|u| u.owner == 1 && u.kind == UK::Beast).count(), 2);
}

#[test]
fn villagers_gather_wood_and_bring_it_home() {
    let mut w = Tribes::new();
    w.add_tribe(1, carry("a", Traits::default()));
    let (_, cx, cy) = center(&w, 1);
    // the closest tree
    let tree = w.nodes.iter().filter(|n| n.kind == RK::Tree).min_by(|a, b| (a.x - cx).hypot(a.y - cy).partial_cmp(&(b.x - cx).hypot(b.y - cy)).unwrap()).map(|n| n.id).unwrap();
    let before = w.tribes[&1].res[1];
    let ids = villagers(&w, 1);
    w.command(1, &json!({ "t": "gather", "ids": ids, "target": tree }));
    run(&mut w, 120.0);
    assert!(w.tribes[&1].res[1] > before, "wood should have arrived at the camp");
}

#[test]
fn training_costs_food_and_makes_a_villager() {
    let mut w = Tribes::new();
    w.add_tribe(1, carry("a", Traits::default()));
    let (cid, _, _) = center(&w, 1);
    let (food, n) = (w.tribes[&1].res[0], villagers(&w, 1).len());
    w.command(1, &json!({ "t": "train", "b": cid, "u": "villager" }));
    assert!(w.tribes[&1].res[0] < food);
    run(&mut w, 10.0);
    assert_eq!(villagers(&w, 1).len(), n + 1);
}

#[test]
fn huts_raise_the_population_cap() {
    let mut w = Tribes::new();
    w.add_tribe(1, carry("a", Traits::default()));
    let (_, cx, cy) = center(&w, 1);
    let cap = w.cap(1);
    let ids = villagers(&w, 1);
    // find a free spot by trying a ring around the camp
    for k in 0..40 {
        let a = k as f64 * 0.5;
        w.command(1, &json!({ "t": "build", "ids": ids, "b": "hut", "x": cx + a.cos() * 160.0, "y": cy + a.sin() * 160.0 }));
        if w.buildings.iter().any(|b| b.kind == BK::Hut) {
            break;
        }
    }
    assert!(w.buildings.iter().any(|b| b.kind == BK::Hut), "a hut was placed");
    run(&mut w, 60.0);
    assert!(w.cap(1) > cap);
}

#[test]
fn building_far_from_camp_or_without_resources_is_refused() {
    let mut w = Tribes::new();
    w.add_tribe(1, carry("a", Traits::default()));
    let ids = villagers(&w, 1);
    let (_, cx, cy) = center(&w, 1);
    // the far side of the world from the camp
    w.command(1, &json!({ "t": "build", "ids": ids, "b": "hut", "x": cx + MAP / 2.0, "y": cy + MAP / 2.0 }));
    assert!(!w.buildings.iter().any(|b| b.kind == BK::Hut));
    w.command(1, &json!({ "t": "age" })); // 200 food, 100 wood: affordable
    assert_eq!(w.tribes[&1].age, 2);
    w.command(1, &json!({ "t": "age" })); // the next age is too expensive right now
    assert_eq!(w.tribes[&1].age, 2);
}

#[test]
fn nobody_commands_other_tribes() {
    let mut w = Tribes::new();
    w.add_tribe(1, carry("a", Traits::default()));
    w.add_tribe(2, carry("b", Traits::default()));
    let theirs = villagers(&w, 2);
    w.command(1, &json!({ "t": "move", "ids": theirs.clone(), "x": 10.0, "y": 10.0 }));
    assert!(w.units.iter().filter(|u| theirs.contains(&u.id)).all(|u| u.task == Task::Idle));
}

#[test]
fn a_tribe_without_its_great_hut_falls_and_can_start_again() {
    let mut w = Tribes::new();
    w.add_tribe(1, carry("a", Traits::default()));
    w.add_tribe(2, carry("b", Traits { claws: 3, ..Default::default() }));
    // move tribe 2's camp next to tribe 1 and send warriors
    let (c1, x1, y1) = center(&w, 1);
    for u in w.units.iter_mut().filter(|u| u.owner == 2) {
        u.x = x1 + 150.0;
        u.y = y1;
    }
    for _ in 0..30 {
        let id = w.units.iter().find(|u| u.owner == 2).map(|u| u.id).unwrap();
        let _ = id;
        w.units.push(Unit { id: 90_000 + w.units.len() as u32, owner: 2, kind: UK::Warrior, x: x1 + 120.0, y: y1, hp: 400.0, max: 400.0, task: Task::Attack(c1), cd: 0.0, res: 0, carry: 0.0, ang: 0.0, poison: 0.0, poison_t: 0.0, moving: false, flee_t: 0.0, hurt_t: 0.0, act: 0, dead: false });
    }
    run(&mut w, 90.0);
    assert!(!w.tribes[&1].alive, "the great hut fell");
    assert!(!w.buildings.iter().any(|b| b.owner == 1));
    w.respawn(1);
    assert!(w.tribes[&1].alive);
    assert!(w.buildings.iter().any(|b| b.owner == 1 && b.kind == BK::Center));
}

#[test]
fn snapshots_only_show_what_your_tribe_can_see() {
    let mut w = Tribes::new();
    w.add_tribe(1, carry("a", Traits::default()));
    w.add_tribe(2, carry("b", Traits::default()));
    let snaps = w.snapshots(true);
    let mine = snaps.iter().find(|s| s.to == 1).unwrap();
    assert!(mine.units.iter().all(|u| u[1] == 1.0 || u[1] == 0.0), "no enemy units in sight at the start");
    assert_eq!(mine.me.pop, 3);
    assert!(mine.nodes.as_ref().is_some_and(|n| n.len() < w.nodes.len()), "fog hides far resources");
    let text = serde_json::to_string(mine).unwrap();
    assert!(text.len() < 40_000, "snapshot is {} bytes", text.len());
}

#[test]
fn the_world_refills_and_runs_for_ever() {
    let mut w = Tribes::new();
    w.add_tribe(1, carry("a", Traits::default()));
    run(&mut w, 600.0);
    assert!(w.nodes.iter().filter(|n| n.kind == RK::Tree).count() > 300);
}

#[test]
fn a_group_move_order_fans_out() {
    let mut w = Tribes::new();
    w.add_tribe(1, carry("a", Traits { mitosis: 4, ..Default::default() }));
    let ids = villagers(&w, 1);
    w.command(1, &json!({ "t": "move", "ids": ids.clone(), "x": 3000.0, "y": 3000.0 }));
    let spots: Vec<_> = w.units.iter().filter(|u| ids.contains(&u.id)).filter_map(|u| if let Task::Move(x, y) = u.task { Some((x as i64, y as i64)) } else { None }).collect();
    let distinct: std::collections::HashSet<_> = spots.iter().collect();
    assert_eq!(distinct.len(), ids.len());
}

#[test]
fn the_world_wraps_around() {
    let mut w = Tribes::new();
    w.add_tribe(1, carry("a", Traits::default()));
    // a villager at the right edge told to walk to the left edge takes the short way over the seam
    let id = villagers(&w, 1)[0];
    let i = w.units.iter().position(|u| u.id == id).unwrap();
    w.units[i].x = MAP - 20.0;
    w.units[i].y = 1000.0;
    w.command(1, &json!({ "t": "move", "ids": [id], "x": 30.0, "y": 1000.0 }));
    run(&mut w, 2.0);
    let u = w.units.iter().find(|u| u.id == id).unwrap();
    assert!(u.x < 100.0 || u.x > MAP - 100.0, "walked across the seam, not the whole map: x = {}", u.x);
    assert!(u.x >= 0.0 && u.x < MAP);
    // things on either side of the seam are close together
    assert!(wd(MAP - 10.0 - 10.0) < 0.0 && wd(MAP - 10.0 - 10.0).abs() < 100.0);
}

#[test]
fn units_on_opposite_edges_fight_across_the_seam() {
    let mut w = Tribes::new();
    w.add_tribe(1, carry("a", Traits::default()));
    w.add_tribe(2, carry("b", Traits::default()));
    let (c1, x1, y1) = center(&w, 1);
    // a warrior of tribe 2 just across the seam from tribe 1's camp
    let (sx, sy) = if x1 < MAP / 2.0 { (x1 - 120.0 + MAP, y1) } else { (x1 + 120.0 - MAP, y1) };
    let id = 77_000;
    w.units.push(Unit { id, owner: 2, kind: UK::Warrior, x: wrap(sx), y: wrap(sy), hp: 90.0, max: 90.0, task: Task::Attack(c1), cd: 0.0, res: 0, carry: 0.0, ang: 0.0, poison: 0.0, poison_t: 0.0, moving: false, flee_t: 0.0, hurt_t: 0.0, act: 0, dead: false });
    run(&mut w, 8.0);
    let hp = w.buildings.iter().find(|b| b.id == c1).unwrap().hp;
    assert!(hp < BK::Center.stats().hp, "the warrior reached the camp the short way and hit it");
}

#[test]
fn resources_grow_back_slowly_and_never_past_a_cap() {
    let mut w = Tribes::new();
    w.add_tribe(1, carry("a", Traits::default()));
    let trees = |w: &Tribes| w.nodes.iter().filter(|n| n.kind == RK::Tree).count();
    // strip the land bare, then see how fast it recovers
    w.nodes.retain(|n| n.kind != RK::Tree);
    run(&mut w, 120.0);
    let after_two_minutes = trees(&w);
    assert!((5..=15).contains(&after_two_minutes), "about one tree every 12s, got {after_two_minutes} in 2 minutes");
    // and an overfull world never grows further
    for _ in 0..700 {
        w.nodes.push(Node { id: 5_000_000 + w.nodes.len() as u32, kind: RK::Tree, x: 10.0, y: 10.0, amount: 1.0 });
    }
    let full = trees(&w);
    run(&mut w, 300.0);
    assert!(trees(&w) <= full, "no growth while over the cap");
}

#[test]
fn new_resources_prefer_the_rich_zones() {
    let mut w = Tribes::new();
    w.add_tribe(1, carry("a", Traits::default()));
    w.nodes.retain(|n| n.kind != RK::Tree);
    run(&mut w, 1500.0); // about a hundred new trees
    let forests: Vec<_> = w.zones.iter().filter(|z| z.kind == RK::Tree).collect();
    assert!(forests.len() >= 5);
    let trees: Vec<_> = w.nodes.iter().filter(|n| n.kind == RK::Tree).collect();
    assert!(trees.len() > 60);
    let inside = trees.iter().filter(|n| forests.iter().any(|z| wd(n.x - z.x).hypot(wd(n.y - z.y)) <= z.r)).count();
    assert!(inside as f64 / trees.len() as f64 > 0.75, "{inside} of {} new trees grew in a forest zone", trees.len());
}
