import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './App.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

// Namespaced key used to persist only the connected wallet public key.
// The private key / seed phrase is NEVER stored.
export const WALLET_STORAGE_KEY = 'handsoff.wallet.publicKey'

/**
 * Read the persisted wallet public key (if any) so the app can attempt a
 * silent reconnection on load. Returns null when nothing is stored or the
 * stored value is not a plausible Stellar public key.
 */
export function readPersistedWalletKey() {
  try {
    const stored = window.localStorage.getItem(WALLET_STORAGE_KEY)
    if (!stored) return null
    // Stellar public keys are 56-char base32 strings starting with 'G'.
    if (!/^G[A-Z2-7]{55}$/.test(stored)) {
      window.localStorage.removeItem(WALLET_STORAGE_KEY)
      return null
    }
    return stored
  } catch {
    return null
  }
}

/**
 * Persist the connected wallet public key. Only the public key is stored.
 */
export function persistWalletKey(publicKey) {
  try {
    if (publicKey) {
      window.localStorage.setItem(WALLET_STORAGE_KEY, publicKey)
    } else {
      window.localStorage.removeItem(WALLET_STORAGE_KEY)
    }
  } catch {
    // Storage may be unavailable (private mode, quota); ignore silently.
  }
}

/**
 * Clear the persisted wallet key, e.g. when silent reconnection fails.
 */
export function clearPersistedWalletKey() {
  try {
    window.localStorage.removeItem(WALLET_STORAGE_KEY)
  } catch {
    // ignore
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
