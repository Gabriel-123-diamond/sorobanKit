'use strict';

/**
 * Tests for the OpenTelemetry tracing utility.
 *
 * These tests exercise the public surface of `src/utils/tracing.js`:
 *  - tracing is disabled (no-op) when OTEL_EXPORTER_OTLP_ENDPOINT is unset
 *  - tracing initializes and emits spans when the endpoint is configured
 */

const ORIGINAL_ENV = { ...process.env };

function loadTracing() {
  let mod;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    mod = require('./tracing');
  });
  return mod;
}

describe('tracing utility', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('is disabled when OTEL_EXPORTER_OTLP_ENDPOINT is not set', () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    const tracing = loadTracing();

    expect(tracing.isTracingEnabled()).toBe(false);
    // Starting tracing without an endpoint must be a safe no-op.
    expect(() => tracing.startTracing()).not.toThrow();
    expect(tracing.getTracer()).toBeDefined();
  });

  it('initializes and emits spans when an OTLP endpoint is configured', async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
    process.env.OTEL_SERVICE_NAME = 'handsoff-test';

    const tracing = loadTracing();

    expect(tracing.isTracingEnabled()).toBe(true);

    const sdk = tracing.startTracing();
    expect(sdk).toBeTruthy();

    const tracer = tracing.getTracer();
    expect(tracer).toBeDefined();

    const span = tracer.startSpan('test-span');
    expect(span).toBeDefined();
    expect(typeof span.end).toBe('function');
    expect(span.isRecording()).toBe(true);
    span.end();

    // Shut down cleanly so the exporter flushes and timers are cleared.
    await tracing.stopTracing();
  });
});
