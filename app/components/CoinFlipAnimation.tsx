"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "../hooks/useGameStore";
import { useP2PFlip } from "../hooks/useP2PFlip";
import { useWalletSession } from "@solana/react-hooks";

function formatAddress(addr: string): string {
  if (addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function CoinFlipAnimation() {
  const store = useGameStore();
  const { reset, flipState, payWinner, error } = useP2PFlip();
  const session = useWalletSession();
  const walletAddress = session?.account.address.toString() ?? null;
  const game = store.currentGame;

  const [spinning, setSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (game?.status === "matched" || flipState === "flipping") {
      setSpinning(true);
      setShowResult(false);
    }
  }, [game?.status, flipState]);

  useEffect(() => {
    if (game?.status === "resolved" || game?.status === "paid") {
      const timer = setTimeout(() => {
        setSpinning(false);
        setShowResult(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [game?.status]);

  if (
    !game ||
    (game.status !== "matched" &&
      game.status !== "resolved" &&
      game.status !== "paid" &&
      flipState !== "flipping")
  ) {
    return null;
  }

  const isWinner = game.winner === walletAddress;
  const isLoser = game.loser === walletAddress;
  const isResolved =
    (game.status === "resolved" || game.status === "paid") && showResult;
  const isPaid = game.status === "paid";
  const isPaying = flipState === "paying";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="glass-card rounded-3xl p-8 max-w-md w-full mx-4 text-center animate-slide-up">
        {/* Animación de moneda */}
        <div className="coin-container flex justify-center mb-6">
          <div className={`coin ${spinning ? "coin-spinning" : ""}`}>
            {isResolved
              ? game.outcome === "heads"
                ? "👑"
                : "🔵"
              : "🪙"}
          </div>
        </div>

        {!isResolved ? (
          <>
            <h2 className="text-2xl font-black text-foreground mb-2">
              Lanzando la moneda…
            </h2>
            <p className="text-muted text-sm mb-4">
              Resolviendo. Esto puede tomar unos segundos.
            </p>

            {/* Info jugadores */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-card/80 p-3">
                <p className="text-xs text-muted mb-1">Jugador 1</p>
                <p className="font-mono text-sm text-foreground truncate">
                  {formatAddress(game.player1)}
                </p>
                <p className="text-xs mt-1">
                  {game.player1Guess === "heads" ? "👑 Cara" : "🔵 Cruz"}
                </p>
              </div>
              <div className="rounded-xl bg-card/80 p-3">
                <p className="text-xs text-muted mb-1">Jugador 2</p>
                <p className="font-mono text-sm text-foreground truncate">
                  {game.player2 ? formatAddress(game.player2) : "—"}
                </p>
                <p className="text-xs mt-1">
                  {game.player2Guess === "heads" ? "👑 Cara" : "🔵 Cruz"}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-muted text-sm">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted/30 border-t-muted" />
              Determinando ganador…
            </div>
          </>
        ) : (
          <div className="animate-bounce-in">
            {/* Resultado */}
            <div className="text-7xl mb-4">{isWinner ? "🎉" : "💀"}</div>
            <h2
              className={`text-3xl font-black mb-2 ${isWinner ? "text-success" : "text-danger"
                }`}
            >
              {isWinner ? "¡GANASTE!" : "PERDISTE"}
            </h2>
            <p className="text-muted text-sm mb-1">
              Resultado:{" "}
              {game.outcome === "heads" ? "👑 Cara" : "🔵 Cruz"}
            </p>

            {/* Info del ganador */}
            <div className="rounded-xl bg-card/80 p-3 mb-4 mt-3">
              <p className="text-xs text-muted mb-1">Ganador</p>
              <p className="font-mono text-sm text-foreground">
                {game.winner ? formatAddress(game.winner) : "—"}
              </p>
            </div>

            {/* Perdedor: botón de pagar (solo si no se hizo automáticamente) */}
            {isLoser && !isPaid && (
              <div className="mb-4">
                <p className="text-warning text-sm mb-3">
                  💸 Debes enviar <strong>{game.betSol} SOL</strong> al ganador
                </p>
                {error && (
                  <p className="text-danger text-xs mb-2 bg-danger/10 border border-danger/20 rounded-lg p-2">
                    {error}
                  </p>
                )}
                <button
                  onClick={() => payWinner(game)}
                  disabled={isPaying}
                  className="w-full btn-gradient rounded-xl py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPaying ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Enviando pago…
                    </span>
                  ) : (
                    `💰 Pagar ${game.betSol} SOL al ganador`
                  )}
                </button>
              </div>
            )}

            {/* Pagando (automático) */}
            {isLoser && isPaying && (
              <div className="mb-4">
                <span className="flex items-center justify-center gap-2 text-warning text-sm">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-warning/30 border-t-warning" />
                  Enviando pago automático…
                </span>
              </div>
            )}

            {/* Ganador: esperando pago o polling */}
            {isWinner && !isPaid && (
              <div className="mb-4">
                <span className="flex items-center justify-center gap-2 text-accent-teal text-sm">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-teal/30 border-t-accent-teal" />
                  Esperando que el perdedor envíe {game.betSol} SOL…
                </span>
              </div>
            )}

            {/* Pago completado */}
            {isPaid && (
              <div className="mb-4">
                <p className="text-success text-sm mb-2">
                  ✅ {isWinner ? "¡Pago recibido!" : "Pago enviado exitosamente"}
                </p>
                {game.winnerTxSig && (
                  <a
                    href={`https://solscan.io/tx/${game.winnerTxSig}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary text-sm hover:underline flex items-center justify-center gap-1"
                  >
                    🔗 Ver transacción en Solscan →
                  </a>
                )}
              </div>
            )}

            <button
              onClick={reset}
              className="w-full btn-primary rounded-xl py-3 text-sm mt-2"
            >
              🎲 Jugar de nuevo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
