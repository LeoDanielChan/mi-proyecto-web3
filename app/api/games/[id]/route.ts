// app/api/games/[id]/route.ts
// Actualizar o eliminar una partida específica
import { NextResponse } from "next/server";
import type { Game } from "../../../hooks/useGameStore";

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

// PATCH /api/games/[id] — Actualizar campos de una partida (unirse, actualizar estado)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const store = getStore();
        const game = store.get(id);

        if (!game) {
            return NextResponse.json(
                { error: "Partida no encontrada" },
                { status: 404 },
            );
        }

        const updates = await request.json();

        // Prevenir que el jugador 1 se una a su propia partida
        if (updates.player2 && updates.player2 === game.player1) {
            return NextResponse.json(
                { error: "No puedes unirte a tu propia partida" },
                { status: 400 },
            );
        }

        // Prevenir unirse a partida que ya tiene player2
        if (updates.player2 && game.player2) {
            return NextResponse.json(
                { error: "Partida ya tomada por otro jugador" },
                { status: 409 },
            );
        }

        const updated: Game = { ...game, ...updates };
        store.set(id, updated);

        return NextResponse.json({ game: updated }, { status: 200 });
    } catch (err) {
        console.error("Error al actualizar partida:", err);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 },
        );
    }
}

// DELETE /api/games/[id] — Eliminar una partida
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const store = getStore();
        store.delete(id);
        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (err) {
        console.error("Error al eliminar partida:", err);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 },
        );
    }
}

// GET /api/games/[id] — Obtener una partida específica (para polling)
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const store = getStore();
        const game = store.get(id);

        if (!game) {
            return NextResponse.json(
                { error: "Partida no encontrada" },
                { status: 404 },
            );
        }

        return NextResponse.json({ game }, { status: 200 });
    } catch (err) {
        console.error("Error al obtener partida:", err);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 },
        );
    }
}
