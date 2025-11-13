package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/metric"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	sdkresource "go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
)

var (
	tracer          trace.Tracer
	meter           metric.Meter
	requestCounter  metric.Int64Counter
	requestDuration metric.Float64Histogram
)

// logJSON logs a structured JSON message with trace context
func logJSON(ctx context.Context, level string, message string, fields map[string]interface{}) {
	span := trace.SpanFromContext(ctx)
	spanCtx := span.SpanContext()

	logEntry := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"level":     level,
		"message":   message,
		"service":   "go-service",
	}

	if spanCtx.IsValid() {
		logEntry["trace_id"] = spanCtx.TraceID().String()
		logEntry["span_id"] = spanCtx.SpanID().String()
	}

	for k, v := range fields {
		logEntry[k] = v
	}

	jsonBytes, _ := json.Marshal(logEntry)
	log.Println(string(jsonBytes))
}

func initTracer(ctx context.Context) (*sdktrace.TracerProvider, error) {
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		endpoint = "otel-collector:4317"
	}

	exporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint(endpoint),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}

	resource := sdkresource.NewWithAttributes(
		semconv.SchemaURL,
		semconv.ServiceName("go-service"),
		semconv.ServiceVersion("1.0.0"),
	)

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource),
	)

	otel.SetTracerProvider(tp)
	tracer = tp.Tracer("go-service")

	return tp, nil
}

func initMeter(ctx context.Context) (*sdkmetric.MeterProvider, error) {
	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		endpoint = "otel-collector:4317"
	}

	exporter, err := otlpmetricgrpc.New(ctx,
		otlpmetricgrpc.WithEndpoint(endpoint),
		otlpmetricgrpc.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}

	resource := sdkresource.NewWithAttributes(
		semconv.SchemaURL,
		semconv.ServiceName("go-service"),
		semconv.ServiceVersion("1.0.0"),
	)

	mp := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(exporter)),
		sdkmetric.WithResource(resource),
	)

	otel.SetMeterProvider(mp)
	meter = mp.Meter("go-service")

	// Create custom metrics
	requestCounter, err = meter.Int64Counter(
		"http_requests_total",
		metric.WithDescription("Total number of HTTP requests"),
	)
	if err != nil {
		return nil, err
	}

	requestDuration, err = meter.Float64Histogram(
		"http_request_duration_seconds",
		metric.WithDescription("HTTP request duration in seconds"),
	)
	if err != nil {
		return nil, err
	}

	return mp, nil
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "*")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	ctx := r.Context()

	_, span := tracer.Start(ctx, "root_handler")
	defer span.End()

	span.SetAttributes(
		attribute.String("http.method", "GET"),
		attribute.String("http.route", "/"),
	)

	logJSON(ctx, "INFO", "Processing root request", nil)

	response := map[string]interface{}{
		"service":   "go",
		"message":   "Hello from Go service!",
		"timestamp": time.Now().Unix(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)

	duration := time.Since(start).Seconds()
	requestCounter.Add(ctx, 1, metric.WithAttributes(
		attribute.String("method", "GET"),
		attribute.String("endpoint", "/"),
	))
	requestDuration.Record(ctx, duration, metric.WithAttributes(
		attribute.String("method", "GET"),
		attribute.String("endpoint", "/"),
	))
}

func dataHandler(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	ctx := r.Context()

	_, span := tracer.Start(ctx, "get_data_handler")
	defer span.End()

	span.SetAttributes(
		attribute.String("http.method", "GET"),
		attribute.String("http.route", "/data"),
	)

	logJSON(ctx, "INFO", "Fetching data", nil)

	// Simulate database query
	_, dbSpan := tracer.Start(ctx, "database_query")
	time.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)

	data := make([]map[string]interface{}, 10)
	for i := 0; i < 10; i++ {
		data[i] = map[string]interface{}{
			"id":    i,
			"value": fmt.Sprintf("item-%d", i),
		}
	}
	dbSpan.End()

	logJSON(ctx, "INFO", "Retrieved items", map[string]interface{}{
		"item_count": len(data),
	})

	response := map[string]interface{}{
		"data":  data,
		"count": len(data),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)

	duration := time.Since(start).Seconds()
	requestCounter.Add(ctx, 1, metric.WithAttributes(
		attribute.String("method", "GET"),
		attribute.String("endpoint", "/data"),
	))
	requestDuration.Record(ctx, duration, metric.WithAttributes(
		attribute.String("method", "GET"),
		attribute.String("endpoint", "/data"),
	))
}

func errorHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	_, span := tracer.Start(ctx, "error_handler")
	defer span.End()

	span.SetAttributes(
		attribute.String("http.method", "GET"),
		attribute.String("http.route", "/error"),
		attribute.Bool("error", true),
	)

	logJSON(ctx, "ERROR", "Simulated error occurred", map[string]interface{}{
		"error_type": "SimulatedError",
	})

	requestCounter.Add(ctx, 1, metric.WithAttributes(
		attribute.String("method", "GET"),
		attribute.String("endpoint", "/error"),
		attribute.String("status", "error"),
	))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusInternalServerError)
	json.NewEncoder(w).Encode(map[string]string{
		"error": "This is a simulated error",
	})
}

func main() {
	ctx := context.Background()

	// Initialize OpenTelemetry
	tp, err := initTracer(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize tracer: %v", err)
	}
	defer tp.Shutdown(ctx)

	mp, err := initMeter(ctx)
	if err != nil {
		log.Fatalf("Failed to initialize meter: %v", err)
	}
	defer mp.Shutdown(ctx)

	// Setup HTTP routes
	mux := http.NewServeMux()
	mux.HandleFunc("/", rootHandler)
	mux.HandleFunc("/data", dataHandler)
	mux.HandleFunc("/error", errorHandler)

	// Wrap with OTEL instrumentation and CORS
	handler := enableCORS(otelhttp.NewHandler(mux, "go-service"))

	log.Println("Go service starting on :8000")
	if err := http.ListenAndServe(":8000", handler); err != nil {
		log.Fatal(err)
	}
}
