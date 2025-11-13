// Simplified telemetry without problematic auto-instrumentation
export function initializeTelemetry() {
  // Only run on client side
  if (typeof window === 'undefined') {
    return;
  }

  console.log('Browser telemetry initialized (manual tracing only)');
  
  // We'll implement manual tracing using fetch interception
  // This avoids the SSG issues with OpenTelemetry's auto-instrumentation
}
