//! evo tribe server: the stage after the animals. Land species that reach full strength are
//! handed over by the animal server (see `/internal/handoff`) and join one persistent world of
//! tribes. This service simulates that world on a tick loop and streams each tribe what it can see.
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
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
};
use evo_core::tribe::{TribeCarry, Tribes};
use evo_core::util::rand01;
use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use tokio::sync::mpsc::{Sender, channel};

const DEFAULT_MAX_PLAYERS: usize = 60;
const QUEUE_LEN: usize = 64;
const TICK_MS: u64 = 40;
const SNAP_EVERY: u32 = 2;
/// resources and fog change slowly, so the full resource list goes out only every Nth snapshot
const NODES_EVERY: u32 = 4;
const TICKET_TTL: Duration = Duration::from_secs(60);

#[derive(Clone)]
struct App {
    world: Arc<Mutex<Tribes>>,
    conns: Arc<Mutex<HashMap<u32, Sender<String>>>>,
    tickets: Arc<Mutex<HashMap<String, (TribeCarry, Instant)>>>,
    next_id: Arc<AtomicU32>,
    max_players: usize,
    token: String,
}

fn new_ticket() -> String {
    let mut bytes = [0u8; 16];
    let ok = std::fs::File::open("/dev/urandom").and_then(|mut f| std::io::Read::read_exact(&mut f, &mut bytes)).is_ok();
    if !ok {
        for b in bytes.iter_mut() {
            *b = (rand01() * 256.0) as u8;
        }
    }
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

impl App {
    fn join(&self, ticket: &str, tx: &Sender<String>) -> Result<u32, &'static str> {
        let carry = {
            let mut tickets = self.tickets.lock().unwrap();
            tickets.retain(|_, (_, at)| at.elapsed() < TICKET_TTL);
            tickets.remove(ticket).map(|t| t.0)
        };
        let Some(carry) = carry else { return Err("That invitation to the tribes has expired") };
        let mut world = self.world.lock().unwrap();
        if world.tribes.len() >= self.max_players {
            return Err("The tribes' land is full, try again in a moment");
        }
        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        world.add_tribe(id, carry);
        drop(world);
        self.conns.lock().unwrap().insert(id, tx.clone());
        let _ = tx.try_send(json!({ "t": "twelcome", "id": id }).to_string());
        Ok(id)
    }

    fn handle(&self, id: u32, v: &Value) {
        match v["t"].as_str().unwrap_or("") {
            "ping" => {}
            "respawn" => self.world.lock().unwrap().respawn(id),
            _ => self.world.lock().unwrap().command(id, v),
        }
    }

    fn leave(&self, id: u32) {
        self.conns.lock().unwrap().remove(&id);
        self.world.lock().unwrap().remove_tribe(id);
    }

    async fn run_world(self) {
        let mut tick = tokio::time::interval(Duration::from_millis(TICK_MS));
        tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let (mut last, mut n, mut snaps) = (Instant::now(), 0u32, 0u32);
        loop {
            tick.tick().await;
            let now = Instant::now();
            let dt = now.duration_since(last).as_secs_f64().min(0.1);
            last = now;
            n = n.wrapping_add(1);
            let mut out: Vec<(u32, String)> = Vec::new();
            {
                let mut world = self.world.lock().unwrap();
                if world.tribes.is_empty() {
                    continue; // the land waits for the next tribe
                }
                world.step(dt);
                if n % SNAP_EVERY == 0 {
                    snaps = snaps.wrapping_add(1);
                    for s in world.snapshots(snaps % NODES_EVERY == 1) {
                        if let Ok(text) = serde_json::to_string(&s) {
                            out.push((s.to, text));
                        }
                    }
                }
            }
            if !out.is_empty() {
                let conns = self.conns.lock().unwrap();
                for (pid, text) in out {
                    if let Some(tx) = conns.get(&pid) {
                        let _ = tx.try_send(text);
                    }
                }
            }
        }
    }
}

async fn health() -> &'static str {
    "ok"
}

async fn info(State(app): State<App>) -> Json<Value> {
    Json(json!({ "tribes": app.world.lock().unwrap().tribes.len(), "max": app.max_players }))
}

/// called by the animal server: stores the carried-over genes and returns a one-time ticket
async fn handoff(State(app): State<App>, headers: HeaderMap, body: String) -> impl IntoResponse {
    if !app.token.is_empty() && headers.get("x-evo-token").and_then(|v| v.to_str().ok()) != Some(app.token.as_str()) {
        return (StatusCode::UNAUTHORIZED, Json(json!({ "error": "bad token" })));
    }
    let Ok(carry) = serde_json::from_str::<TribeCarry>(&body) else {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "bad carry" })));
    };
    if app.world.lock().unwrap().tribes.len() >= app.max_players {
        return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({ "error": "full" })));
    }
    let ticket = new_ticket();
    app.tickets.lock().unwrap().insert(ticket.clone(), (carry, Instant::now()));
    (StatusCode::OK, Json(json!({ "ticket": ticket })))
}

async fn ws_handler(ws: WebSocketUpgrade, State(app): State<App>) -> impl IntoResponse {
    ws.max_message_size(16 * 1024).on_upgrade(move |socket| serve(socket, app))
}

async fn serve(socket: WebSocket, app: App) {
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
                    match app.join(v["ticket"].as_str().unwrap_or(""), &tx) {
                        Ok(id) => joined = Some(id),
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
        world: Arc::new(Mutex::new(Tribes::new())),
        conns: Arc::default(),
        tickets: Arc::default(),
        next_id: Arc::default(),
        max_players: std::env::var("MAX_PLAYERS").ok().and_then(|v| v.parse().ok()).unwrap_or(DEFAULT_MAX_PLAYERS),
        token: std::env::var("INTERNAL_TOKEN").unwrap_or_default(),
    };
    tokio::spawn(app_state.clone().run_world());
    let app = Router::new()
        .route("/healthz", get(health))
        .route("/tribe/info", get(info))
        .route("/tribe/ws", get(ws_handler))
        .route("/internal/handoff", post(handoff))
        .with_state(app_state);
    let addr = format!("0.0.0.0:{port}");
    println!("evo-tribe listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
