'use strict';

const pino = require('pino');
const pinoHttp = require('pino-http');

// Read service metadata once at module load so every log record carries it.
let _pkg = {};
try {
  _pkg = require('../package.json');
} catch {
  // If package.json can't be read (unusual in tests), fall back gracefully.
}

const SERVICE_NAME = _pkg.name || 'stellar-payment-platform';
const SERVICE_VERSION = _pkg.version || 'unknown';

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const IS_TEST = process.env.NODE_ENV === 'test';

// Stellar public keys are PII. At debug level we truncate them to their first
// 8 and last 4 characters (e.g. GABC1234...5678) before they are written.
// At info level and above keys are logged in full for audit purposes.
const STELLAR_ADDRESS_RE = /G[A-Z0-9]{55}/g;

const sanitiseStellarAddresses = (value) => {
  if (typeof value === 'string') {
    return value.replace(STELLAR_ADDRESS_RE, (match) => `${match.slice(0, 8)}...${match.slice(-4)}`);
  }
  if (Array.isArray(value)) return value.map(sanitiseStellarAddresses);
  if (value && typeof value === 'object') {
    const clone = {};
    for (const key of Object.keys(value)) {
      clone[key] = sanitiseStellarAddresses(value[key]);
    }
    return clone;
  }
  return value;
};

const SANITISE_PII = LOG_LEVEL === 'debug';

const logger = pino({
  level: IS_TEST ? 'silent' : LOG_LEVEL,
  hooks: SANITISE_PII
    ? {
        logMethod(args, method) {
          const sanitised = args.map((arg) => sanitiseStellarAddresses(arg));
          return method.apply(this, sanitised);
        },
      }
    : undefined,
  // Attach service name and version to every log record so records from
  // multiple services can be filtered in aggregated logging platforms
  // (Grafana Loki, Datadog, etc.) without ambiguity.
  base: {
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
  },
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  // Redact sensitive fields at the pino level so they never reach log files,
  // log aggregators, or stdout regardless of call site.
  redact: {
    paths: [
      'password', 'secret', 'token', 'authorization', 'x-api-key',
      '*.password', '*.secret', '*.token', '*.authorization', '*.x-api-key',
      'body.password', 'body.secret', 'body.token',
      'headers.authorization', 'headers.x-api-key',
    ],
    censor: '[REDACTED]',
  },
});

const redactSensitive = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitive);
  const clone = { ...obj };
  const sensitiveFields = ['signature', 'secret', 'x-api-key', 'authorization'];
  
  for (const key of Object.keys(clone)) {
    if (sensitiveFields.includes(key.toLowerCase())) {
      clone[key] = '[REDACTED]';
    } else if (typeof clone[key] === 'object' && clone[key] !== null) {
      clone[key] = redactSensitive(clone[key]);
    } else if (SANITISE_PII) {
      clone[key] = sanitiseStellarAddresses(clone[key]);
    }
  }
  return clone;
};

const httpLogger = pinoHttp({
  logger,
  autoLogging: true,
  serializers: {
    req: (req) => {
      const serialized = {
        method: req.method,
        path: req.url,
      };
      
      if (req.raw && req.raw.headers) {
        serialized.headers = redactSensitive(req.raw.headers);
      } else if (req.headers) {
        serialized.headers = redactSensitive(req.headers);
      }

      if (req.raw && req.raw.body) {
        serialized.body = redactSensitive(req.raw.body);
      }
      
      return serialized;
    },
    res: (res) => ({
      status: res.statusCode,
    })
  }
});

module.exports = { logger, httpLogger, sanitiseStellarAddresses };
