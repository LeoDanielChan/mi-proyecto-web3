// app/page.tsx
"use client";

import { WalletConnect } from "./components/WalletConnect";
import { GameLobby } from "./components/GameLobby";
import { CoinFlipAnimation } from "./components/CoinFlipAnimation";
import { GameHistory } from "./components/GameHistory";
import { GameStoreProvider } from "./components/GameStoreProvider";

export default function Home() {
  return (
    <GameStoreProvider>
      <div className="relative min-h-screen overflow-x-clip bg-bg1 text-foreground bg-grid bg-radial">
        {/* Ambient glow blobs */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-accent-teal/5 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/3 blur-3xl" />
        </div>

        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border-low bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎲</span>
              <div>
                <h1 className="text-lg font-black tracking-tight">
                  <span className="gradient-text">SOL Flip</span>
                </h1>
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted font-medium">
                  P2P Game • Devnet
                </p>
              </div>
            </div>
            <WalletConnect />
          </div>
        </header>

        {/* Main */}
        <main className="relative z-10 mx-auto max-w-4xl px-4 py-8 sm:px-6">
          {/* Hero */}
          <section className="text-center mb-10 animate-fade-in">
            <h2 className="text-3xl sm:text-4xl font-black text-foreground mb-3">
              Apuesta SOL contra
              <br />
              <span className="gradient-text">otro jugador</span>
            </h2>
            <p className="text-muted text-sm sm:text-base max-w-md mx-auto leading-relaxed">
              Dos wallets. Una moneda. El contrato decide.
              <br />
              Conecta tu wallet, elige tu lado y apuesta.
            </p>

            {/* Tech badges */}
            <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
              {["Next.js", "@solana/web3.js", "SystemProgram.transfer", "Devnet"].map(
                (badge) => (
                  <span
                    key={badge}
                    className="rounded-lg bg-card border border-border-low px-2.5 py-1 text-xs font-mono text-muted"
                  >
                    {badge}
                  </span>
                ),
              )}
            </div>
          </section>

          {/* Two columns on desktop */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <GameLobby />
            </div>
            <div className="lg:col-span-1">
              <GameHistory />

              {/* How it works */}
              <div className="glass-card rounded-2xl p-6 mt-6 animate-fade-in">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">📋</span>
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Cómo funciona
                  </h3>
                </div>
                <ol className="space-y-3 text-sm text-muted">
                  {[
                    { icon: "1️⃣", text: "Conecta tu wallet Solana" },
                    { icon: "2️⃣", text: "Crea una apuesta eligiendo lado y monto" },
                    { icon: "3️⃣", text: "Espera a que otro jugador se una" },
                    { icon: "4️⃣", text: "La moneda se lanza on-chain" },
                    { icon: "5️⃣", text: "El ganador recibe el doble automáticamente" },
                  ].map((step) => (
                    <li
                      key={step.icon}
                      className="flex items-start gap-2.5"
                    >
                      <span className="text-base shrink-0">{step.icon}</span>
                      <span className="leading-snug">{step.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-16 border-t border-border-low pt-6 pb-8 text-center">
            <p className="text-muted text-xs">
              SOL Flip • Devnet Demo •{" "}
              <a
                href="https://solscan.io/?cluster=devnet"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Solscan Explorer
              </a>{" "}
              •{" "}
              <a
                href="https://faucet.solana.com/"
                target="_blank"
                rel="noreferrer"
                className="text-accent-teal hover:underline"
              >
                Faucet Devnet
              </a>
            </p>
          </footer>
        </main>

        {/* Coin Flip Overlay */}
        <CoinFlipAnimation />
      </div>
    </GameStoreProvider>
  );
}
