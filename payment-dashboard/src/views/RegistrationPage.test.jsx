// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// ── vi.hoisted: variables referenced inside vi.mock factory closures ──
const { mockSignBlob, mockOpenModal } = vi.hoisted(() => ({
  mockSignBlob: vi.fn(),
  mockOpenModal: vi.fn(),
}));

// ── Wallet kit singleton; we need to control signBlob ──
vi.mock('@creit.tech/stellar-wallets-kit', () => {
  class StellarWalletsKit {
    openModal(...args) {
      return mockOpenModal(...args);
    }
    setWallet() {}
    getAddress() {
      return Promise.resolve('GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890AB');
    }
    // signBlob is checked via `walletKit.signBlob ?` in RegistrationPage
    signBlob(...args) {
      return mockSignBlob(...args);
    }
  }
  return {
    StellarWalletsKit,
    WalletNetwork: { TESTNET: 'TESTNET' },
    FreighterModule: class {},
    xBullModule: class {},
    AlbedoModule: class {},
    LobstrModule: class {},
  };
});

import RegistrationPage from './RegistrationPage';

const PUBLIC_KEY = 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890AB';
const noop = () => {};

const SIGNING_CANCELLED_MSG =
  'Transaction signing was cancelled or failed — no transaction was submitted.';

const renderPage = (publicKey = PUBLIC_KEY) =>
  render(
    <RegistrationPage
      userPublicKey={publicKey}
      setUserPublicKey={noop}
      onBack={noop}
      onRegistered={noop}
    />,
  );

describe('RegistrationPage – signing-failure path', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  /** Fill in a valid username and click Register. */
  const submitRegistration = () => {
    fireEvent.change(screen.getByPlaceholderText('stellar-fan'), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByRole('button', { name: /register username/i }));
  };

  it('shows the signing-cancelled message when the wallet rejects the signing prompt', async () => {
    // Stub fetch: suppress the /lookup call on mount
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '' }));

    mockSignBlob.mockRejectedValue(new Error('User rejected'));

    renderPage();
    submitRegistration();

    await waitFor(() =>
      expect(screen.queryByText(SIGNING_CANCELLED_MSG)).not.toBeNull(),
    );

    expect(screen.getByText(SIGNING_CANCELLED_MSG)).toBeTruthy();
  });

  it('shows the signing-cancelled message when the wallet times out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '' }));

    mockSignBlob.mockRejectedValue(new Error('Timed out waiting for user'));

    renderPage();
    submitRegistration();

    await waitFor(() =>
      expect(screen.queryByText(SIGNING_CANCELLED_MSG)).not.toBeNull(),
    );

    expect(screen.getByText(SIGNING_CANCELLED_MSG)).toBeTruthy();
  });

  it('shows the LOBSTR-specific message when signMessage is unsupported', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '' }));

    mockSignBlob.mockRejectedValue(new Error('signMessage is not supported'));

    renderPage();
    submitRegistration();

    await waitFor(() =>
      expect(
        screen.queryByText(/LOBSTR does not support registration signatures/i),
      ).not.toBeNull(),
    );
  });

  it('resets isSubmitting after a signing failure (Register button re-enabled)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '' }));

    mockSignBlob.mockRejectedValue(new Error('User rejected'));

    renderPage();

    const submitBtn = screen.getByRole('button', { name: /register username/i });

    submitRegistration();

    // Wait for the error message to appear (signing path finished)
    await waitFor(() =>
      expect(screen.queryByText(SIGNING_CANCELLED_MSG)).not.toBeNull(),
    );

    // Button must be re-enabled — no optimistic state remains
    expect(submitBtn.disabled).toBe(false);
  });

  it('does NOT submit the registration fetch when signing fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    mockSignBlob.mockRejectedValue(new Error('User rejected'));

    renderPage();
    submitRegistration();

    await waitFor(() =>
      expect(screen.queryByText(SIGNING_CANCELLED_MSG)).not.toBeNull(),
    );

    // Only the initial /lookup call on mount should have been made;
    // the /register POST must NOT have been called.
    const postCalls = fetchMock.mock.calls.filter(
      ([url, opts]) => opts?.method === 'POST' && String(url).includes('/register'),
    );
    expect(postCalls).toHaveLength(0);
  });
});
