// app/api/games/route.ts
// Store compartido en el servidor — persiste entre peticiones en la misma instancia
import { NextResponse } from "next/server";
import type { Game } from "../../hooks/useGameStore";

// Singleton en módulo: se comparte entre todas las peticiones en Vercel (mismo worker)
declare global {
    // eslint-disable-next-line no-var
    var __solflip_games: Map<string, Game> | undefined;
}

function getStore(): Map<string, Game> {
    if (!global.__solflip_games) {
        global.__solflip_games = new Map();
    }
    return global.__solflip_games;
}

// GET /api/games — Listar partidas activas (waiting o matched)
export async function GET() {
    const store = getStore();
    const games = Array.from(store.values()).filter(
        (g) => g.status === "waiting" || g.status === "matched",
    );
    return NextResponse.json({ games }, { status: 200 });
}

// POST /api/games — Crear una nueva partida
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, player1, player1Guess, betSol } = body;

        if (!id || !player1 || !player1Guess || betSol == null) {
            return NextResponse.json(
                { error: "Faltan parámetros requeridos" },
                { status: 400 },
            );
        }

        const store = getStore();

        // Evitar duplicados
        if (store.has(id)) {
            return NextResponse.json({ game: store.get(id) }, { status: 200 });
        }

        const game: Game = {
            id,
            player1,
            player1Guess,
            betSol,
            status: "waiting",
            createdAt: Date.now(),
        };

        store.set(id, game);

        return NextResponse.json({ game }, { status: 201 });
    } catch (err) {
        console.error("Error al crear partida:", err);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 },
        );
    }
}
