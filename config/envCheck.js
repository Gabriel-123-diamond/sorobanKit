'use strict';

/**
 * Startup environment validation.
 *
 * Fails fast on missing required configuration and warns about optional
 * configuration that enables Redis-backed features.
 */

const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'STELLAR_NETWORK',
];

// Features that require a Redis connection when enabled.
const REDIS_DEPENDENT_FLAGS = [
  'ENABLE_IDEMPOTENCY',
  'ENABLE_RATE_LIMITER',
  'ENABLE_FEDERATION_CACHE',
  'ENABLE_WEBHOOK_WORKER',
];

function isEnabled(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function checkEnv(env = process.env) {
  const errors = [];
  const warnings = [];

  for (const name of REQUIRED_VARS) {
    if (!env[name] || String(env[name]).trim() === '') {
      errors.push(`Missing required environment variable: ${name}`);
    }
  }

  const redisUrl = env.REDIS_URL && String(env.REDIS_URL).trim();
  if (!redisUrl) {
    const enabledFeatures = REDIS_DEPENDENT_FLAGS.filter((flag) => isEnabled(env[flag]));
    if (enabledFeatures.length > 0) {
      warnings.push(
        `REDIS_URL is not set but Redis-dependent features are enabled (${enabledFeatures.join(', ')}). ` +
          'Idempotency, rate limiting, federation caching, and the webhook worker will fail to connect. ' +
          'Set REDIS_URL (e.g. redis://localhost:6379) or start Redis via the Docker Compose profile.'
      );
    }
  }

  return { errors, warnings };
}

function validateEnv(env = process.env, logger = console) {
  const { errors, warnings } = checkEnv(env);

  for (const warning of warnings) {
    if (logger && typeof logger.warn === 'function') {
      logger.warn(`[env] ${warning}`);
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      if (logger && typeof logger.error === 'function') {
        logger.error(`[env] ${error}`);
      }
    }
    throw new Error(`Invalid environment configuration:\n${errors.join('\n')}`);
  }

  return true;
}

module.exports = { checkEnv, validateEnv, REQUIRED_VARS, REDIS_DEPENDENT_FLAGS };
