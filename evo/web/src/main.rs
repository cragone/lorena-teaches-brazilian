//! Serves the built evo client (the WASM bundle) as static files. The game server is a
//! separate service; see ../server.
use axum::{Router, http::StatusCode, routing::get};
use tower_http::services::{ServeDir, ServeFile};

#[tokio::main]
async fn main() {
    let dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "public".into());
    let port = std::env::var("PORT").unwrap_or_else(|_| "80".into());
    let index = ServeFile::new(format!("{dir}/index.html"));
    let app = Router::new()
        .route("/healthz", get(|| async { StatusCode::OK }))
        .fallback_service(ServeDir::new(&dir).fallback(index));
    let addr = format!("0.0.0.0:{port}");
    println!("evo-web listening on {addr}, serving {dir}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
