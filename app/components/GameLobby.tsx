// app/components/GameLobby.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useWalletSession } from "@solana/react-hooks";
import { useGameStore, type GameGuess } from "../hooks/useGameStore";
import { useP2PFlip } from "../hooks/useP2PFlip";

const BET_OPTIONS = [0.01, 0.05, 0.1, 0.5];
const LOBBY_POLL_MS = 3000; // sincronizar lobby cada 3 s

function formatAddress(addr: string): string {
  if (addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

// Genera un lado aleatorio justo (el jugador 2 no sabe qué eligió el jugador 1)
function randomGuess(): GameGuess {
  return Math.random() < 0.5 ? "heads" : "tails";
}

export function GameLobby() {
  const session = useWalletSession();
  const walletAddress = session?.account.address.toString() ?? null;
  const store = useGameStore();
  const { createGame, joinGame, cancelGame, flipState, error } = useP2PFlip();

  const [betSol, setBetSol] = useState(0.05);
  const [guess, setGuess] = useState<GameGuess>("heads");
  const [cancelling, setCancelling] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Ref estable a setGames para que el efecto de polling no dependa de referencias cambiantes
  const setGamesRef = useRef(store.setGames);
  useEffect(() => {
    setGamesRef.current = store.setGames;
  });

  // Polling del lobby — efecto con [] (se monta una sola vez, sin re-crear el intervalo)
  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch("/api/games");
        if (!res.ok || !active) return;
        const data = await res.json();
        if (active) setGamesRef.current(data.games ?? []);
      } catch {
        // silencioso, no interrumpir UX
      }
    }

    poll(); // carga inicial inmediata
    const interval = setInterval(poll, LOBBY_POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []); // ← array vacío: el intervalo solo se crea al montar el componente

  // Partidas disponibles: solo las que esperan oponente y no son mías
  const waitingGames = store.games.filter(
    (g) => g.status === "waiting" && g.player1 !== walletAddress,
  );

  // Mi partida activa: cualquier estado en curso (waiting o matched)
  const myWaitingGame = store.games.find(
    (g) =>
      (g.status === "waiting" || g.status === "matched") &&
      (g.player1 === walletAddress || g.player2 === walletAddress),
  );

  if (!walletAddress) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center animate-fade-in">
        <div className="text-5xl mb-4">🎰</div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          Bienvenido a SOL Flip
        </h2>
        <p className="text-muted text-sm">
          Conecta tu wallet para empezar a jugar
        </p>
      </div>
    );
  }

  const isBusy = flipState === "flipping";

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Crear partida ── */}
      {!myWaitingGame && (
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-2xl">🎲</span>
            <h2 className="text-lg font-bold text-foreground">Crear Apuesta</h2>
          </div>

          {/* Elegir lado */}
          <div className="mb-5">
            <p className="text-muted text-xs font-medium uppercase tracking-wider mb-3">
              Elige tu lado
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(["heads", "tails"] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => setGuess(side)}
                  disabled={isBusy}
                  className={`relative py-4 rounded-xl font-bold text-lg border-2 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${guess === side
                      ? side === "heads"
                        ? "border-primary bg-primary/15 text-foreground glow-purple"
                        : "border-accent-teal bg-accent-teal/15 text-foreground glow-teal"
                      : "border-border-low text-muted hover:border-border-strong"
                    }`}
                >
                  <span className="text-2xl block mb-1">
                    {side === "heads" ? "👑" : "🔵"}
                  </span>
                  {side === "heads" ? "Cara" : "Cruz"}
                </button>
              ))}
            </div>
          </div>

          {/* Monto */}
          <div className="mb-5">
            <p className="text-muted text-xs font-medium uppercase tracking-wider mb-3">
              Monto (SOL)
            </p>
            <div className="flex gap-2">
              {BET_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setBetSol(opt)}
                  disabled={isBusy}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${betSol === opt
                      ? "border-accent-teal bg-accent-teal/10 text-accent-teal"
                      : "border-border-low text-muted hover:border-border-strong"
                    }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-danger/10 border border-danger/20 p-3 text-danger text-sm">
              {error}
            </div>
          )}

          <button
            onClick={() => createGame(betSol, guess)}
            disabled={isBusy}
            className="w-full btn-gradient rounded-xl py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🎯 Crear apuesta por {betSol} SOL →
          </button>
        </div>
      )}

      {/* ── Mi partida activa (waiting o matched) ── */}
      {myWaitingGame && (
        <div className="glass-card rounded-2xl p-6 gradient-border animate-pulse-glow">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-3 w-3 rounded-full bg-warning animate-pulse" />
            <h2 className="text-lg font-bold text-foreground">
              {myWaitingGame.status === "matched"
                ? "¡Oponente encontrado! Resolviendo…"
                : "Esperando oponente…"}
            </h2>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Tu lado</span>
              <span className="text-foreground font-medium">
                {(myWaitingGame.player1 === walletAddress
                  ? myWaitingGame.player1Guess
                  : myWaitingGame.player2Guess) === "heads"
                  ? "👑 Cara"
                  : "🔵 Cruz"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Monto</span>
              <span className="text-accent-teal font-bold">
                {myWaitingGame.betSol} SOL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-muted text-xs mb-5">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted/30 border-t-muted" />
            {myWaitingGame.status === "matched"
              ? "Determinando ganador en el servidor…"
              : "El oponente debe abrir la misma URL en su dispositivo"}
          </div>

          {/* Botón cancelar — solo si soy el creador y la partida sigue esperando */}
          {myWaitingGame.status === "waiting" &&
            myWaitingGame.player1 === walletAddress && (
              <button
                onClick={async () => {
                  setCancelling(true);
                  await cancelGame(myWaitingGame.id);
                  setCancelling(false);
                }}
                disabled={cancelling}
                className="w-full rounded-xl border border-danger/40 bg-danger/10 py-2.5 text-sm font-medium text-danger hover:bg-danger/20 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelling ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-danger/30 border-t-danger" />
                    Cancelando…
                  </span>
                ) : (
                  "✕ Cancelar apuesta"
                )}
              </button>
            )}
        </div>
      )}

      {/* ── Partidas Activas (lobby) ── */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-2xl">⚔️</span>
          <h2 className="text-lg font-bold text-foreground">Partidas Activas</h2>
          <span className="ml-auto rounded-full bg-card px-2.5 py-0.5 text-xs font-bold text-muted">
            {waitingGames.length}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            en vivo
          </span>
        </div>

        {waitingGames.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-2 opacity-40">🏜️</div>
            <p className="text-muted text-sm">
              No hay partidas disponibles.
              <br />
              ¡Crea una y espera a tu oponente!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {waitingGames.map((game) => (
              <div
                key={game.id}
                className="flex items-center gap-4 rounded-xl border border-border-low bg-card/50 p-4 transition hover:bg-card-hover"
              >
                {/* Info de la partida */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-foreground">
                      {formatAddress(game.player1)}
                    </span>
                    <span className="text-muted text-xs">
                      {timeAgo(game.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-accent-teal font-bold text-sm">
                      {game.betSol} SOL
                    </span>
                    {/* No mostramos qué lado eligió el oponente — mantiene el azar */}
                    <span className="text-muted text-xs">• apuesta aleatoria 🎲</span>
                  </div>
                </div>

                {/* Botón unirse — lado asignado al azar automáticamente */}
                {joiningId === game.id ? (
                  <div className="flex items-center gap-2 text-muted text-sm">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted/30 border-t-muted" />
                    Uniéndome…
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      if (myWaitingGame) return; // ya tiene partida activa
                      setJoiningId(game.id);
                      // El lado se elige al azar — el jugador 2 no sabe qué eligió el jugador 1
                      await joinGame(game.id, randomGuess());
                      setJoiningId(null);
                    }}
                    disabled={isBusy || !!myWaitingGame}
                    className="btn-primary rounded-xl px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    ⚔️ Unirme
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
