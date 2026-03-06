"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSolTransfer, useWalletSession } from "@solana/react-hooks";
import type { TicTacToeGame } from "../types/tictactoe";

export type TTTState = "idle" | "waiting" | "playing" | "paying" | "finished";

const POLL_MS = 1500; // actualizar tablero cada 1.5s

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

    // ── Pago automático ──────────────────────────────────────────────────────────

    const payWinner = useCallback(async (g: TicTacToeGame) => {
        const addr = walletRef.current;
        if (!addr || g.loserAddress !== addr || g.winnerAddress === addr) return;
        if (g.winner === "draw" || g.winnerTxSig) return;

        setIsPaying(true);
        try {
            const lamports = BigInt(Math.round(g.betSol * 1_000_000_000));
            const sig = await sendSolRef.current({
                amount: lamports,
                destination: g.winnerAddress!,
            });
            const sigStr = String(sig ?? "");
            await apiPatch(g.id, { action: "paid", winnerTxSig: sigStr });
            setGame((prev) => prev ? { ...prev, winnerTxSig: sigStr } : prev);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al pagar");
        } finally {
            setIsPaying(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Polling de estado de la partida activa ───────────────────────────────────

    const pollFailCountRef = useRef(0);

    function startPoll(gameId: string) {
        stopPoll();
        pollFailCountRef.current = 0;
        pollRef.current = setInterval(async () => {
            const updated = await apiGet(gameId);
            if (!updated) {
                pollFailCountRef.current += 1;
                // Only stop polling after 3 consecutive failures
                if (pollFailCountRef.current >= 3) { stopPoll(); }
                return;
            }
            pollFailCountRef.current = 0;

            setGame(updated);

            if (updated.status === "playing") setTttState("playing");

            if (updated.status === "finished") {
                stopPoll();
                setTttState("finished");
                // Pago automático si soy el perdedor
                const addr = walletRef.current;
                if (addr && updated.loserAddress === addr && updated.winner !== "draw") {
                    await payWinner(updated);
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

    // ── Crear partida ────────────────────────────────────────────────────────────

    const createGame = useCallback(async (betSol: number) => {
        if (!walletAddress) { setError("Conecta tu wallet primero"); return; }
        setError(null);

        try {
            const id = generateId();
            const res = await fetch("/api/tictactoe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, player1: walletAddress, betSol }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al crear partida");
            setGame(data.game);
            setTttState("waiting");
            startPoll(data.game.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al crear");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walletAddress]);

    // ── Unirse a partida ─────────────────────────────────────────────────────────

    const joinGame = useCallback(async (gameId: string) => {
        if (!walletAddress) { setError("Conecta tu wallet primero"); return; }
        setError(null);

        try {
            const joined = await apiPatch(gameId, { action: "join", player2: walletAddress });
            if (!joined) throw new Error("No se pudo unir");
            setGame(joined);
            setTttState("playing");
            startPoll(gameId);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al unirse");
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
            if (updated) setGame(updated);
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
