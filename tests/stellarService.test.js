'use strict';

const { retryHorizonRequest } = require('../src/services/stellarService');

function makeError(status, code) {
  const err = new Error(`Horizon error ${status}`);
  err.response = { status };
  if (code) err.code = code;
  return err;
}

describe('retryHorizonRequest', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('retries a single 503 and eventually succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(makeError(503))
      .mockResolvedValueOnce({ ok: true });

    const promise = retryHorizonRequest(fn, 3);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after three consecutive 503s', async () => {
    const fn = jest.fn().mockRejectedValue(makeError(503));

    const promise = retryHorizonRequest(fn, 3);
    const assertion = expect(promise).rejects.toMatchObject({
      response: { status: 503 },
    });
    await jest.runAllTimersAsync();
    await assertion;

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry a 404', async () => {
    const fn = jest.fn().mockRejectedValue(makeError(404));

    await expect(retryHorizonRequest(fn, 3)).rejects.toMatchObject({
      response: { status: 404 },
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 400', async () => {
    const fn = jest.fn().mockRejectedValue(makeError(400));

    await expect(retryHorizonRequest(fn, 3)).rejects.toMatchObject({
      response: { status: 400 },
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries network timeouts', async () => {
    const timeout = makeError(undefined, 'ETIMEDOUT');
    const fn = jest
      .fn()
      .mockRejectedValueOnce(timeout)
      .mockResolvedValueOnce({ ok: true });

    const promise = retryHorizonRequest(fn, 3);
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
