'use strict';

const { CONFLICT } = require('../errors');

/**
 * Registration service.
 *
 * Handles username registration against an address. Registration is
 * idempotent for an identical username+address pair: re-registering the
 * same pair returns success with `already_registered: true` instead of
 * throwing a conflict. A username that belongs to a different address is
 * still a genuine conflict.
 */

const MAX_ALIASES_PER_ADDRESS = 5;

class RegistrationService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Register a username for an address.
   *
   * @param {string} username
   * @param {string} address
   * @returns {Promise<{ ok: true, already_registered: boolean }>}
   * @throws {Error} CONFLICT when the username is taken by a different address
   *                 or the address has reached its alias limit.
   */
  async register(username, address) {
    const existing = await this.db.getRegistration(username);

    if (existing) {
      if (existing.address === address) {
        // Idempotent re-registration of the exact same pair.
        return { ok: true, already_registered: true };
      }

      // Username is taken by a different address.
      throw new CONFLICT('Username already registered to a different address');
    }

    const aliasCount = await this.db.countAliasesForAddress(address);
    if (aliasCount >= MAX_ALIASES_PER_ADDRESS) {
      throw new CONFLICT('Address has reached the maximum number of aliases');
    }

    await this.db.createRegistration(username, address);

    return { ok: true, already_registered: false };
  }
}

module.exports = RegistrationService;
