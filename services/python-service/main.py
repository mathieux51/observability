from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry import trace, metrics
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry._logs import set_logger_provider
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
import logging
import os
import time
import random

# Setup resource
resource = Resource.create(
    {
        "service.name": os.getenv("OTEL_SERVICE_NAME", "python-service"),
        "service.version": "1.0.0",
    }
)

# Setup tracing
trace_provider = TracerProvider(resource=resource)
trace_provider.add_span_processor(
    BatchSpanProcessor(
        OTLPSpanExporter(
            endpoint=os.getenv(
                "OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317"
            ),
            insecure=True,
        )
    )
)
trace.set_tracer_provider(trace_provider)
tracer = trace.get_tracer(__name__)

# Setup metrics
metric_reader = PeriodicExportingMetricReader(
    OTLPMetricExporter(
        endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317"),
        insecure=True,
    )
)
meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
metrics.set_meter_provider(meter_provider)
meter = metrics.get_meter(__name__)

# Setup logging
logger_provider = LoggerProvider(resource=resource)
logger_provider.add_log_record_processor(
    BatchLogRecordProcessor(
        OTLPLogExporter(
            endpoint=os.getenv(
                "OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317"
            ),
            insecure=True,
        )
    )
)
set_logger_provider(logger_provider)

# Configure Python logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.addHandler(LoggingHandler(logger_provider=logger_provider))

# Create custom metrics
request_counter = meter.create_counter(
    name="http_requests_total", description="Total number of HTTP requests", unit="1"
)

request_duration = meter.create_histogram(
    name="http_request_duration_seconds",
    description="HTTP request duration in seconds",
    unit="s",
)

app = FastAPI(title="Python Service")

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instrument FastAPI
FastAPIInstrumentor.instrument_app(app)


@app.get("/")
async def root(request: Request):
    start_time = time.time()

    with tracer.start_as_current_span("root_handler") as span:
        span.set_attribute("http.method", "GET")
        span.set_attribute("http.route", "/")

        logger.info(
            "Processing root request",
            extra={
                "trace_id": format(span.get_span_context().trace_id, "032x"),
                "span_id": format(span.get_span_context().span_id, "016x"),
            },
        )

        result = {
            "service": "python",
            "message": "Hello from Python service!",
            "timestamp": time.time(),
        }

        duration = time.time() - start_time
        request_counter.add(1, {"method": "GET", "endpoint": "/"})
        request_duration.record(duration, {"method": "GET", "endpoint": "/"})

        return result


@app.get("/data")
async def get_data(request: Request):
    start_time = time.time()

    with tracer.start_as_current_span("get_data_handler") as span:
        span.set_attribute("http.method", "GET")
        span.set_attribute("http.route", "/data")

        logger.info(
            "Fetching data",
            extra={
                "trace_id": format(span.get_span_context().trace_id, "032x"),
                "span_id": format(span.get_span_context().span_id, "016x"),
            },
        )

        # Simulate some work
        with tracer.start_as_current_span("database_query"):
            time.sleep(random.uniform(0.01, 0.1))
            data = [{"id": i, "value": f"item-{i}"} for i in range(10)]

        logger.info(
            f"Retrieved {len(data)} items",
            extra={
                "trace_id": format(span.get_span_context().trace_id, "032x"),
                "span_id": format(span.get_span_context().span_id, "016x"),
                "item_count": len(data),
            },
        )

        duration = time.time() - start_time
        request_counter.add(1, {"method": "GET", "endpoint": "/data"})
        request_duration.record(duration, {"method": "GET", "endpoint": "/data"})

        return {"data": data, "count": len(data)}


@app.get("/error")
async def error_endpoint(request: Request):
    with tracer.start_as_current_span("error_handler") as span:
        span.set_attribute("http.method", "GET")
        span.set_attribute("http.route", "/error")

        logger.error(
            "Simulated error occurred",
            extra={
                "trace_id": format(span.get_span_context().trace_id, "032x"),
                "span_id": format(span.get_span_context().span_id, "016x"),
                "error_type": "SimulatedError",
            },
        )

        span.set_attribute("error", True)
        request_counter.add(
            1, {"method": "GET", "endpoint": "/error", "status": "error"}
        )

        return {"error": "This is a simulated error"}, 500


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
