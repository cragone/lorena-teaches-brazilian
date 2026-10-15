use axum::{Json, Router, routing::get};
use serde_json::{Value, json};
use tower_http::services::ServeDir;

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

#[tokio::main]
async fn main() {
    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "public".into());
    let port = std::env::var("PORT").unwrap_or_else(|_| "80".into());

    let app = Router::new()
        .route("/api/health", get(health))
        .fallback_service(ServeDir::new(static_dir));

    let addr = format!("0.0.0.0:{port}");
    println!("evo listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
