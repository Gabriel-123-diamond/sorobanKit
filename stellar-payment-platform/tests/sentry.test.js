jest.mock('dotenv', () => ({ config: jest.fn() }));

jest.mock('@stellar/stellar-sdk', () => ({
  Horizon: { Server: jest.fn() },
  StrKey: { isValidEd25519PublicKey: jest.fn(() => true) },
}));

jest.mock('pdfkit', () => jest.fn());

jest.mock('../src/cleanup-cron', () => ({ scheduleCleanupJob: jest.fn() }));
jest.mock('../src/soft-delete-purge-cron', () => ({ scheduleSoftDeletePurgeJob: jest.fn() }));

jest.mock('bad-words', () => {
  return jest.fn().mockImplementation(() => ({
    isProfane: jest.fn(() => false),
  }));
});

jest.mock('@prisma/client', () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}));

jest.mock('../prismaClient', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]),
  },
}));

jest.mock('../src/multisigner-verifier', () => ({
  verifyMultiSignerThreshold: jest.fn(),
  isSingleSignerAccount: jest.fn().mockReturnValue(true),
}));

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: jest.fn(),
    }),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    options: { max: 10 },
  })),
}));

const mockInit = jest.fn();
const mockSetupExpressErrorHandler = jest.fn();
jest.mock('@sentry/node', () => ({
  init: (...args) => mockInit(...args),
  setupExpressErrorHandler: (...args) => mockSetupExpressErrorHandler(...args),
}));

describe('Sentry error reporting', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    mockInit.mockClear();
    mockSetupExpressErrorHandler.mockClear();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  test('initializes Sentry with the configured DSN when SENTRY_DSN is set', () => {
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';

    require('../server');

    expect(mockInit).toHaveBeenCalledWith({
      dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
    });
    expect(mockSetupExpressErrorHandler).toHaveBeenCalledTimes(1);
  });

  test('does not initialize Sentry when SENTRY_DSN is not set', () => {
    delete process.env.SENTRY_DSN;

    require('../server');

    expect(mockInit).not.toHaveBeenCalled();
    expect(mockSetupExpressErrorHandler).not.toHaveBeenCalled();
  });
});

describe('Logger PII sanitisation', () => {
  const ORIGINAL_ENV = process.env;
  // 56-character Stellar public key: G + 55 uppercase alphanumeric chars.
  const STELLAR_ADDRESS = 'GABC1234' + 'A'.repeat(44) + '5678';
  const TRUNCATED_ADDRESS = 'GABC1234...5678';

  let writeSpy;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.NODE_ENV = 'production';
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  const readWrittenOutput = () =>
    writeSpy.mock.calls.map((call) => String(call[0])).join('');

  test('truncates Stellar addresses at debug level', () => {
    process.env.LOG_LEVEL = 'debug';

    const logger = require('../src/logger');
    logger.debug(`Processing payment for ${STELLAR_ADDRESS}`);

    const output = readWrittenOutput();
    expect(output).toContain(TRUNCATED_ADDRESS);
    expect(output).not.toContain(STELLAR_ADDRESS);
  });

  test('preserves full Stellar addresses at info level', () => {
    process.env.LOG_LEVEL = 'info';

    const logger = require('../src/logger');
    logger.info(`Processing payment for ${STELLAR_ADDRESS}`);

    const output = readWrittenOutput();
    expect(output).toContain(STELLAR_ADDRESS);
    expect(output).not.toContain(TRUNCATED_ADDRESS);
  });
});
