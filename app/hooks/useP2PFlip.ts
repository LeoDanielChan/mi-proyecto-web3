"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSolTransfer, useWalletSession } from "@solana/react-hooks";
import {
  type Game,
  type GameGuess,
  generateGameId,
  useGameStore,
} from "./useGameStore";

export type FlipState = "idle" | "waiting" | "flipping" | "done" | "paying";

const POLL_INTERVAL_MS = 2500; // polling para el jugador 1 esperando oponente

export function useP2PFlip() {
  const session = useWalletSession();
  const { send: sendSol, isSending } = useSolTransfer();
  const store = useGameStore();

  const [flipState, setFlipState] = useState<FlipState>("idle");
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const walletAddress = session?.account.address.toString() ?? null;

  // --- Helpers API ---

  async function apiCreateGame(game: Game): Promise<Game | null> {
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: game.id,
        player1: game.player1,
        player1Guess: game.player1Guess,
        betSol: game.betSol,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al crear partida");
    return data.game as Game;
  }

  async function apiPatchGame(
    gameId: string,
    updates: Partial<Game>,
  ): Promise<Game | null> {
    const res = await fetch(`/api/games/${gameId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al actualizar partida");
    return data.game as Game;
  }

  async function apiGetGame(gameId: string): Promise<Game | null> {
    const res = await fetch(`/api/games/${gameId}`);
    if (res.status === 404) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al obtener partida");
    return data.game as Game;
  }

  async function apiDeleteGame(gameId: string): Promise<void> {
    await fetch(`/api/games/${gameId}`, { method: "DELETE" });
  }

  // Sincronizar lista de partidas del servidor al store local
  // (usado internamente, no se exporta — GameLobby hace su propio polling)
  const syncGamesFromServer = useCallback(async (): Promise<Game[]> => {
    const res = await fetch("/api/games");
    const data = await res.json();
    if (!res.ok) return [];
    const serverGames: Game[] = data.games ?? [];
    store.setGames(serverGames);
    return serverGames;
  }, [store]);

  // --- Polling: Jugador 1 espera que alguien se una ---
  function startPollingForOpponent(gameId: string) {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      const game = await apiGetGame(gameId);
      if (!game) {
        stopPolling();
        return;
      }
      if (game.player2 && game.status === "matched") {
        stopPolling();
        store.updateGame(gameId, game);
        store.setCurrentGame(game);
        // El jugador 1 ve la animación pero NO dispara resolveGame (lo hace player 2)
        setFlipState("flipping");
        // Esperar a que el servidor resuelva (player2 llamó a /api/resolve)
        pollForResolution(gameId);
      }
    }, POLL_INTERVAL_MS);
  }

  // Jugador 1 hace polling esperando resultado
  function pollForResolution(gameId: string) {
    const interval = setInterval(async () => {
      const game = await apiGetGame(gameId);
      if (!game) {
        clearInterval(interval);
        return;
      }
      if (game.status === "resolved" || game.status === "paid") {
        clearInterval(interval);
        store.updateGame(gameId, game);
        store.setCurrentGame(game);
        store.addToHistory(game);
        setFlipState("done");
      }
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  // Cleanup al desmontar
  useEffect(() => {
    return () => stopPolling();
  }, []);

  // --- Player 1: Crear partida ---
  const createGame = useCallback(
    async (betSol: number, guess: GameGuess) => {
      if (!session || !walletAddress) {
        setError("Conecta tu wallet primero");
        return null;
      }

      setError(null);

      const localGame: Game = {
        id: generateGameId(),
        player1: walletAddress,
        player1Guess: guess,
        betSol,
        status: "waiting",
        createdAt: Date.now(),
      };

      try {
        const serverGame = await apiCreateGame(localGame);
        if (!serverGame) throw new Error("No se pudo crear la partida");

        store.createGame(serverGame);
        store.setCurrentGame(serverGame);
        setFlipState("waiting");

        // Iniciar polling para esperar oponente
        startPollingForOpponent(serverGame.id);

        return serverGame;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear partida");
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, walletAddress, store],
  );

  // --- Player 2: Unirse a una partida ---
  const joinGame = useCallback(
    async (gameId: string, guess: GameGuess) => {
      if (!session || !walletAddress) {
        setError("Conecta tu wallet primero");
        return null;
      }

      setError(null);

      try {
        // Actualizar en servidor: player2 se une
        const joined = await apiPatchGame(gameId, {
          player2: walletAddress,
          player2Guess: guess,
          status: "matched",
        });
        if (!joined) throw new Error("Partida no encontrada");

        store.updateGame(gameId, joined);
        store.setCurrentGame(joined);
        setFlipState("flipping");

        // Player 2 resuelve el juego
        const resolved = await resolveGame(joined);
        return resolved;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al unirse a la partida",
        );
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, walletAddress, store],
  );

  // Resolver — determinar ganador en servidor, luego actualizar
  const resolveGame = useCallback(
    async (game: Game) => {
      setFlipState("flipping");

      try {
        const res = await fetch("/api/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gameId: game.id,
            player1Address: game.player1,
            player2Address: game.player2,
            betSol: game.betSol,
            player1Guess: game.player1Guess,
            player2Guess: game.player2Guess,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Error al resolver la partida");
        }

        const loser =
          data.winner === game.player1 ? game.player2 : game.player1;

        const updates: Partial<Game> = {
          winner: data.winner,
          loser: loser,
          outcome: data.outcome,
          status: "resolved",
          resolvedAt: Date.now(),
        };

        // Persistir resultado en servidor
        await apiPatchGame(game.id, updates);

        store.updateGame(game.id, updates);
        const resolvedGame = { ...game, ...updates };
        store.setCurrentGame(resolvedGame);
        store.addToHistory(resolvedGame);

        // Limpiar del servidor tras resolución
        await apiDeleteGame(game.id);

        setFlipState("done");

        return resolvedGame;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al resolver la partida",
        );
        setFlipState("done");
        return null;
      }
    },
    [store],
  );

  // Perdedor paga al ganador directamente
  const payWinner = useCallback(
    async (game: Game) => {
      if (!session || !walletAddress) {
        setError("Conecta tu wallet primero");
        return null;
      }

      if (game.winner === walletAddress) {
        setError("Eres el ganador, no necesitas pagar");
        return null;
      }

      setFlipState("paying");
      setError(null);

      try {
        const betLamports = BigInt(Math.round(game.betSol * 1_000_000_000));
        const sig = await sendSol({
          amount: betLamports,
          destination: game.winner!,
        });

        const sigStr = String(sig ?? "");

        store.updateGame(game.id, {
          winnerTxSig: sigStr,
          status: "paid",
        });

        const updatedGame = {
          ...game,
          winnerTxSig: sigStr,
          status: "paid" as const,
        };
        store.setCurrentGame(updatedGame);
        store.addToHistory(updatedGame);
        setFlipState("done");

        return updatedGame;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al enviar el pago",
        );
        setFlipState("done");
        return null;
      }
    },
    [session, walletAddress, sendSol, store],
  );

  const reset = useCallback(() => {
    stopPolling();
    setFlipState("idle");
    setError(null);
    store.setCurrentGame(null);
  }, [store]);

  return {
    flipState,
    error,
    walletAddress,
    isSending,
    createGame,
    joinGame,
    resolveGame,
    payWinner,
    reset,
  };
}
