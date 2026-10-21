'use strict';

const { exportTransactions } = require('../src/export/transactionExport');

/**
 * Maximum acceptable peak heap usage (in MB) during the transaction export.
 *
 * Calibrated against current behaviour with headroom so that normal runs pass
 * comfortably, while a regression that buffers the entire export in memory
 * (which would push heap usage well above this value) fails the test.
 *
 * To update: run the test, observe the logged `peakHeapUsed` value, and set
 * this threshold to roughly 2x the observed peak (rounded up) to keep headroom.
 */
const HEAP_THRESHOLD_MB = 50;

function measurePeakHeap(fn) {
  if (global.gc) {
    global.gc();
  }

  const baseline = process.memoryUsage().heapUsed;
  let peakHeapUsed = baseline;

  const sampler = setInterval(() => {
    const current = process.memoryUsage().heapUsed;
    if (current > peakHeapUsed) {
      peakHeapUsed = current;
    }
  }, 5);

  try {
    fn();
  } finally {
    clearInterval(sampler);
  }

  const finalHeap = process.memoryUsage().heapUsed;
  if (finalHeap > peakHeapUsed) {
    peakHeapUsed = finalHeap;
  }

  return peakHeapUsed;
}

describe('memory usage during transaction export', () => {
  it('keeps peak heap usage below the configured threshold', () => {
    const peakHeapUsed = measurePeakHeap(() => {
      exportTransactions({ limit: 1000 });
    });

    // eslint-disable-next-line no-console
    console.log(
      `peakHeapUsed: ${(peakHeapUsed / (1024 * 1024)).toFixed(2)} MB ` +
        `(threshold: ${HEAP_THRESHOLD_MB} MB)`
    );

    expect(peakHeapUsed).toBeLessThan(HEAP_THRESHOLD_MB * 1024 * 1024);
  });
});
