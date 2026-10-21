const { clamp } = require('../src/pagination');

describe('clamp', () => {
  test('returns value within range unchanged', () => {
    expect(clamp(5, 1, 10)).toBe(5);
  });

  test('clamps value below minimum to minimum', () => {
    expect(clamp(0, 1, 10)).toBe(1);
    expect(clamp(-5, 1, 10)).toBe(1);
  });

  test('clamps value above maximum to maximum', () => {
    expect(clamp(50, 1, 10)).toBe(10);
  });

  test('coerces string values to numbers', () => {
    expect(clamp('7', 1, 10)).toBe(7);
    expect(clamp('50', 1, 10)).toBe(10);
    expect(clamp('0', 1, 10)).toBe(1);
  });

  test('handles zero', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(0, 1, 10)).toBe(1);
  });

  test('always returns a value within bounds', () => {
    const min = 1;
    const max = 10;
    const inputs = [-100, -1, 0, 1, 5, 10, 11, 100, '3', '99', '-99'];
    for (const input of inputs) {
      const result = clamp(input, min, max);
      expect(result).toBeGreaterThanOrEqual(min);
      expect(result).toBeLessThanOrEqual(max);
    }
  });
});
