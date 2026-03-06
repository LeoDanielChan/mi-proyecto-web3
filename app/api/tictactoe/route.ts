// app/api/tictactoe/route.ts
import { NextResponse } from "next/server";
import type { TicTacToeGame } from "../../types/tictactoe";

declare global {
    // eslint-disable-next-line no-var
    var __ttt_games: Map<string, TicTacToeGame> | undefined;
}

const TEN_MIN = 10 * 60 * 1000;

function getStore(): Map<string, TicTacToeGame> {
    if (!global.__ttt_games) global.__ttt_games = new Map();
    const now = Date.now();
    for (const [id, g] of global.__ttt_games) {
        if (now - g.createdAt > TEN_MIN) global.__ttt_games.delete(id);
    }
    return global.__ttt_games;
}

// GET /api/tictactoe — partidas waiting/playing para el lobby
export async function GET() {
    const store = getStore();
    const games = Array.from(store.values()).filter(
        (g) => g.status === "waiting" || g.status === "playing",
    );
    return NextResponse.json({ games });
}

// POST /api/tictactoe — crear nueva partida
export async function POST(request: Request) {
    try {
        const { id, player1, betSol } = await request.json();
        if (!id || !player1 || betSol == null)
            return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });

        const store = getStore();

        if (store.has(id))
            return NextResponse.json({ game: store.get(id) });

        // Verificar que el jugador no tenga ya una partida activa
        const hasActive = Array.from(store.values()).some(
            (g) => g.player1 === player1 && g.status === "waiting",
        );
        if (hasActive)
            return NextResponse.json(
                { error: "Ya tienes una partida esperando" },
                { status: 409 },
            );

        const game: TicTacToeGame = {
            id,
            player1,
            betSol,
            board: Array(9).fill(null),
            status: "waiting",
            createdAt: Date.now(),
        };

        store.set(id, game);
        return NextResponse.json({ game }, { status: 201 });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
