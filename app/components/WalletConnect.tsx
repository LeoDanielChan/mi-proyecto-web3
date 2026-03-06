// app/components/WalletConnect.tsx
"use client";

import {
  useWalletConnection,
  useBalance,
  useWalletSession,
} from "@solana/react-hooks";
import { useState } from "react";

function formatAddress(addr: string): string {
  if (addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatSol(lamports: bigint | null): string {
  if (lamports === null) return "—";
  return (Number(lamports) / 1e9).toFixed(4);
}

export function WalletConnect() {
  const {
    connectors,
    connect,
    disconnect,
    connected,
    connecting,
    status,
    isReady,
  } = useWalletConnection();
  const session = useWalletSession();
  const address = session?.account.address.toString();
  const { lamports } = useBalance(address);

  const [showModal, setShowModal] = useState(false);

  if (!isReady) {
    return (
      <div className="h-10 w-32 animate-pulse rounded-xl bg-card" />
    );
  }

  if (connected && address) {
    return (
      <div className="flex items-center gap-3">
        {/* Balance */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-sm">
          <span className="text-accent-teal font-semibold">
            {formatSol(lamports ?? null)}
          </span>
          <span className="text-muted">SOL</span>
        </div>

        {/* Address + Disconnect */}
        <button
          onClick={() => disconnect()}
          className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 text-sm font-medium transition hover:bg-card-hover cursor-pointer group"
        >
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="font-mono text-foreground">
            {formatAddress(address)}
          </span>
          <span className="text-muted group-hover:text-danger transition text-xs">
            ✕
          </span>
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={connecting}
        className="btn-gradient rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
      >
        {connecting ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Conectando…
          </span>
        ) : (
          "🔌 Conectar Wallet"
        )}
      </button>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowModal(false)}
        >
          <div
            className="glass-card w-full max-w-sm rounded-2xl p-6 animate-slide-up mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-foreground">
                Conectar Wallet
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted hover:text-foreground transition cursor-pointer text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {connectors.length === 0 && (
                <p className="text-muted text-sm text-center py-4">
                  No se detectaron wallets.
                  <br />
                  <a
                    href="https://phantom.app/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    Instala Phantom →
                  </a>
                </p>
              )}

              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={async () => {
                    try {
                      await connect(connector.id);
                      setShowModal(false);
                    } catch {
                      // handled upstream
                    }
                  }}
                  disabled={status === "connecting"}
                  className="w-full flex items-center justify-between rounded-xl border border-border-low bg-card px-4 py-3.5 text-left transition hover:bg-card-hover hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-medium text-foreground">
                    {connector.name}
                  </span>
                  <span className="h-2.5 w-2.5 rounded-full bg-border-low transition group-hover:bg-primary" />
                </button>
              ))}
            </div>

            <p className="text-muted text-xs text-center mt-4">
              Red: Devnet • Solo para demo
            </p>
          </div>
        </div>
      )}
    </>
  );
}
