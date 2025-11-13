use axum::{
    http::{header, Method, StatusCode},
    response::{IntoResponse, Json, Response},
    routing::get,
    Router,
};
use serde_json::json;
use tower_http::cors::{Any, CorsLayer};

async fn root_handler() -> Json<serde_json::Value> {
    println!("Processing root request");
    
    Json(json!({
        "service": "rust",
        "message": "Hello from Rust service!",
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }))
}

async fn data_handler() -> Json<serde_json::Value> {
    println!("Fetching data");
    
    let data = (0..10)
        .map(|i| {
            json!({
                "id": i,
                "value": format!("item-{}", i)
            })
        })
        .collect::<Vec<_>>();
    
    println!("Retrieved {} items", data.len());
    
    Json(json!({
        "data": data,
        "count": data.len()
    }))
}

async fn error_handler() -> Response {
    println!("Simulated error occurred");
    
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({
            "error": "This is a simulated error"
        })),
    ).into_response()
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(json!({
        "status": "healthy",
        "service": "rust-service"
    }))
}

#[tokio::main]
async fn main() {
    // Setup CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE]);
    
    // Build router
    let app = Router::new()
        .route("/", get(root_handler))
        .route("/data", get(data_handler))
        .route("/error", get(error_handler))
        .route("/health", get(health_handler))
        .layer(cors);
    
    // Start server
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000")
        .await
        .expect("Failed to bind to port 8000");
    
    println!("Rust service starting on :8000");
    
    axum::serve(listener, app)
        .await
        .expect("Server failed to start");
}
