import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import { toast, Toaster } from "react-hot-toast";
import logger from "./logger";
import LoadingSpinner from './components/LoadingSpinner';
import { HORIZON_BASE, API_BASE, walletKit } from './views/shared';

const Dashboard = lazy(() => import('./views/Dashboard.jsx'));
const HelpPage = lazy(() => import('./views/HelpPage.jsx'));
const AnalyticsPage = lazy(() => import('./views/AnalyticsPage.jsx'));
const HistoryPage = lazy(() => import('./views/HistoryPage.jsx'));
const RegistrationPage = lazy(() => import('./views/RegistrationPage.jsx'));

const WALLET_STORAGE_KEY = 'stellar.wallet.publicKey';

function readStoredWalletKey() {
  try {
    return localStorage.getItem(WALLET_STORAGE_KEY) || '';
  } catch (err) {
    return '';
  }
}

function persistWalletKey(publicKey) {
  try {
    localStorage.setItem(WALLET_STORAGE_KEY, publicKey);
  } catch (err) {
    logger.error('Failed to persist wallet key:', err);
  }
}

function clearStoredWalletKey() {
  try {
    localStorage.removeItem(WALLET_STORAGE_KEY);
  } catch (err) {
    logger.error('Failed to clear stored wallet key:', err);
  }
}

function generateRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function withRequestId(input, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('X-Request-ID')) {
    headers.set('X-Request-ID', generateRequestId());
  }

  return fetch(input, { ...init, headers });
}

function ViewFallback({ label = 'Loading view...' }) {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <LoadingSpinner color="text-blue" />
      <span>{label}</span>
    </div>
  );
}

function isTypingTarget(target) {
  if (!target || typeof target.tagName !== 'string') {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable === true
  );
}

function ShortcutsModal({ onClose }) {
  return (
    <div
      className="shortcuts-modal-backdrop"
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div
        className="shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-modal-title"
        onClick={(event) => event.stopPropagation()}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          padding: '24px',
          minWidth: '320px',
          maxWidth: '90vw',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
        }}
      >
        <h2 id="shortcuts-modal-title" style={{ marginTop: 0 }}>
          Keyboard Shortcuts
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0' }}>
          {KEYBOARD_SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.keys}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '16px',
                padding: '6px 0',
              }}
            >
              <kbd
                style={{
                  fontFamily: 'monospace',
                  backgroundColor: '#F3F4F6',
                  borderRadius: '4px',
                  padding: '2px 6px',
                }}
              >
                {shortcut.keys}
              </kbd>
              <span>{shortcut.description}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onClose} autoFocus>
          Close
        </button>
      </div>
    </div>
  );
}

function App() {
const [activeView, setActiveView] = useState('dashboard')
  const [userPublicKey, setUserPublicKey] = useState(() => {
    return readStoredWalletKey()
  })
  const [registrationState, setRegistrationState] = useState("unknown");
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const WALLET_TIMEOUT_MS = 15_000;

  // Attempt silent reconnection using the persisted public key on app load.
  useEffect(() => {
    const storedKey = readStoredWalletKey();
    if (!storedKey) {
      return;
    }

    let cancelled = false;

    const restore = async () => {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Wallet reconnection timed out')), WALLET_TIMEOUT_MS)
        );
        const addressResponse = await Promise.race([walletKit.getAddress(), timeoutPromise]);
        const publicKey = typeof addressResponse === 'string'
          ? addressResponse
          : addressResponse?.address;

        if (cancelled) {
          return;
        }

        if (!publicKey || publicKey !== storedKey) {
          throw new Error('Wallet no longer matches stored key');
        }

        setUserPublicKey(publicKey);
      } catch (err) {
        if (cancelled) {
          return;
        }
        logger.error('Silent wallet reconnection failed:', err);
        clearStoredWalletKey();
        setUserPublicKey('');
      }
    };

    restore();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnectWallet = async () => {
    try {
      await walletKit.openModal({
        onWalletSelected: async (option) => {
          try {
            walletKit.setWallet(option.id);
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Wallet connection timed out')), WALLET_TIMEOUT_MS)
            );
            const addressResponse = await Promise.race([walletKit.getAddress(), timeoutPromise]);
            
            // Extract the key carefully to avoid the initialization error
            const publicKey = typeof addressResponse === 'string' 
              ? addressResponse 
              : addressResponse.address;
            
            // Now that publicKey is officially created, we can fetch the user
            const dbResponse = await withRequestId(`${API_BASE}/lookup?address=${encodeURIComponent(publicKey)}`);
            
            if (dbResponse.ok) {
              setRegistrationState("existing");
            } else if (dbResponse.status === 404) {
              setRegistrationState("new");
              handleNavigate("register");
            }

            // Save the address to state so the UI updates
            persistWalletKey(publicKey);
            setUserPublicKey(publicKey);
            
          } catch (err) {
            logger.error("Wallet connection failed:", err);
            toast.error("Failed to connect wallet.");
          }
        },
      });

      return { ok: true };
    } catch (error) {
      toast.error("Connection cancelled.");
      logger.error("User closed modal or an error occurred:", error);
      return { ok: false, error: "Wallet connection process cancelled." };
    }
  };

  const handleDisconnectWallet = () => {
    clearStoredWalletKey()
    setUserPublicKey('')
    setBalance(null);
  };

  const [balance, setBalance] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [balanceError, setBalanceError] = useState("");

  const loadBalance = useCallback(async () => {
    setIsRefreshing(true);
    setBalanceError("");
    try {
      const response = await withRequestId(`${HORIZON_BASE}/accounts/${userPublicKey}`);
      if (!response.ok) {
        throw new Error(`Horizon error (${response.status}).`);
      }

      const data = await response.json();
      const nativeBalance = data?.balances?.find(
        (item) => item.asset_type === "native",
      );
      const value = nativeBalance?.balance;
      setBalance(value ? Number(value) : null);
    } catch (error) {
      setBalance(null);
      setBalanceError(error.message || "Unable to load balance.");
    } finally {
      setIsRefreshing(false);
    }
  }, [userPublicKey, setBalance, setIsRefreshing, setBalanceError]);

  useEffect(() => {
    if (!userPublicKey) {
      return;
    }
    const run = async () => {
      await loadBalance();
    };
    run();
  }, [userPublicKey, loadBalance]);

  useEffect(() => {
    const syncView = () => {
      const hash = window.location.hash;
      if (hash === "#register") {
        setActiveView("register");
        return;
      }

      if (hash === "#help") {
        setActiveView("help");
        return;
      }

      if (hash === "#analytics") {
        setActiveView("analytics");
        return;
      }

      if (hash === "#history") {
        setActiveView("history");
        return;
      }

      setActiveView("dashboard");
    };

    syncView();
    window.addEventListener("hashchange", syncView);
    return () => window.removeEventListener("hashchange", syncView);
  }, []);

  const handleNavigate = useCallback((view) => {
    setActiveView(view);
    if (view === "register") {
      window.location.hash = "register";
      return;
    }

    if (view === "help") {
      window.location.hash = "help";
      return;
    }

    if (view === "analytics") {
      window.location.hash = "analytics";
      return;
    }

    if (view === "history") {
      window.location.hash = "history";
      return;
    }

    window.location.hash = "";
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === '?' && !event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setIsShortcutsOpen((open) => !open);
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === 'r') {
          event.preventDefault();
          handleNavigate('register');
          return;
        }

        if (key === 'h') {
          event.preventDefault();
          handleNavigate('history');
          return;
        }

        if (key === 'a') {
          event.preventDefault();
          handleNavigate('analytics');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNavigate]);

  const handleRegistrationStateChange = useCallback(
    (nextState) => {
      setRegistrationState(nextState);

      if (nextState === "new") {
        handleNavigate("register");
      }

      if (nextState === "existing" && activeView === "register") {
        handleNavigate("dashboard");
      }
    },
    [activeView, handleNavigate],
  );

  if (activeView === "register" && (registrationState === "new" || registrationState === "skipped")) {
    return (
      <>
        {isOffline && (
          <div
            style={{
              backgroundColor: "#DC2626",
              color: "#FFFFFF",
              padding: "12px 16px",
              textAlign: "center",
              fontWeight: "500",
              fontSize: "14px",
              position: "sticky",
              top: 0,
              zIndex: 1000,
            }}
          >
            ⚠️ You are currently offline. Transactions will fail.
          </div>
        )}
        <Suspense fallback={<ViewFallback label="Loading registration..." />}>

        <RegistrationPage
          userPublicKey={userPublicKey}
          setUserPublicKey={setUserPublicKey}
          onBack={() => {
            setRegistrationState("skipped"); // This breaks the loop!
            handleNavigate("dashboard");
          }}
          onRegistered={() => handleRegistrationStateChange("existing")}
        />
        </Suspense>
        {isShortcutsOpen && (
          <ShortcutsModal onClose={() => setIsShortcutsOpen(false)} />
        )}
      </>
    );
  }

  if (activeView === "help") {
    return (
      <>
        {isOffline && (
          <div
            style={{
              backgroundColor: "#DC2626",
              color: "#FFFFFF",
              padding: "12px 1

/* … truncated 2006 chars — edit only what you need near the top … */
