// API para resolver la apuesta — solo determina ganador, sin transacciones
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      gameId,
      player1Address,
      player2Address,
      betSol,
      player1Guess,
      player2Guess,
    } = body;

    if (!player1Address || !player2Address || betSol == null) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos" },
        { status: 400 },
      );
    }

    // Generar aleatoriedad basada en timestamp + random
    const seed = Date.now() + Math.floor(Math.random() * 1_000_000);
    const outcome = seed % 2 === 0 ? "heads" : "tails";

    // Determinar ganador
    let winner: string;
    if (player1Guess === outcome) {
      winner = player1Address;
    } else {
      winner = player2Address;
    }

    const loser = winner === player1Address ? player2Address : player1Address;

    return NextResponse.json({
      gameId,
      winner,
      loser,
      outcome,
      seed,
      betSol,
    });
  } catch (err) {
    console.error("Error al resolver:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
