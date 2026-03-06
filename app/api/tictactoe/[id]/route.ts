// app/api/tictactoe/[id]/route.ts
import { NextResponse } from "next/server";
import type { TicTacToeGame } from "../../../types/tictactoe";

declare global {
    // eslint-disable-next-line no-var
    var __ttt_games: Map<string, TicTacToeGame> | undefined;
}

function getStore(): Map<string, TicTacToeGame> {
    if (!global.__ttt_games) global.__ttt_games = new Map();
    return global.__ttt_games;
}

// Todas las combinaciones ganadoras del tablero
const WIN_PATTERNS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // filas
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columnas
    [0, 4, 8], [2, 4, 6],             // diagonales
];

function checkWinner(board: (null | "X" | "O")[]): {
    winner: "X" | "O" | "draw" | null;
    winningCells?: number[];
} {
    for (const [a, b, c] of WIN_PATTERNS) {
        if (board[a] && board[a] === board[b] && board[b] === board[c]) {
            return { winner: board[a] as "X" | "O", winningCells: [a, b, c] };
        }
    }
    if (board.every((cell) => cell !== null)) return { winner: "draw" };
    return { winner: null };
}

// GET /api/tictactoe/[id] — obtener estado de una partida (para polling)
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const game = getStore().get(id);
    if (!game)
        return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
    return NextResponse.json({ game });
}

// PATCH /api/tictactoe/[id] — hacer un movimiento o unirse a la partida
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const store = getStore();
        const game = store.get(id);
        if (!game)
            return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });

        const body = await request.json();

        // ── Unirse a la partida (body: { action: "join", player2 }) ──────────────
        if (body.action === "join") {
            const { player2 } = body;
            if (!player2)
                return NextResponse.json({ error: "Falta player2" }, { status: 400 });
            if (game.status !== "waiting")
                return NextResponse.json({ error: "Partida no disponible" }, { status: 409 });
            if (game.player1 === player2)
                return NextResponse.json({ error: "No puedes unirte a tu propia partida" }, { status: 400 });
            if (game.player2)
                return NextResponse.json({ error: "Partida ya completa" }, { status: 409 });

            const updated: TicTacToeGame = {
                ...game,
                player2,
                status: "playing",
                currentTurn: game.player1, // X (player1) empieza siempre
                lastMoveAt: Date.now(),
            };
            store.set(id, updated);
            return NextResponse.json({ game: updated });
        }

        // ── Hacer un movimiento (body: { action: "move", player, cellIndex }) ────
        if (body.action === "move") {
            const { player, cellIndex } = body;

            if (game.status !== "playing")
                return NextResponse.json({ error: "La partida no está en curso" }, { status: 400 });
            if (game.currentTurn !== player)
                return NextResponse.json({ error: "No es tu turno" }, { status: 400 });
            if (cellIndex < 0 || cellIndex > 8)
                return NextResponse.json({ error: "Celda inválida" }, { status: 400 });
            if (game.board[cellIndex] !== null)
                return NextResponse.json({ error: "Celda ocupada" }, { status: 400 });

            const mark = player === game.player1 ? "X" : "O";
            const newBoard = [...game.board] as (null | "X" | "O")[];
            newBoard[cellIndex] = mark;

            const { winner, winningCells } = checkWinner(newBoard);

            let updated: TicTacToeGame;
            if (winner) {
                // Partida terminada
                const winnerAddress =
                    winner === "X" ? game.player1 : winner === "O" ? game.player2 : undefined;
                const loserAddress =
                    winner === "X" ? game.player2 : winner === "O" ? game.player1 : undefined;
                updated = {
                    ...game,
                    board: newBoard,
                    status: "finished",
                    winner,
                    winnerAddress,
                    loserAddress,
                    winningCells,
                    currentTurn: undefined,
                    lastMoveAt: Date.now(),
                };
            } else {
                // Cambiar turno
                const nextTurn = player === game.player1 ? game.player2! : game.player1;
                updated = {
                    ...game,
                    board: newBoard,
                    currentTurn: nextTurn,
                    lastMoveAt: Date.now(),
                };
            }

            store.set(id, updated);
            return NextResponse.json({ game: updated });
        }

        // ── Registrar pago (body: { action: "paid", winnerTxSig }) ───────────────
        if (body.action === "paid") {
            const updated = { ...game, winnerTxSig: body.winnerTxSig };
            store.set(id, updated);
            return NextResponse.json({ game: updated });
        }

        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

// DELETE /api/tictactoe/[id] — cancelar/limpiar partida
export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    getStore().delete(id);
    return NextResponse.json({ ok: true });
}
