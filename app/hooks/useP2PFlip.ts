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

// Polling: cada cuánto consulta el jugador 1 el estado de su partida
const POLL_PLAYER1_MS = 2000;

export function useP2PFlip() {
  const session = useWalletSession();
  const { send: sendSol, isSending } = useSolTransfer();
  const store = useGameStore();

  const [flipState, setFlipState] = useState<FlipState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Refs para intervalos — evitan dependencias circulares en closures
  const opponentPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolvePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref a funciones del store para usar dentro de setInterval sin re-crear closures
  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  });

  const walletAddress = session?.account.address.toString() ?? null;
  const walletRef = useRef(walletAddress);
  useEffect(() => {
    walletRef.current = walletAddress;
  });

  const sendSolRef = useRef(sendSol);
  useEffect(() => {
    sendSolRef.current = sendSol;
  });

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      stopOpponentPoll();
      stopResolvePoll();
    };
  }, []);

  // ─── Helpers internos ────────────────────────────────────────────────────────

  function stopOpponentPoll() {
    if (opponentPollRef.current) {
      clearInterval(opponentPollRef.current);
      opponentPollRef.current = null;
    }
  }

  function stopResolvePoll() {
    if (resolvePollRef.current) {
      clearInterval(resolvePollRef.current);
      resolvePollRef.current = null;
    }
  }

  async function apiGetGame(gameId: string): Promise<Game | null> {
    try {
      const res = await fetch(`/api/games/${gameId}`);
      if (res.status === 404) return null;
      const data = await res.json();
      if (!res.ok) return null;
      return data.game as Game;
    } catch {
      return null;
    }
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

  async function apiDeleteGame(gameId: string): Promise<void> {
    await fetch(`/api/games/${gameId}`, { method: "DELETE" });
  }

  // ─── Proceso de pago automático ──────────────────────────────────────────────
  // Ejecuta el pago automáticamente si el usuario conectado es el perdedor.
  // Se llama externamente desde CoinFlipAnimation en onClick O automáticamente.
  const payWinner = useCallback(
    async (game: Game) => {
      const addr = walletRef.current;
      if (!addr) { setError("Conecta tu wallet primero"); return null; }
      if (game.winner === addr) { setError("Eres el ganador, no necesitas pagar"); return null; }
      if (game.status === "paid") return game;

      setFlipState("paying");
      setError(null);

      try {
        const betLamports = BigInt(Math.round(game.betSol * 1_000_000_000));
        const sig = await sendSolRef.current({
          amount: betLamports,
          destination: game.winner!,
        });

        const sigStr = String(sig ?? "");
        const updates = { winnerTxSig: sigStr, status: "paid" as const };

        // Persistir pago en servidor también para que el ganador lo vea
        await apiPatchGame(game.id, updates);

        storeRef.current.updateGame(game.id, updates);
        const updatedGame = { ...game, ...updates };
        storeRef.current.setCurrentGame(updatedGame);
        storeRef.current.addToHistory(updatedGame);
        setFlipState("done");

        return updatedGame;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al enviar el pago");
        setFlipState("done");
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ─── Polling: Jugador 1 espera que alguien se una ────────────────────────────
  function startOpponentPoll(gameId: string) {
    stopOpponentPoll();
    opponentPollRef.current = setInterval(async () => {
      const game = await apiGetGame(gameId);
      if (!game) {
        // La partida desapareció (fue eliminada por timeout u otro motivo)
        stopOpponentPoll();
        return;
      }

      // Un oponente se unió y player2 ya está resolviendo
      if (game.player2 && (game.status === "matched" || game.status === "resolved")) {
        stopOpponentPoll();
        storeRef.current.updateGame(gameId, game);
        storeRef.current.setCurrentGame(game);
        setFlipState("flipping");
        // Ahora esperar el resultado final
        startResolvePoll(gameId);
      }
    }, POLL_PLAYER1_MS);
  }

  // ─── Polling: Jugador 1 espera resultado tras unirse el oponente ─────────────
  function startResolvePoll(gameId: string) {
    stopResolvePoll();
    resolvePollRef.current = setInterval(async () => {
      const game = await apiGetGame(gameId);
      if (!game) {
        stopResolvePoll();
        return;
      }

      if (game.status === "resolved" || game.status === "paid") {
        stopResolvePoll();
        storeRef.current.updateGame(gameId, game);
        storeRef.current.setCurrentGame(game);
        storeRef.current.addToHistory(game);
        setFlipState("done");

        // Pago automático si el jugador 1 perdió
        const addr = walletRef.current;
        if (addr && game.loser === addr && game.status === "resolved") {
          await payWinner(game);
        }

        // Limpiar partida del servidor cuando jugador 1 ya tiene el resultado
        await apiDeleteGame(gameId);
      }
    }, POLL_PLAYER1_MS);
  }

  // ─── Player 1: Crear partida ─────────────────────────────────────────────────
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
        const res = await fetch("/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: localGame.id,
            player1: localGame.player1,
            player1Guess: localGame.player1Guess,
            betSol: localGame.betSol,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al crear partida");

        const serverGame: Game = data.game;

        store.createGame(serverGame);
        store.setCurrentGame(serverGame);
        setFlipState("waiting");

        // Iniciar polling esperando oponente
        startOpponentPoll(serverGame.id);

        return serverGame;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear partida");
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, walletAddress],
  );

  // ─── Player 2: Unirse a una partida ─────────────────────────────────────────
  const joinGame = useCallback(
    async (gameId: string, guess: GameGuess) => {
      if (!session || !walletAddress) {
        setError("Conecta tu wallet primero");
        return null;
      }

      setError(null);

      try {
        // Actualizar servidor: player2 se une
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
        setError(err instanceof Error ? err.message : "Error al unirse a la partida");
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, walletAddress],
  );

  // ─── Resolver: determinar ganador ────────────────────────────────────────────
  // Solo lo llama Player 2. Persiste el resultado en el servidor para que Player 1
  // lo lea vía polling. NO elimina la partida aquí (lo hace Player 1 al leerla).
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
        if (!res.ok) throw new Error(data.error || "Error al resolver la partida");

        const loser = data.winner === game.player1 ? game.player2 : game.player1;

        const updates: Partial<Game> = {
          winner: data.winner,
          loser,
          outcome: data.outcome,
          status: "resolved",
          resolvedAt: Date.now(),
        };

        // Persistir resultado en servidor para que player 1 lo vea en polling
        await apiPatchGame(game.id, updates);

        store.updateGame(game.id, updates);
        const resolvedGame = { ...game, ...updates };
        store.setCurrentGame(resolvedGame);
        store.addToHistory(resolvedGame);
        setFlipState("done");

        // Si player 2 es el perdedor, pagar automáticamente
        if (walletAddress && resolvedGame.loser === walletAddress && resolvedGame.status === "resolved") {
          await payWinner(resolvedGame);
        }

        // Player 2 NO elimina la partida — la deja en "resolved" para que player 1 la lea
        // La limpieza la hace player 1 al detectar el resultado, o el auto-cleanup de 10 min

        return resolvedGame;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al resolver la partida");
        setFlipState("done");
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walletAddress, payWinner],
  );

  const reset = useCallback(() => {
    stopOpponentPoll();
    stopResolvePoll();
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
