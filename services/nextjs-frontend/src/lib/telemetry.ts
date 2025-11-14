import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { context } from '@opentelemetry/api';

let isInitialized = false;

export function initializeTelemetry() {
  // Only run on client side
  if (typeof window === 'undefined') {
    return;
  }

  // Prevent double initialization
  if (isInitialized) {
    console.log('Telemetry already initialized');
    return;
  }

  try {
    // Create resource with service information
    const resource = Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'nextjs-frontend',
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      })
    );

    // Create the tracer provider
    const provider = new WebTracerProvider({
      resource,
    });

    // Configure OTLP exporter to send traces to the collector
    // Note: Browser can only use HTTP, not gRPC
    const exporter = new OTLPTraceExporter({
      url: 'http://localhost:4318/v1/traces', // HTTP endpoint for browser
      headers: {},
    });

    // Add batch span processor
    provider.addSpanProcessor(new BatchSpanProcessor(exporter));

    // Register the provider
    provider.register({
      contextManager: new ZoneContextManager(),
    });

    // Register auto-instrumentations
    registerInstrumentations({
      instrumentations: [
        new FetchInstrumentation({
          propagateTraceHeaderCorsUrls: [
            /localhost:8001/, // Python service
            /localhost:8002/, // Go service
            /localhost:8003/, // Rust service
          ],
          clearTimingResources: true,
        }),
        new DocumentLoadInstrumentation(),
        new UserInteractionInstrumentation({
          eventNames: ['click', 'submit'],
        }),
      ],
    });

    isInitialized = true;
    console.log('Browser OpenTelemetry initialized successfully');
  } catch (error) {
    console.error('Failed to initialize OpenTelemetry:', error);
  }
}

