// app/api/tictactoe/payout/route.ts
// Pago automático del escrow (house wallet) al ganador — server-side
import { NextResponse } from "next/server";
import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
} from "@solana/web3.js";
import type { TicTacToeGame } from "../../../types/tictactoe";

declare global {
    // eslint-disable-next-line no-var
    var __ttt_games: Map<string, TicTacToeGame> | undefined;
}

function getStore(): Map<string, TicTacToeGame> {
    if (!global.__ttt_games) global.__ttt_games = new Map();
    return global.__ttt_games;
}

function getHouseKeypair(): Keypair {
    const raw = process.env.HOUSE_WALLET_PRIVATE_KEY;
    if (!raw) throw new Error("HOUSE_WALLET_PRIVATE_KEY no configurada");
    const bytes = JSON.parse(raw) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

function getConnection(): Connection {
    const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
    return new Connection(rpc, "confirmed");
}

// POST /api/tictactoe/payout — pagar automáticamente al ganador
export async function POST(request: Request) {
    try {
        const { gameId } = await request.json();
        if (!gameId)
            return NextResponse.json({ error: "Falta gameId" }, { status: 400 });

        const store = getStore();
        const game = store.get(gameId);
        if (!game)
            return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });

        // Solo pagar si la partida terminó con ganador y no se ha pagado
        if (game.status !== "finished")
            return NextResponse.json({ error: "La partida no ha terminado" }, { status: 400 });
        if (game.payoutTxSig)
            return NextResponse.json({ game, message: "Ya fue pagado" });
        if (game.winner === "draw")
            return NextResponse.json({ game, message: "Empate — sin pago" });
        if (!game.winnerAddress)
            return NextResponse.json({ error: "No se encontró dirección del ganador" }, { status: 400 });

        const house = getHouseKeypair();
        const connection = getConnection();

        // Pagar al ganador: monto = apuesta del perdedor (lo que depositó al unirse)
        const payoutLamports = Math.round(game.betSol * 1_000_000_000);

        const tx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: house.publicKey,
                toPubkey: new PublicKey(game.winnerAddress),
                lamports: payoutLamports,
            }),
        );

        const sig = await sendAndConfirmTransaction(connection, tx, [house]);

        // Actualizar partida con la firma del pago
        const updated: TicTacToeGame = { ...game, payoutTxSig: sig };
        store.set(gameId, updated);

        return NextResponse.json({ game: updated, payoutTxSig: sig });
    } catch (err) {
        console.error("Error en payout TTT:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Error al pagar" },
            { status: 500 },
        );
    }
}
