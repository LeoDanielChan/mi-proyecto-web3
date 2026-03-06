"use client";

import { useState, useCallback } from "react";
import { useSolTransfer, useWalletSession } from "@solana/react-hooks";
import {
  type Game,
  type GameGuess,
  generateGameId,
  useGameStore,
} from "./useGameStore";

export type FlipState = "idle" | "waiting" | "flipping" | "done" | "paying";

export function useP2PFlip() {
  const session = useWalletSession();
  const { send: sendSol, isSending } = useSolTransfer();
  const store = useGameStore();

  const [flipState, setFlipState] = useState<FlipState>("idle");
  const [error, setError] = useState<string | null>(null);

  const walletAddress = session?.account.address.toString() ?? null;

  // Player 1: Crear partida (solo registra intención, sin TX)
  const createGame = useCallback(
    async (betSol: number, guess: GameGuess) => {
      if (!session || !walletAddress) {
        setError("Conecta tu wallet primero");
        return null;
      }

      setError(null);

      const game: Game = {
        id: generateGameId(),
        player1: walletAddress,
        player1Guess: guess,
        betSol,
        status: "waiting",
        createdAt: Date.now(),
      };

      store.createGame(game);
      store.setCurrentGame(game);
      setFlipState("waiting");

      return game;
    },
    [session, walletAddress, store],
  );

  // Player 2: Unirse a una partida existente
  const joinGame = useCallback(
    async (gameId: string, guess: GameGuess) => {
      if (!session || !walletAddress) {
        setError("Conecta tu wallet primero");
        return null;
      }

      const game = store.games.find((g) => g.id === gameId);
      if (!game) {
        setError("Partida no encontrada");
        return null;
      }

      if (game.player1 === walletAddress) {
        setError("No puedes unirte a tu propia partida");
        return null;
      }

      setError(null);

      store.updateGame(gameId, {
        player2: walletAddress,
        player2Guess: guess,
        status: "matched",
      });

      const updatedGame = {
        ...game,
        player2: walletAddress,
        player2Guess: guess,
        status: "matched" as const,
      };
      store.setCurrentGame(updatedGame);
      setFlipState("flipping");

      // Resolver automáticamente
      const resolved = await resolveGame(updatedGame);
      return resolved;
    },
    [session, walletAddress, store],
  );

  // Resolver — determinar ganador (sin transacciones)
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

        store.updateGame(game.id, updates);
        const resolvedGame = { ...game, ...updates };
        store.setCurrentGame(resolvedGame);
        store.addToHistory(resolvedGame);
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

        // Actualizar en historial también
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
