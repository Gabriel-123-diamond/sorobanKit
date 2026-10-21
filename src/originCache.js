'use strict';

const DEFAULT_TTL_MS = 300000;

function resolveTtlMs() {
  const raw = process.env.ORIGIN_CACHE_TTL_MS;
  if (raw === undefined || raw === null || raw === '') {
    return DEFAULT_TTL_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_TTL_MS;
  }
  return parsed;
}

let cachedOrigins = null;
let cachedAt = 0;

function isExpired(now) {
  if (cachedOrigins === null) {
    return true;
  }
  return now - cachedAt >= resolveTtlMs();
}

async function loadOrigins(db) {
  const rows = await db.query('SELECT origin FROM approved_origins');
  return rows.map((row) => row.origin);
}

async function getApprovedOrigins(db) {
  const now = Date.now();
  if (isExpired(now)) {
    cachedOrigins = await loadOrigins(db);
    cachedAt = now;
  }
  return cachedOrigins;
}

function invalidateOriginCache() {
  cachedOrigins = null;
  cachedAt = 0;
}

async function isOriginApproved(db, origin) {
  const origins = await getApprovedOrigins(db);
  return origins.includes(origin);
}

module.exports = {
  DEFAULT_TTL_MS,
  getApprovedOrigins,
  invalidateOriginCache,
  isOriginApproved,
};
