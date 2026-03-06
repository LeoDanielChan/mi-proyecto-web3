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
  const { reset, flipState, error } = useP2PFlip();
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
      <div className="glass-card rounded-3xl p-8 max-w-md w-full mx-4 text-center animate-slide-up relative">

        {/* Botón cerrar — solo visible cuando ya hay resultado */}
        {isResolved && (
          <button
            onClick={reset}
            className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-card hover:bg-card-hover text-muted hover:text-foreground transition cursor-pointer text-lg leading-none"
            aria-label="Cerrar"
          >
            ✕
          </button>
        )}

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
              </div>
              <div className="rounded-xl bg-card/80 p-3">
                <p className="text-xs text-muted mb-1">Jugador 2</p>
                <p className="font-mono text-sm text-foreground truncate">
                  {game.player2 ? formatAddress(game.player2) : "—"}
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

            {/* Perdedor: pago en progreso (automático) */}
            {isLoser && isPaying && (
              <div className="mb-4 rounded-xl bg-warning/10 border border-warning/20 p-3">
                <span className="flex items-center justify-center gap-2 text-warning text-sm">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-warning/30 border-t-warning" />
                  Enviando {game.betSol} SOL al ganador…
                </span>
              </div>
            )}

            {/* Perdedor: pago pendiente (fallback manual si la TX automática falló) */}
            {isLoser && !isPaid && !isPaying && error && (
              <div className="mb-4 rounded-xl bg-danger/10 border border-danger/20 p-3">
                <p className="text-danger text-xs mb-1">{error}</p>
                <p className="text-warning text-xs">
                  El pago automático falló. Contacta a tu oponente.
                </p>
              </div>
            )}

            {/* Ganador: esperando pago */}
            {isWinner && !isPaid && (
              <div className="mb-4 rounded-xl bg-accent-teal/10 border border-accent-teal/20 p-3">
                <span className="flex items-center justify-center gap-2 text-accent-teal text-sm">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-teal/30 border-t-accent-teal" />
                  Esperando pago de {game.betSol} SOL…
                </span>
              </div>
            )}

            {/* Pago completado */}
            {isPaid && (
              <div className="mb-4 rounded-xl bg-success/10 border border-success/20 p-3">
                <p className="text-success text-sm mb-2">
                  ✅ {isWinner ? "¡Pago recibido!" : "Pago enviado"}
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

            {/* Botón Jugar de nuevo — solo cuando haya resultado definitivo */}
            {(isPaid || (!isWinner && !isPaying)) && (
              <button
                onClick={reset}
                className="w-full btn-primary rounded-xl py-3 text-sm mt-2"
              >
                🎲 Jugar de nuevo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
