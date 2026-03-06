// app/components/TicTacToeBoard.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useTicTacToe } from "../hooks/useTicTacToe";

const BET_OPTIONS = [0.01, 0.05, 0.1, 0.5];

function formatAddress(addr: string) {
    if (addr.length <= 8) return addr;
    return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function timeAgo(ts: number) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h`;
}

// ── Celda individual del tablero ─────────────────────────────────────────────
function Cell({
    value,
    index,
    isWinning,
    isMyTurn,
    onClick,
}: {
    value: null | "X" | "O";
    index: number;
    isWinning: boolean;
    isMyTurn: boolean;
    onClick: () => void;
}) {
    const isEmpty = value === null;
    const canClick = isEmpty && isMyTurn;

    return (
        <button
            onClick={onClick}
            disabled={!canClick}
            aria-label={`Celda ${index + 1}${value ? ` — ${value}` : ""}`}
            className={[
                "aspect-square flex items-center justify-center rounded-2xl",
                "text-5xl sm:text-6xl font-black select-none transition-all duration-200",
                "border-2",
                isWinning
                    ? "border-warning bg-warning/15 shadow-[0_0_20px_rgba(255,193,7,0.4)]"
                    : value === "X"
                        ? "border-primary/40 bg-primary/10"
                        : value === "O"
                            ? "border-accent-teal/40 bg-accent-teal/10"
                            : canClick
                                ? "border-border-low bg-card/40 hover:bg-card hover:border-border-strong hover:scale-[1.04] cursor-pointer"
                                : "border-border-low/50 bg-card/20 cursor-not-allowed",
            ].join(" ")}
        >
            {value === "X" && (
                <span className={`${isWinning ? "text-warning" : "text-primary"} animate-bounce-in`}>
                    ✕
                </span>
            )}
            {value === "O" && (
                <span className={`${isWinning ? "text-warning" : "text-accent-teal"} animate-bounce-in`}>
                    ○
                </span>
            )}
        </button>
    );
}

// ── Componente principal ─────────────────────────────────────────────────────
export function TicTacToeBoard() {
    const {
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
    } = useTicTacToe();

    const [betSol, setBetSol] = useState(0.05);
    const [cancelling, setCancelling] = useState(false);
    const [joiningId, setJoiningId] = useState<string | null>(null);
    const setGamesRef = useRef(syncLobby);
    useEffect(() => { setGamesRef.current = syncLobby; });

    // Polling del lobby cada 3 s
    useEffect(() => {
        let active = true;
        async function poll() { if (active) await setGamesRef.current(); }
        poll();
        const iv = setInterval(poll, 3000);
        return () => { active = false; clearInterval(iv); };
    }, []);

    // ── Derivados ────────────────────────────────────────────────────────────────
    const isPlayer1 = game?.player1 === walletAddress;
    const isPlayer2 = game?.player2 === walletAddress;
    const myMark = isPlayer1 ? "X" : isPlayer2 ? "O" : null;
    const isMyTurn = !!walletAddress && game?.currentTurn === walletAddress && game?.status === "playing";
    const isFinished = game?.status === "finished";
    const isDraw = game?.winner === "draw";
    const iWon = !!game?.winnerAddress && game.winnerAddress === walletAddress;
    const iLost = !!game?.loserAddress && game.loserAddress === walletAddress;
    const winningCells = game?.winningCells ?? [];
    const availableLobby = lobbyGames.filter(
        (g) => g.status === "waiting" && g.player1 !== walletAddress,
    );

    if (!walletAddress) {
        return (
            <div className="glass-card rounded-2xl p-8 text-center animate-fade-in">
                <div className="text-5xl mb-4">🎮</div>
                <h2 className="text-xl font-bold text-foreground mb-2">Tic-Tac-Toe P2P</h2>
                <p className="text-muted text-sm">Conecta tu wallet para jugar</p>
            </div>
        );
    }

    // ── VISTA: Depositando apuesta ────────────────────────────────────────────────
    if (tttState === "depositing") {
        return (
            <div className="glass-card rounded-2xl p-8 text-center animate-fade-in">
                <div className="flex flex-col items-center gap-4">
                    <span className="h-8 w-8 animate-spin rounded-full border-3 border-primary/30 border-t-primary" />
                    <h2 className="text-lg font-bold text-foreground">Depositando apuesta…</h2>
                    <p className="text-muted text-sm">
                        Aprueba la transacción en tu wallet para depositar tu apuesta en el escrow.
                    </p>
                </div>
            </div>
        );
    }

    // ── VISTA: Tablero activo ────────────────────────────────────────────────────
    if (game && (tttState === "playing" || tttState === "finished" || tttState === "paying")) {
        const opponent = isPlayer1 ? game.player2 : game.player1;
        const opponentMark = myMark === "X" ? "O" : "X";

        return (
            <div className="space-y-4 animate-fade-in">
                {/* Header de la partida */}
                <div className="glass-card rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">🎮</span>
                            <span className="text-sm font-bold text-foreground">Partida en curso</span>
                        </div>
                        <span className="text-accent-teal font-bold text-sm">{game.betSol} SOL</span>
                    </div>

                    {/* Jugadores y turno */}
                    <div className="grid grid-cols-2 gap-3">
                        {(["X", "O"] as const).map((mark) => {
                            const addr = mark === "X" ? game.player1 : game.player2;
                            const isMe = addr === walletAddress;
                            const isTurn = game.currentTurn === addr && !isFinished;
                            return (
                                <div
                                    key={mark}
                                    className={[
                                        "rounded-xl p-3 border-2 transition-all",
                                        isTurn
                                            ? mark === "X"
                                                ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(147,51,234,0.3)]"
                                                : "border-accent-teal bg-accent-teal/10 shadow-[0_0_12px_rgba(20,184,166,0.3)]"
                                            : "border-border-low bg-card/40",
                                    ].join(" ")}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-lg font-black ${mark === "X" ? "text-primary" : "text-accent-teal"}`}>
                                            {mark === "X" ? "✕" : "○"}
                                        </span>
                                        <span className="text-xs font-bold text-muted uppercase tracking-wider">
                                            {isMe ? "Tú" : "Oponente"}
                                        </span>
                                        {isTurn && (
                                            <span className="ml-auto h-2 w-2 rounded-full bg-success animate-pulse" />
                                        )}
                                    </div>
                                    <p className="font-mono text-xs text-foreground truncate">
                                        {addr ? formatAddress(addr) : "—"}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Indicador de turno */}
                    {!isFinished && (
                        <p className={`text-center text-sm mt-3 font-medium ${isMyTurn ? "text-success" : "text-muted"}`}>
                            {isMyTurn ? "⚡ ¡Es tu turno!" : "⏳ Turno del oponente…"}
                        </p>
                    )}
                </div>

                {/* Tablero 3×3 */}
                <div className="glass-card rounded-2xl p-4 sm:p-6">
                    <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
                        {game.board.map((cell, i) => (
                            <Cell
                                key={i}
                                value={cell}
                                index={i}
                                isWinning={winningCells.includes(i)}
                                isMyTurn={isMyTurn}
                                onClick={() => makeMove(i)}
                            />
                        ))}
                    </div>
                </div>

                {/* Resultado */}
                {isFinished && (
                    <div className={[
                        "glass-card rounded-2xl p-6 text-center border-2",
                        iWon ? "border-success/40 bg-success/5"
                            : iLost ? "border-danger/40 bg-danger/5"
                                : "border-border-low",
                    ].join(" ")}>
                        <div className="text-5xl mb-3">
                            {isDraw ? "🤝" : iWon ? "🏆" : "💀"}
                        </div>
                        <h3 className={`text-2xl font-black mb-2 ${iWon ? "text-success" : iLost ? "text-danger" : "text-foreground"
                            }`}>
                            {isDraw ? "¡Empate!" : iWon ? "¡GANASTE!" : "PERDISTE"}
                        </h3>

                        {isDraw && (
                            <p className="text-muted text-sm mb-4">Sin pago — nadie ganó. Las apuestas permanecen en el escrow.</p>
                        )}

                        {!isDraw && (
                            <div className="mb-4">
                                {isPaying ? (
                                    <span className="flex items-center justify-center gap-2 text-warning text-sm">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-warning/30 border-t-warning" />
                                        Procesando pago automático…
                                    </span>
                                ) : game.payoutTxSig ? (
                                    <div>
                                        <p className="text-success text-sm mb-2">
                                            {iWon ? "✅ ¡Pago recibido automáticamente!" : "✅ Pago enviado al ganador"}
                                        </p>
                                        <a
                                            href={`https://solscan.io/tx/${game.payoutTxSig}?cluster=devnet`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-primary text-xs hover:underline"
                                        >
                                            🔗 Ver TX en Solscan →
                                        </a>
                                    </div>
                                ) : (
                                    <span className="flex items-center justify-center gap-2 text-accent-teal text-sm">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-teal/30 border-t-accent-teal" />
                                        Procesando pago…
                                    </span>
                                )}
                            </div>
                        )}

                        <button
                            onClick={resetGame}
                            className="w-full btn-primary rounded-xl py-3 text-sm"
                        >
                            🎮 Volver al lobby
                        </button>
                    </div>
                )}

                {/* Botón abandonar (solo mientras se juega) */}
                {!isFinished && (
                    <button
                        onClick={resetGame}
                        className="w-full rounded-xl border border-border-low bg-card/40 py-2 text-xs text-muted hover:text-foreground hover:bg-card transition cursor-pointer"
                    >
                        Abandonar partida
                    </button>
                )}
            </div>
        );
    }

    // ── VISTA: Esperando oponente ────────────────────────────────────────────────
    if (game && tttState === "waiting") {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="glass-card rounded-2xl p-6 gradient-border animate-pulse-glow">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="h-3 w-3 rounded-full bg-warning animate-pulse" />
                        <h2 className="text-lg font-bold text-foreground">Esperando oponente…</h2>
                    </div>
                    <div className="space-y-3 mb-5">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted">Juego</span>
                            <span className="text-foreground font-medium">✕ Tic-Tac-Toe</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted">Tu marca</span>
                            <span className="text-primary font-black text-base">✕ X</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted">Apuesta</span>
                            <span className="text-accent-teal font-bold">{game.betSol} SOL</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted text-xs mb-4">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted/30 border-t-muted" />
                        La URL debe ser compartida con el oponente
                    </div>
                    <button
                        disabled={cancelling}
                        onClick={async () => {
                            setCancelling(true);
                            await cancelGame();
                            setCancelling(false);
                        }}
                        className="w-full rounded-xl border border-danger/40 bg-danger/10 py-2.5 text-sm font-medium text-danger hover:bg-danger/20 transition cursor-pointer disabled:opacity-50"
                    >
                        {cancelling ? "Cancelando…" : "✕ Cancelar apuesta"}
                    </button>
                </div>

                {/* Previsualización del tablero vacío */}
                <div className="glass-card rounded-2xl p-6 opacity-50">
                    <p className="text-center text-xs text-muted mb-4 uppercase tracking-wider">Tablero</p>
                    <div className="grid grid-cols-3 gap-2 max-w-[180px] mx-auto">
                        {Array(9).fill(null).map((_, i) => (
                            <div key={i} className="aspect-square rounded-xl border border-border-low/40 bg-card/20" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── VISTA: Lobby — Crear y unirse ────────────────────────────────────────────
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Crear partida */}
            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-5">
                    <span className="text-2xl">✕</span>
                    <h2 className="text-lg font-bold text-foreground">Nueva Partida</h2>
                </div>

                <p className="text-muted text-xs font-medium uppercase tracking-wider mb-3">
                    Monto de apuesta (SOL)
                </p>
                <div className="flex gap-2 mb-5">
                    {BET_OPTIONS.map((opt) => (
                        <button
                            key={opt}
                            onClick={() => setBetSol(opt)}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition cursor-pointer ${betSol === opt
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border-low text-muted hover:border-border-strong"
                                }`}
                        >
                            {opt}
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="mb-4 rounded-xl bg-danger/10 border border-danger/20 p-3 text-danger text-sm">
                        {error}
                    </div>
                )}

                <button
                    onClick={() => createGame(betSol)}
                    className="w-full btn-gradient rounded-xl py-4 text-base"
                >
                    ✕ Crear partida por {betSol} SOL
                </button>

                <p className="text-xs text-muted text-center mt-3">
                    Juegas con <span className="text-primary font-bold">✕ X</span> y mueves primero
                </p>
            </div>

            {/* Partidas disponibles */}
            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-5">
                    <span className="text-2xl">○</span>
                    <h2 className="text-lg font-bold text-foreground">Partidas Disponibles</h2>
                    <span className="ml-auto rounded-full bg-card px-2.5 py-0.5 text-xs font-bold text-muted">
                        {availableLobby.length}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                        en vivo
                    </span>
                </div>

                {availableLobby.length === 0 ? (
                    <div className="text-center py-6">
                        <div className="text-3xl mb-2 opacity-40">🎮</div>
                        <p className="text-muted text-sm">
                            No hay partidas disponibles.
                            <br />
                            ¡Crea una y espera a tu oponente!
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {availableLobby.map((g) => (
                            <div
                                key={g.id}
                                className="flex items-center gap-4 rounded-xl border border-border-low bg-card/50 p-4 hover:bg-card-hover transition"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-sm text-foreground">
                                            {formatAddress(g.player1)}
                                        </span>
                                        <span className="text-primary font-black text-sm">✕</span>
                                        <span className="text-muted text-xs ml-auto">{timeAgo(g.createdAt)}</span>
                                    </div>
                                    <span className="text-accent-teal font-bold text-sm">{g.betSol} SOL</span>
                                </div>

                                {joiningId === g.id ? (
                                    <span className="flex items-center gap-1 text-muted text-sm">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted/30 border-t-muted" />
                                        Uniéndome…
                                    </span>
                                ) : (
                                    <button
                                        onClick={async () => {
                                            setJoiningId(g.id);
                                            await joinGame(g.id, g.betSol);
                                            setJoiningId(null);
                                        }}
                                        className="btn-primary rounded-xl px-4 py-2 text-sm shrink-0"
                                    >
                                        ○ Unirme
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
