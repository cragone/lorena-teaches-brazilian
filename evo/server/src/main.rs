//! evo game server. It runs the whole world (the pond and the land) on its own tick loop and
//! streams each connected player a snapshot of what is near them. Because the world lives here and
//! not in anybody's browser, it keeps running when players come and go, and nobody has to host.
use std::{
    collections::HashMap,
    sync::{
        Arc, Mutex,
        atomic::{AtomicU32, Ordering},
    },
    time::{Duration, Instant},
};

use axum::{
    Json, Router,
    extract::{
        State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    response::IntoResponse,
    routing::get,
};
use evo_core::sim::Sim;
use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use tokio::sync::mpsc::{Sender, channel};

/// Players in the world; override with MAX_PLAYERS.
const DEFAULT_MAX_PLAYERS: usize = 60;
/// Messages queued per connection; a client that falls this far behind just misses some snapshots.
const QUEUE_LEN: usize = 64;
const WORLD_CODE: &str = "WORLD";
/// Simulation steps per second, and how many steps between snapshots.
const TICK_MS: u64 = 40;
const SNAP_EVERY: u32 = 2;

#[derive(Clone)]
struct App {
    sim: Arc<Mutex<Sim>>,
    conns: Arc<Mutex<HashMap<u32, Sender<String>>>>,
    next_id: Arc<AtomicU32>,
    max_players: usize,
    /// where the tribe service listens inside the cluster, and the secret shared with it
    tribe_addr: String,
    token: String,
}

impl App {
    /// add a player to the world; Err carries what to tell them
    fn join(&self, name: &str, land: bool, tx: &Sender<String>) -> Result<u32, &'static str> {
        let mut sim = self.sim.lock().unwrap();
        if sim.pls.len() >= self.max_players {
            return Err("The world is full, try again in a moment");
        }
        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        if land {
            sim.add_player_on_land(id, name);
        } else {
            sim.add_player(id, name, None);
        }
        let plants = sim.plants_msg(id, sim.pls[&id].stage.idx()).to_string();
        drop(sim);
        self.conns.lock().unwrap().insert(id, tx.clone());
        let _ = tx.try_send(json!({ "t": "welcome", "id": id, "room": WORLD_CODE, "host": false }).to_string());
        let _ = tx.try_send(plants);
        Ok(id)
    }

    /// a player who chose to start as a tribe: no animal at all, straight to the tribe service
    async fn join_tribe(&self, name: &str, tx: &Sender<String>) -> Result<(), &'static str> {
        use evo_core::model::{Diet, PLAYER_COLORS, Traits};
        let seed = name.bytes().fold(Instant::now().elapsed().subsec_nanos() as usize, |a, b| a.wrapping_mul(31).wrapping_add(b as usize));
        let carry = evo_core::tribe::TribeCarry { name: name.chars().take(16).collect(), color: PLAYER_COLORS[seed % PLAYER_COLORS.len()], dna: 400.0, traits: Traits { diet: Diet::Omni, ..Default::default() }, unlocks: Vec::new(), friends: 0, species: 1 };
        let body = serde_json::to_string(&carry).unwrap_or_default();
        let ticket = post_json(&self.tribe_addr, "/internal/handoff", &self.token, &body).await.ok().and_then(|r| serde_json::from_str::<Value>(&r).ok()).and_then(|v| v["ticket"].as_str().map(str::to_string));
        let Some(ticket) = ticket else { return Err("The tribes are not ready yet, try again in a moment") };
        let _ = tx.try_send(json!({ "t": "welcome", "id": 0, "room": WORLD_CODE, "host": false }).to_string());
        let _ = tx.try_send(json!({ "t": "handoff", "ticket": ticket }).to_string());
        Ok(())
    }

    fn handle(&self, id: u32, v: &Value) {
        match v["t"].as_str().unwrap_or("") {
            "ping" => {}
            "hello" => {
                // the client is still waiting for the plants of its world: send them again
                let sim = self.sim.lock().unwrap();
                let Some(p) = sim.pls.get(&id) else { return };
                let msg = sim.plants_msg(id, p.stage.idx()).to_string();
                drop(sim);
                if let Some(tx) = self.conns.lock().unwrap().get(&id) {
                    let _ = tx.try_send(msg);
                }
            }
            _ => self.sim.lock().unwrap().act(id, v),
        }
    }

    fn leave(&self, id: u32) {
        self.conns.lock().unwrap().remove(&id);
        self.sim.lock().unwrap().remove_player(id);
    }

    /// a land species became a tribe: get a ticket from the tribe service and send the player over
    async fn hand_to_tribes(&self, pid: u32, carry: evo_core::tribe::TribeCarry) {
        let body = serde_json::to_string(&carry).unwrap_or_default();
        let ticket = post_json(&self.tribe_addr, "/internal/handoff", &self.token, &body).await.ok().and_then(|r| serde_json::from_str::<Value>(&r).ok()).and_then(|v| v["ticket"].as_str().map(str::to_string));
        match ticket {
            Some(ticket) => {
                if let Some(tx) = self.conns.lock().unwrap().get(&pid) {
                    let _ = tx.try_send(json!({ "t": "handoff", "ticket": ticket }).to_string());
                }
                // the client reconnects to the tribes; give it a moment, then free its animal
                tokio::time::sleep(Duration::from_secs(2)).await;
                self.leave(pid);
            }
            None => self.sim.lock().unwrap().cancel_handoff(pid, "The tribes are not ready yet.\nTry again in a moment"),
        }
    }

    /// advance the world and send snapshots; runs for the life of the server
    async fn run_world(self) {
        let mut tick = tokio::time::interval(Duration::from_millis(TICK_MS));
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut last = Instant::now();
        let mut n = 0u32;
        loop {
            tick.tick().await;
            let now = Instant::now();
            let dt = now.duration_since(last).as_secs_f64().min(0.05);
            last = now;
            n = n.wrapping_add(1);
            let mut out: Vec<(u32, String)> = Vec::new();
            let mut handoffs = Vec::new();
            {
                let mut sim = self.sim.lock().unwrap();
                if sim.pls.is_empty() {
                    // nobody is in the world: it waits, exactly as they left it
                    sim.local_fx.clear();
                    sim.evq.clear();
                    continue;
                }
                sim.step(dt);
                sim.local_fx.clear();
                handoffs.extend(sim.take_handoffs());
                for (pid, w) in std::mem::take(&mut sim.pending_state) {
                    if sim.pls.contains_key(&pid) {
                        out.push((pid, sim.plants_msg(pid, w).to_string()));
                    }
                }
                if n % SNAP_EVERY == 0 {
                    for s in sim.snapshots(u32::MAX) {
                        if let Ok(text) = serde_json::to_string(&s) {
                            out.push((s.to, text));
                        }
                    }
                } else {
                    // events wait for the next snapshot
                }
            }
            for (pid, carry) in handoffs {
                let app = self.clone();
                tokio::spawn(async move { app.hand_to_tribes(pid, carry).await });
            }
            if !out.is_empty() {
                let conns = self.conns.lock().unwrap();
                for (pid, text) in out {
                    if let Some(tx) = conns.get(&pid) {
                        let _ = tx.try_send(text); // a slow client just misses this one
                    }
                }
            }
        }
    }
}

/// a minimal HTTP/1.1 POST over a plain TCP connection: the tribe service is inside the cluster
async fn post_json(addr: &str, path: &str, token: &str, body: &str) -> Result<String, String> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let work = async {
        let mut s = tokio::net::TcpStream::connect(addr).await.map_err(|e| e.to_string())?;
        let req = format!("POST {path} HTTP/1.1\r\nHost: {addr}\r\nContent-Type: application/json\r\nX-Evo-Token: {token}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
        s.write_all(req.as_bytes()).await.map_err(|e| e.to_string())?;
        let mut buf = Vec::new();
        s.read_to_end(&mut buf).await.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&buf).to_string();
        if !text.starts_with("HTTP/1.1 200") {
            return Err(text.lines().next().unwrap_or("no response").to_string());
        }
        Ok(text.split("\r\n\r\n").nth(1).unwrap_or("").to_string())
    };
    tokio::time::timeout(Duration::from_secs(4), work).await.map_err(|_| "timed out".to_string())?
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

/// the lobby shows how many are in the one world
async fn rooms(State(app): State<App>) -> Json<Value> {
    let players = app.sim.lock().unwrap().pls.len();
    Json(json!([{ "code": WORLD_CODE, "players": players, "max": app.max_players }]))
}

async fn ws_handler(ws: WebSocketUpgrade, State(app): State<App>) -> impl IntoResponse {
    ws.max_message_size(16 * 1024).on_upgrade(move |socket| handle(socket, app))
}

async fn handle(socket: WebSocket, app: App) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = channel::<String>(QUEUE_LEN);
    let writer = tokio::spawn(async move {
        while let Some(m) = rx.recv().await {
            if sink.send(Message::Text(m.into())).await.is_err() {
                break;
            }
        }
    });

    let mut joined: Option<u32> = None;
    while let Some(Ok(msg)) = stream.next().await {
        let Message::Text(text) = msg else { continue };
        let Ok(v) = serde_json::from_str::<Value>(&text) else { continue };
        match joined {
            None => {
                if v["t"] == "join" {
                    // players may start at any stage: cell (default), land animal, or tribe
                    let name = v["name"].as_str().unwrap_or("cell");
                    let result = match v["stage"].as_str() {
                        Some("tribe") => app.join_tribe(name, &tx).await.map(|_| None),
                        stage => app.join(name, stage == Some("land"), &tx).map(Some),
                    };
                    match result {
                        Ok(Some(id)) => joined = Some(id),
                        Ok(None) => break, // handed straight to the tribes; the queued messages are flushed below
                        Err(m) => {
                            let _ = tx.try_send(json!({ "t": "error", "m": m }).to_string());
                            break;
                        }
                    }
                }
            }
            Some(id) => app.handle(id, &v),
        }
    }
    if let Some(id) = joined {
        app.leave(id);
    }
    drop(tx);
    let _ = writer.await;
}

#[tokio::main]
async fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "80".into());
    let app_state = App {
        sim: Arc::new(Mutex::new(Sim::new())),
        conns: Arc::default(),
        next_id: Arc::default(),
        tribe_addr: std::env::var("TRIBE_ADDR").unwrap_or_else(|_| "127.0.0.1:4200".into()),
        token: std::env::var("INTERNAL_TOKEN").unwrap_or_default(),
        max_players: std::env::var("MAX_PLAYERS").ok().and_then(|v| v.parse().ok()).unwrap_or(DEFAULT_MAX_PLAYERS),
    };
    tokio::spawn(app_state.clone().run_world());

    let app = Router::new().route("/api/health", get(health)).route("/api/rooms", get(rooms)).route("/ws", get(ws_handler)).with_state(app_state);

    let addr = format!("0.0.0.0:{port}");
    println!("evo-server listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn post_json_reads_the_ticket_from_the_tribe_service() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap().to_string();
        tokio::spawn(async move {
            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            let (mut s, _) = listener.accept().await.unwrap();
            let mut buf = vec![0u8; 4096];
            let n = s.read(&mut buf).await.unwrap();
            let req = String::from_utf8_lossy(&buf[..n]).to_string();
            assert!(req.starts_with("POST /internal/handoff HTTP/1.1"));
            assert!(req.contains("X-Evo-Token: secret") && req.ends_with("{\"a\":1}"));
            let body = "{\"ticket\":\"abc123\"}";
            let resp = format!("HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}", body.len());
            s.write_all(resp.as_bytes()).await.unwrap();
        });
        let r = post_json(&addr, "/internal/handoff", "secret", "{\"a\":1}").await.unwrap();
        assert_eq!(serde_json::from_str::<Value>(&r).unwrap()["ticket"], "abc123");
    }

    #[tokio::test]
    async fn post_json_fails_cleanly_when_the_tribes_are_down() {
        assert!(post_json("127.0.0.1:1", "/internal/handoff", "", "{}").await.is_err());
    }
}
