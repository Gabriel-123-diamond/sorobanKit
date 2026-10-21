const { PrismaClient } = require('@prisma/client');

// Reuse a single PrismaClient instance across the process.
// In test environments Jest clears the module cache between test files,
// which would otherwise create a new client (and new DB connections) on
// every require(). Storing the instance on globalThis prevents that.
const globalForPrisma = globalThis;

const DEFAULT_POOL_SIZE = 10;
const DEFAULT_POOL_TIMEOUT = 30;

/**
 * Build a datasource URL with explicit connection pool limits.
 *
 * Appends `connection_limit` and `pool_timeout` query parameters derived from
 * the environment (DB_POOL_SIZE / DB_POOL_TIMEOUT). Existing query parameters
 * are preserved and duplicate pool parameters are replaced rather than
 * duplicated.
 *
 * @param {string} [baseUrl] Base DATABASE_URL (defaults to process.env.DATABASE_URL)
 * @param {object} [env] Environment object (defaults to process.env)
 * @returns {string|undefined} The resolved URL, or undefined if no base URL.
 */
function buildDatasourceUrl(baseUrl = process.env.DATABASE_URL, env = process.env) {
  if (!baseUrl) {
    return baseUrl;
  }

  const poolSize = env.DB_POOL_SIZE || DEFAULT_POOL_SIZE;
  const poolTimeout = env.DB_POOL_TIMEOUT || DEFAULT_POOL_TIMEOUT;

  const [base, existingQuery = ''] = baseUrl.split('?');

  // Parse existing query params, dropping any pool params we are about to set.
  const params = new URLSearchParams(existingQuery);
  params.delete('connection_limit');
  params.delete('pool_timeout');

  params.set('connection_limit', String(poolSize));
  params.set('pool_timeout', String(poolTimeout));

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

const datasourceUrl = buildDatasourceUrl();

const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

module.exports = prisma;
module.exports.buildDatasourceUrl = buildDatasourceUrl;
module.exports.datasourceUrl = datasourceUrl;