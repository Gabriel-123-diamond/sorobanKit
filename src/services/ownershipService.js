'use strict';

const { Horizon } = require('@stellar/stellar-sdk');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const SIGNER_CACHE_TTL_MS = parseInt(process.env.SIGNER_CACHE_TTL_MS, 10) || 60000;
const SIGNER_CACHE_PREFIX = 'signers:';

const server = new Horizon.Server(
  process.env.HORIZON_URL || 'https://horizon.stellar.org'
);

function signerCacheKey(address) {
  return `${SIGNER_CACHE_PREFIX}${address}`;
}

async function readSignerCache(address) {
  try {
    const redis = getRedisClient();
    if (!redis) return null;
    const cached = await redis.get(signerCacheKey(address));
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (err) {
    logger.warn('Signer cache read failed, falling through to Horizon', {
      address,
      error: err.message,
    });
    return null;
  }
}

async function writeSignerCache(address, signers) {
  try {
    const redis = getRedisClient();
    if (!redis) return;
    await redis.set(
      signerCacheKey(address),
      JSON.stringify(signers),
      'PX',
      SIGNER_CACHE_TTL_MS
    );
  } catch (err) {
    logger.warn('Signer cache write failed', { address, error: err.message });
  }
}

async function fetchSignersFromHorizon(address) {
  const account = await server.loadAccount(address);
  return account.signers.map((signer) => ({
    key: signer.key,
    weight: signer.weight,
    type: signer.type,
  }));
}

async function getAccountSigners(address) {
  const cached = await readSignerCache(address);
  if (cached) return cached;

  const signers = await fetchSignersFromHorizon(address);
  await writeSignerCache(address, signers);
  return signers;
}

async function verifyOwnership(address, signerKey) {
  const signers = await getAccountSigners(address);
  return signers.some((signer) => signer.key === signerKey && signer.weight > 0);
}

module.exports = {
  getAccountSigners,
  verifyOwnership,
  SIGNER_CACHE_TTL_MS,
};
