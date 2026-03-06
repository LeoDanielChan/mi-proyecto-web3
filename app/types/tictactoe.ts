// app/types/tictactoe.ts
// Tipos compartidos entre API (servidor) y hooks/UI (cliente)

export interface TicTacToeGame {
    id: string;
    player1: string;           // dirección wallet — juega con X
    player2?: string;          // dirección wallet — juega con O
    betSol: number;
    board: (null | "X" | "O")[]; // 9 celdas (índices 0-8)
    currentTurn?: string;      // dirección del jugador con turno activo
    status: "waiting" | "playing" | "finished";
    winner?: "X" | "O" | "draw";
    winnerAddress?: string;
    loserAddress?: string;
    winningCells?: number[];   // índices de las 3 celdas ganadoras (para resaltar)
    winnerTxSig?: string;
    createdAt: number;
    lastMoveAt?: number;
}
