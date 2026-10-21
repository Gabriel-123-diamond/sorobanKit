const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER;

/**
 * Sign a JWT payload.
 * @param {object} payload
 * @param {object} [options]
 * @returns {string}
 */
function signToken(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, {
    ...options,
    issuer: JWT_ISSUER,
  });
}

/**
 * Verify a JWT and return its decoded payload.
 * @param {string} token
 * @returns {object}
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    issuer: JWT_ISSUER,
  });
}

module.exports = {
  signToken,
  verifyToken,
};
