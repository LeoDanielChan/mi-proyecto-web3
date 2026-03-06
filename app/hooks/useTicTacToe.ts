"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSolTransfer, useWalletSession } from "@solana/react-hooks";
import type { TicTacToeGame } from "../types/tictactoe";

export type TTTState = "idle" | "waiting" | "depositing" | "playing" | "paying" | "finished";

const POLL_MS = 1500; // actualizar tablero cada 1.5s

const HOUSE_WALLET = process.env.NEXT_PUBLIC_HOUSE_WALLET ?? "";

function generateId(): string {
    return `ttt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useTicTacToe() {
    const session = useWalletSession();
    const { send: sendSol } = useSolTransfer();

    const [game, setGame] = useState<TicTacToeGame | null>(null);
    const [lobbyGames, setLobbyGames] = useState<TicTacToeGame[]>([]);
    const [tttState, setTttState] = useState<TTTState>("idle");
    const [error, setError] = useState<string | null>(null);
    const [isPaying, setIsPaying] = useState(false);

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const walletAddress = session?.account.address.toString() ?? null;

    // Refs estables para usar dentro de setInterval sin dependencias circulares
    const walletRef = useRef(walletAddress);
    const sendSolRef = useRef(sendSol);
    const gameRef = useRef(game);
    useEffect(() => { walletRef.current = walletAddress; });
    useEffect(() => { sendSolRef.current = sendSol; });
    useEffect(() => { gameRef.current = game; });

    // Cleanup al desmontar
    useEffect(() => () => stopPoll(), []);

    function stopPoll() {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }

    // ── Helpers API ──────────────────────────────────────────────────────────────

    async function apiGet(gameId: string): Promise<TicTacToeGame | null> {
        try {
            const res = await fetch(`/api/tictactoe/${gameId}`);
            if (res.status === 404) return null;
            return (await res.json()).game ?? null;
        } catch { return null; }
    }

    async function apiPatch(gameId: string, body: object): Promise<TicTacToeGame | null> {
        const res = await fetch(`/api/tictactoe/${gameId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al actualizar");
        return data.game ?? null;
    }

    async function apiDelete(gameId: string) {
        await fetch(`/api/tictactoe/${gameId}`, { method: "DELETE" });
    }

    // ── Depósito en escrow (house wallet) ────────────────────────────────────────

    async function depositToEscrow(betSol: number): Promise<string> {
        if (!HOUSE_WALLET) throw new Error("House wallet no configurada");
        const lamports = BigInt(Math.round(betSol * 1_000_000_000));
        const sig = await sendSolRef.current({
            amount: lamports,
            destination: HOUSE_WALLET,
        });
        return String(sig ?? "");
    }

    // ── Pago automático server-side ──────────────────────────────────────────────

    const payoutTriggeredRef = useRef<Set<string>>(new Set());

    async function triggerServerPayout(gameId: string) {
        // Evitar llamadas duplicadas
        if (payoutTriggeredRef.current.has(gameId)) return;
        payoutTriggeredRef.current.add(gameId);

        setIsPaying(true);
        try {
            const res = await fetch("/api/tictactoe/payout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gameId }),
            });
            const data = await res.json();
            if (res.ok && data.game) {
                setGame(data.game);
            }
        } catch (err) {
            console.error("Error en payout automático:", err);
        } finally {
            setIsPaying(false);
        }
    }

    // ── Polling de estado de la partida activa ───────────────────────────────────

    const pollFailCountRef = useRef(0);

    function startPoll(gameId: string) {
        stopPoll();
        pollFailCountRef.current = 0;
        pollRef.current = setInterval(async () => {
            const updated = await apiGet(gameId);
            if (!updated) {
                pollFailCountRef.current += 1;
                if (pollFailCountRef.current >= 3) { stopPoll(); }
                return;
            }
            pollFailCountRef.current = 0;

            setGame(updated);

            if (updated.status === "playing") setTttState("playing");

            if (updated.status === "finished") {
                stopPoll();
                setTttState("finished");
                // Pago automático server-side (cualquier jugador puede triggerearlo)
                if (updated.winner !== "draw" && !updated.payoutTxSig) {
                    await triggerServerPayout(updated.id);
                }
            }
        }, POLL_MS);
    }

    // ── Lobby polling (lista de partidas disponibles) ────────────────────────────

    async function syncLobby() {
        try {
            const res = await fetch("/api/tictactoe");
            const data = await res.json();
            setLobbyGames(data.games ?? []);
        } catch { /* silencioso */ }
    }

    // ── Crear partida (con depósito al escrow) ──────────────────────────────────

    const createGame = useCallback(async (betSol: number) => {
        if (!walletAddress) { setError("Conecta tu wallet primero"); return; }
        setError(null);

        try {
            // 1. Depositar apuesta en el escrow
            setTttState("depositing");
            const txSig = await depositToEscrow(betSol);

            // 2. Crear partida en el servidor con la firma del depósito
            const id = generateId();
            const res = await fetch("/api/tictactoe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, player1: walletAddress, betSol, player1TxSig: txSig }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al crear partida");
            setGame(data.game);
            setTttState("waiting");
            startPoll(data.game.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al crear");
            setTttState("idle");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walletAddress]);

    // ── Unirse a partida (con depósito al escrow) ───────────────────────────────

    const joinGame = useCallback(async (gameId: string, betSol: number) => {
        if (!walletAddress) { setError("Conecta tu wallet primero"); return; }
        setError(null);

        try {
            // 1. Depositar apuesta en el escrow
            setTttState("depositing");
            const txSig = await depositToEscrow(betSol);

            // 2. Unirse a la partida con la firma del depósito
            const joined = await apiPatch(gameId, {
                action: "join",
                player2: walletAddress,
                player2TxSig: txSig,
            });
            if (!joined) throw new Error("No se pudo unir");
            setGame(joined);
            setTttState("playing");
            startPoll(gameId);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al unirse");
            setTttState("idle");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walletAddress]);

    // ── Hacer un movimiento ──────────────────────────────────────────────────────

    const makeMove = useCallback(async (cellIndex: number) => {
        const g = gameRef.current;
        if (!g || !walletAddress) return;
        if (g.currentTurn !== walletAddress) return;
        if (g.board[cellIndex] !== null) return;
        if (g.status !== "playing") return;

        setError(null);
        try {
            const updated = await apiPatch(g.id, {
                action: "move",
                player: walletAddress,
                cellIndex,
            });
            if (updated) {
                setGame(updated);
                // Si el movimiento terminó la partida, trigger payout inmediato
                if (updated.status === "finished" && updated.winner !== "draw" && !updated.payoutTxSig) {
                    setTttState("finished");
                    stopPoll();
                    await triggerServerPayout(updated.id);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Movimiento inválido");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walletAddress]);

    // ── Cancelar partida (solo player1 waiting) ──────────────────────────────────

    const cancelGame = useCallback(async () => {
        const g = gameRef.current;
        if (!g) return;
        stopPoll();
        try { await apiDelete(g.id); } catch { /* ignorar */ }
        setGame(null);
        setTttState("idle");
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Reiniciar (volver al lobby) ──────────────────────────────────────────────

    const resetGame = useCallback(() => {
        stopPoll();
        setGame(null);
        setTttState("idle");
        setError(null);
        setIsPaying(false);
    }, []);

    return {
        game,
        lobbyGames,
        tttState,
        error,
        isPaying,
        walletAddress,
        createGame,
        joinGame,
        makeMove,
        cancelGame,
        resetGame,
        syncLobby,
    };
}
