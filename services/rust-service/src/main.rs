use axum::{
    extract::Request,
    http::{header, Method, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Json, Response},
    routing::get,
    Router,
};
use opentelemetry::{
    global,
    metrics::{Counter, Histogram},
    trace::{Span, Tracer},
    KeyValue,
};
use std::time::Instant as StdInstant;
use opentelemetry_sdk::{
    metrics::SdkMeterProvider,
    propagation::TraceContextPropagator,
    trace::{self, RandomIdGenerator, Sampler},
    Resource,
};
use std::sync::OnceLock;
use std::time::Duration;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_semantic_conventions as semconv;
use serde_json::json;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{info, error};
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

// Global metrics instruments
static REQUEST_COUNTER: OnceLock<Counter<u64>> = OnceLock::new();
static DURATION_HISTOGRAM: OnceLock<Histogram<f64>> = OnceLock::new();

async fn root_handler() -> Json<serde_json::Value> {
    info!("Processing root request");
    
    let tracer = global::tracer("rust-service");
    let mut span = tracer.start("process_root_request");
    span.set_attribute(KeyValue::new("handler", "root"));
    
    let response = Json(json!({
        "service": "rust",
        "message": "Hello from Rust service!",
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }));
    
    span.end();
    response
}

async fn data_handler() -> Json<serde_json::Value> {
    info!("Fetching data");
    
    let tracer = global::tracer("rust-service");
    let mut span = tracer.start("fetch_data");
    
    let data = (0..10)
        .map(|i| {
            json!({
                "id": i,
                "value": format!("item-{}", i)
            })
        })
        .collect::<Vec<_>>();
    
    info!("Retrieved {} items", data.len());
    span.set_attribute(KeyValue::new("items.count", data.len() as i64));
    
    let response = Json(json!({
        "data": data,
        "count": data.len()
    }));
    
    span.end();
    response
}

async fn error_handler() -> Response {
    error!("Simulated error occurred");
    
    let tracer = global::tracer("rust-service");
    let mut span = tracer.start("error_endpoint");
    span.set_attribute(KeyValue::new("error", "simulated"));
    
    let response = (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({
            "error": "This is a simulated error"
        })),
    ).into_response();
    
    span.end();
    response
}

async fn health_handler() -> Json<serde_json::Value> {
    Json(json!({
        "status": "healthy",
        "service": "rust-service"
    }))
}

// Middleware to track HTTP metrics
async fn metrics_middleware(
    req: Request,
    next: Next,
) -> Response {
    let method = req.method().clone();
    let path = req.uri().path().to_string();
    let start = StdInstant::now();
    
    // Execute request
    let response = next.run(req).await;
    
    // Record metrics
    let duration = start.elapsed();
    let status = response.status().as_u16();
    
    // Use pre-initialized metrics instruments
    if let Some(counter) = REQUEST_COUNTER.get() {
        counter.add(
            1,
            &[
                KeyValue::new("method", method.to_string()),
                KeyValue::new("endpoint", path.clone()),
            ],
        );
    }
    
    if let Some(histogram) = DURATION_HISTOGRAM.get() {
        histogram.record(
            duration.as_secs_f64(),  // Record in seconds to match Python
            &[
                KeyValue::new("method", method.to_string()),
                KeyValue::new("endpoint", path),
            ],
        );
    }
    
    response
}

fn init_telemetry() -> Result<SdkMeterProvider, Box<dyn std::error::Error>> {
    // Get OTLP endpoint from environment - using gRPC port 4317
    let otlp_endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
        .unwrap_or_else(|_| "http://otel-collector:4317".to_string());
    
    info!("Initializing OpenTelemetry with endpoint: {}", otlp_endpoint);
    
    // Create resource with service information
    let resource = Resource::new(vec![
        KeyValue::new(semconv::resource::SERVICE_NAME, "rust-service"),
        KeyValue::new(semconv::resource::SERVICE_VERSION, "1.0.0"),
    ]);
    
    // Set up trace context propagation
    global::set_text_map_propagator(TraceContextPropagator::new());
    
    // Set up tracing with gRPC exporter
    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint(otlp_endpoint.clone()),
        )
        .with_trace_config(
            trace::config()
                .with_sampler(Sampler::AlwaysOn)
                .with_id_generator(RandomIdGenerator::default())
                .with_resource(resource.clone()),
        )
        .install_batch(opentelemetry_sdk::runtime::Tokio)?;
    
    // Set up metrics with gRPC exporter
    let meter_provider = opentelemetry_otlp::new_pipeline()
        .metrics(opentelemetry_sdk::runtime::Tokio)
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint(otlp_endpoint.clone())
                .with_timeout(Duration::from_secs(3)),
        )
        .with_period(Duration::from_secs(5))
        .with_resource(resource.clone())
        .build()?;
    
    global::set_meter_provider(meter_provider.clone());
    
    // Initialize tracing subscriber with OpenTelemetry layer
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_opentelemetry::layer().with_tracer(tracer))
        .init();
    
    Ok(meter_provider)
}

#[tokio::main]
async fn main() {
    // Initialize OpenTelemetry
    let _meter_provider = init_telemetry()
        .expect("Failed to initialize OpenTelemetry");
    
    info!("OpenTelemetry initialized successfully");
    
    // Initialize metrics instruments once
    let meter = global::meter("rust-service");
    
    let request_counter = meter
        .u64_counter("http_requests_total")
        .with_description("Total number of HTTP requests")
        .init();
    
    let duration_histogram = meter
        .f64_histogram("http_request_duration_seconds")
        .with_description("HTTP request duration in seconds")
        .init();
    
    // Store in global static
    REQUEST_COUNTER.set(request_counter).expect("Failed to set request counter");
    DURATION_HISTOGRAM.set(duration_histogram).expect("Failed to set duration histogram");
    
    info!("Metrics instruments initialized");
    
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
        .layer(middleware::from_fn(metrics_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(cors);
    
    // Start server
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000")
        .await
        .expect("Failed to bind to port 8000");
    
    info!("Rust service starting on :8000");
    
    axum::serve(listener, app)
        .await
        .expect("Server failed to start");
    
    // Shutdown OpenTelemetry
    global::shutdown_tracer_provider();
}
