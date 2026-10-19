use std::{
    collections::HashMap,
    sync::{
        Arc, Mutex,
        atomic::{AtomicU32, Ordering},
    },
    time::{SystemTime, UNIX_EPOCH},
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
use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use tokio::sync::mpsc::{UnboundedSender, unbounded_channel};
use tower_http::services::ServeDir;

/// Players per room; override with MAX_PLAYERS. Render distance keeps per-player snapshots small.
const DEFAULT_MAX_PLAYERS: usize = 24;
/// Cells and meat further than this from a player are left out of that player's snapshots.
/// Wide enough to cover the client's most zoomed-out view; override with RENDER_DISTANCE.
const DEFAULT_RENDER_DISTANCE: f64 = 3800.0;
const CODE_LETTERS: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ";

struct Member {
    id: u32,
    tx: UnboundedSender<String>,
    /// last known position, taken from the host's snapshots
    pos: Option<(f64, f64)>,
}

/// One member of a room runs the simulation (the host); the server only relays.
struct Room {
    members: Vec<Member>,
    host: u32,
}

#[derive(Clone, Default)]
struct App {
    rooms: Arc<Mutex<HashMap<String, Room>>>,
    next_id: Arc<AtomicU32>,
    render_distance: f64,
    max_players: usize,
}

impl App {
    fn join(&self, v: &Value, tx: &UnboundedSender<String>) -> Option<(String, u32)> {
        let name: String = v["name"].as_str().unwrap_or("cell").chars().take(16).collect();
        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let mut rooms = self.rooms.lock().unwrap();
        if v["create"].as_bool().unwrap_or(false) {
            let mut seed = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos() as u64 ^ (id as u64) << 32;
            let code = loop {
                let mut c = String::new();
                for _ in 0..4 {
                    seed ^= seed << 13;
                    seed ^= seed >> 7;
                    seed ^= seed << 17;
                    c.push(CODE_LETTERS[(seed % CODE_LETTERS.len() as u64) as usize] as char);
                }
                if !rooms.contains_key(&c) {
                    break c;
                }
            };
            rooms.insert(code.clone(), Room { members: vec![Member { id, tx: tx.clone(), pos: None }], host: id });
            let _ = tx.send(json!({ "t": "welcome", "id": id, "room": code, "host": true }).to_string());
            return Some((code, id));
        }
        let code = v["room"].as_str().unwrap_or("").trim().to_uppercase();
        let err = |m: &str| {
            let _ = tx.send(json!({ "t": "error", "m": m }).to_string());
        };
        match rooms.get_mut(&code) {
            None => {
                err("No room with that code");
                None
            }
            Some(room) if room.members.len() >= self.max_players => {
                err("Room is full");
                None
            }
            Some(room) => {
                room.members.push(Member { id, tx: tx.clone(), pos: None });
                let _ = tx.send(json!({ "t": "welcome", "id": id, "room": code, "host": false }).to_string());
                if let Some(h) = room.members.iter().find(|m| m.id == room.host) {
                    let _ = h.tx.send(json!({ "t": "join", "id": id, "name": name }).to_string());
                }
                Some((code, id))
            }
        }
    }

    /// Send the host's snapshot to each player with only what is within render distance of them.
    fn relay_snapshot(&self, room: &mut Room, v: &Value) {
        let empty = Vec::new();
        let cells = v["c"].as_array().unwrap_or(&empty);
        let meat = v["m"].as_array().unwrap_or(&empty);
        // kind 2 = player cell; [id, kind, color, x, y, ...]
        for c in cells.iter().filter(|c| c[1] == 2) {
            if let (Some(pid), Some(x), Some(y)) = (c[0].as_u64(), c[3].as_f64(), c[4].as_f64()) {
                if let Some(m) = room.members.iter_mut().find(|m| m.id as u64 == pid) {
                    m.pos = Some((x, y));
                }
            }
        }
        let r2 = self.render_distance * self.render_distance;
        let near = |p: (f64, f64), x: Option<f64>, y: Option<f64>| match (x, y) {
            (Some(x), Some(y)) => (x - p.0).powi(2) + (y - p.1).powi(2) <= r2,
            _ => true,
        };
        for m in room.members.iter().filter(|m| m.id != room.host) {
            let mut out = v.clone();
            if let Some(p) = m.pos {
                out["c"] = cells.iter().filter(|c| near(p, c[3].as_f64(), c[4].as_f64())).cloned().collect();
                out["m"] = meat.iter().filter(|e| near(p, e[0].as_f64(), e[1].as_f64())).cloned().collect();
            }
            let _ = m.tx.send(out.to_string());
        }
    }

    fn route(&self, code: &str, id: u32, text: &str, mut v: Value) {
        let t = v["t"].as_str().unwrap_or("").to_string();
        if t == "ping" {
            return;
        }
        let mut rooms = self.rooms.lock().unwrap();
        let Some(room) = rooms.get_mut(code) else { return };
        if id == room.host {
            if t == "snap" && v["to"].is_null() {
                self.relay_snapshot(room, &v);
                return;
            }
            // host -> one player (`to`) or everybody else
            match v["to"].as_u64() {
                Some(to) => {
                    if let Some(m) = room.members.iter().find(|m| m.id as u64 == to) {
                        let _ = m.tx.send(text.to_string());
                    }
                }
                None => {
                    for m in room.members.iter().filter(|m| m.id != room.host) {
                        let _ = m.tx.send(text.to_string());
                    }
                }
            }
        } else if matches!(t.as_str(), "in" | "bite" | "breed" | "buy" | "diet" | "close") {
            v["from"] = json!(id);
            if let Some(h) = room.members.iter().find(|m| m.id == room.host) {
                let _ = h.tx.send(v.to_string());
            }
        }
    }

    fn leave(&self, code: &str, id: u32) {
        let mut rooms = self.rooms.lock().unwrap();
        let Some(room) = rooms.get_mut(code) else { return };
        room.members.retain(|m| m.id != id);
        if room.members.is_empty() {
            rooms.remove(code);
            return;
        }
        if room.host == id {
            // host migration: the next player takes over the simulation
            room.host = room.members[0].id;
            let _ = room.members[0].tx.send(json!({ "t": "host", "left": id }).to_string());
        } else if let Some(h) = room.members.iter().find(|m| m.id == room.host) {
            let _ = h.tx.send(json!({ "t": "leave", "id": id }).to_string());
        }
    }
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

async fn rooms(State(app): State<App>) -> Json<Value> {
    let rooms = app.rooms.lock().unwrap();
    let mut list: Vec<Value> = rooms
        .iter()
        .map(|(code, r)| json!({ "code": code, "players": r.members.len(), "max": app.max_players }))
        .collect();
    list.sort_by_key(|r| r["code"].as_str().unwrap_or("").to_string());
    Json(Value::Array(list))
}

async fn ws_handler(ws: WebSocketUpgrade, State(app): State<App>) -> impl IntoResponse {
    ws.max_message_size(1024 * 1024).on_upgrade(move |socket| handle(socket, app))
}

async fn handle(socket: WebSocket, app: App) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = unbounded_channel::<String>();
    let writer = tokio::spawn(async move {
        while let Some(m) = rx.recv().await {
            if sink.send(Message::Text(m.into())).await.is_err() {
                break;
            }
        }
    });

    let mut joined: Option<(String, u32)> = None;
    while let Some(Ok(msg)) = stream.next().await {
        let Message::Text(text) = msg else { continue };
        let Ok(v) = serde_json::from_str::<Value>(&text) else { continue };
        match &joined {
            None => {
                if v["t"] == "join" {
                    joined = app.join(&v, &tx);
                    if joined.is_none() {
                        break;
                    }
                }
            }
            Some((code, id)) => app.route(code, *id, &text, v),
        }
    }
    if let Some((code, id)) = joined {
        app.leave(&code, id);
    }
    drop(tx);
    let _ = writer.await;
}

#[tokio::main]
async fn main() {
    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "public".into());
    let port = std::env::var("PORT").unwrap_or_else(|_| "80".into());

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/rooms", get(rooms))
        .route("/ws", get(ws_handler))
        .fallback_service(ServeDir::new(static_dir))
        .with_state(App {
            render_distance: std::env::var("RENDER_DISTANCE").ok().and_then(|v| v.parse().ok()).unwrap_or(DEFAULT_RENDER_DISTANCE),
            max_players: std::env::var("MAX_PLAYERS").ok().and_then(|v| v.parse().ok()).unwrap_or(DEFAULT_MAX_PLAYERS),
            ..Default::default()
        });

    let addr = format!("0.0.0.0:{port}");
    println!("evo listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
