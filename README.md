# Observability Stack

A complete observability stack with Prometheus, Tempo, Quickwit, and Grafana for monitoring Python, Go, Rust, and Next.js services.

## Stack Components

- **Grafana**: Visualization and dashboards (port 3000)
- **Prometheus**: Metrics storage and querying (port 9090)
- **Tempo**: Distributed tracing (port 3200)
- **Quickwit**: Fast log search and analytics (port 7280)
- **OpenTelemetry Collector**: Telemetry data collection (ports 4317, 4318)

## Services

1. **Python Service** (FastAPI) - port 8001
2. **Go Service** - port 8002
3. **Rust Service** (Axum) - port 8003
4. **Next.js Frontend** (with RUM) - port 3001

## Quick Start

### Prerequisites

- Docker and Docker Compose
- At least 8GB of RAM available for Docker

### Start the Stack

```bash
# Start all services
docker-compose up --build

# Or start in detached mode
docker-compose up --build -d
```

### Access the Services

- **Frontend Application**: http://localhost:3001
- **Grafana Dashboards**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Tempo**: http://localhost:3200
- **Quickwit**: http://localhost:7280

### Testing the Stack

1. Open the frontend at http://localhost:3001
2. Click the buttons to make requests to each backend service
3. View the data in Grafana:
   - Go to http://localhost:3000
   - Navigate to Explore
   - Select different data sources (Prometheus, Tempo, Quickwit)

## Features

### Metrics
- HTTP request rates
- Request duration histograms
- Custom business metrics
- Automatic service discovery

### Traces
- Distributed tracing across all services
- Trace correlation with logs
- Service dependency mapping
- Request flow visualization

### Logs
- Fast log search with Quickwit
- Structured logging
- Log-trace correlation
- Filtering by service, level, and content

### RUM (Real User Monitoring)
- Browser performance metrics
- User interaction tracking
- Frontend error tracking
- Page load timing

## Service Endpoints

Each backend service exposes:
- `GET /` - Basic health check
- `GET /data` - Fetch sample data (with simulated DB query)
- `GET /error` - Trigger an error (for testing error tracking)

## Architecture

```
┌─────────────────────────┐
│  Next.js Frontend       │
│  (Browser RUM)          │
└───────────┬─────────────┘
            │
    ┌───────┴────────┐
    │  API Calls     │
    └───────┬────────┘
            │
    ┌───────┴──────────────────────────┐
    │   Python │   Go   │   Rust      │
    │  Service │ Service│   Service   │
    └──────────┴────────┴──────────────┘
            │
    ┌───────┴────────┐
    │  OTEL Collector│
    └───────┬────────┘
            │
    ┌───────┴──────────────────────────┐
    │                                   │
    ▼              ▼            ▼       │
Prometheus     Tempo      Quickwit     │
(Metrics)    (Traces)     (Logs)       │
    │              │            │       │
    └──────────────┴────────────┴───────┘
                   │
                   ▼
              Grafana
           (Visualization)
```

## Correlation

All telemetry data is correlated:
- Logs include `trace_id` and `span_id`
- Metrics can be filtered by trace
- Traces link to related logs
- Navigate seamlessly between all three pillars

## Grafana Datasources

Automatically configured:
1. **Prometheus** - Metrics
2. **Tempo** - Traces (with logs correlation)
3. **Quickwit** - Logs (with trace correlation)

## Development

### Stop the Stack

```bash
docker-compose down
```

### Stop and Remove Volumes

```bash
docker-compose down -v
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f python-service
docker-compose logs -f grafana
```

### Rebuild a Specific Service

```bash
docker-compose up --build python-service
```

## Troubleshooting

### Services not starting

Check Docker resources:
```bash
docker stats
```

Ensure you have enough memory allocated to Docker (at least 8GB recommended).

### Cannot access Grafana

Wait 30-60 seconds after starting for all services to initialize. Quickwit and Tempo need time to start up.

### No data in dashboards

1. Make some requests using the frontend (http://localhost:3001)
2. Wait a few seconds for data to be processed
3. Refresh Grafana

### Logs not appearing in Quickwit

Quickwit needs to create the index first. After the first logs are sent, wait 10-20 seconds for indexing.

## Technology Stack

### Python Service
- FastAPI
- OpenTelemetry Python SDK
- uv for dependency management

### Go Service
- Standard library HTTP
- OpenTelemetry Go SDK
- Native Go modules

### Rust Service
- Axum web framework
- OpenTelemetry Rust SDK
- Tokio async runtime

### Next.js Frontend
- Next.js 14
- OpenTelemetry Browser SDK
- bun for package management
- Real User Monitoring (RUM)

## Notes

- Anonymous auth is enabled in Grafana for demo purposes
- All data is stored in Docker volumes
- OTEL Collector uses gRPC and HTTP receivers
- Quickwit uses PostgreSQL as metastore

## License

MIT