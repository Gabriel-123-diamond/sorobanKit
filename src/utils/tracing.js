'use strict';

/**
 * OpenTelemetry tracing setup.
 *
 * Tracing is enabled only when OTEL_EXPORTER_OTLP_ENDPOINT is set. When it is
 * not set, startTracing() is a no-op and no SDK is initialized, so the app runs
 * without any tracing overhead or exporter connections.
 */

let sdk = null;
let started = false;

function isTracingEnabled() {
  return Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
}

function startTracing() {
  if (started) {
    return sdk;
  }
  started = true;

  if (!isTracingEnabled()) {
    return null;
  }

  // Lazy-require so the SDK is only loaded when tracing is actually enabled.
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
  const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
  const { Resource } = require('@opentelemetry/resources');
  const {
    ATTR_SERVICE_NAME,
    ATTR_SERVICE_VERSION,
  } = require('@opentelemetry/semantic-conventions');

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const serviceName = process.env.OTEL_SERVICE_NAME || 'stellar-backend';

  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint.replace(/\/$/, '')}/v1/traces`,
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '0.0.0',
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Express HTTP layer, outgoing HTTP calls, and Prisma queries.
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-prisma': { enabled: true },
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();

  const shutdown = () => {
    sdk
      .shutdown()
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Error shutting down OpenTelemetry SDK', err);
      })
      .finally(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return sdk;
}

async function stopTracing() {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
  started = false;
}

module.exports = {
  isTracingEnabled,
  startTracing,
  stopTracing,
};
