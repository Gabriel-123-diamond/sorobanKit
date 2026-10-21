const jwt = require('jsonwebtoken');
const { signToken, verifyToken } = require('../src/utils/jwt');

describe('JWT utils', () => {
  const originalIssuer = process.env.JWT_ISSUER;
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    process.env.JWT_ISSUER = 'stellar-tags';
  });

  afterAll(() => {
    if (originalIssuer === undefined) {
      delete process.env.JWT_ISSUER;
    } else {
      process.env.JWT_ISSUER = originalIssuer;
    }
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('signs tokens with the configured issuer', () => {
    const token = signToken({ sub: 'user-1' });
    const decoded = jwt.decode(token);
    expect(decoded.iss).toBe('stellar-tags');
  });

  it('accepts a token with the correct issuer', () => {
    const token = signToken({ sub: 'user-1' });
    const payload = verifyToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.iss).toBe('stellar-tags');
  });

  it('rejects a token with an incorrect issuer', () => {
    const token = jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET, {
      issuer: 'attacker',
      expiresIn: '1h',
    });
    expect(() => verifyToken(token)).toThrow();
  });
});
