// app/components/GameHistory.tsx
"use client";

import { useGameStore } from "../hooks/useGameStore";
import { useWalletSession } from "@solana/react-hooks";

function formatAddress(addr: string): string {
  if (addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GameHistory() {
  const store = useGameStore();
  const session = useWalletSession();
  const walletAddress = session?.account.address.toString() ?? null;

  if (store.history.length === 0) return null;

  // Stats
  const myGames = store.history.filter(
    (g) => g.player1 === walletAddress || g.player2 === walletAddress,
  );
  const wins = myGames.filter((g) => g.winner === walletAddress).length;
  const losses = myGames.length - wins;

  // Streak calculation
  let streak = 0;
  let streakType: "win" | "lose" | null = null;
  for (const g of myGames) {
    const isWin = g.winner === walletAddress;
    if (streakType === null) {
      streakType = isWin ? "win" : "lose";
      streak = 1;
    } else if ((isWin && streakType === "win") || (!isWin && streakType === "lose")) {
      streak++;
    } else {
      break;
    }
  }

  return (
    <div className="glass-card rounded-2xl p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-2xl">📊</span>
        <h2 className="text-lg font-bold text-foreground">Historial</h2>
      </div>

      {/* Stats Row */}
      {walletAddress && myGames.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl bg-success/10 border border-success/20 p-3 text-center">
            <p className="text-2xl font-black text-success">{wins}</p>
            <p className="text-xs text-success/70 font-medium">Victorias</p>
          </div>
          <div className="rounded-xl bg-danger/10 border border-danger/20 p-3 text-center">
            <p className="text-2xl font-black text-danger">{losses}</p>
            <p className="text-xs text-danger/70 font-medium">Derrotas</p>
          </div>
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-center">
            <p className="text-2xl font-black text-primary">
              {streak > 0 && streakType === "win" ? `🔥 ${streak}` : streak}
            </p>
            <p className="text-xs text-primary/70 font-medium">Racha</p>
          </div>
        </div>
      )}

      {/* Games List */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {store.history.slice(0, 20).map((game) => {
          const isMyGame =
            game.player1 === walletAddress || game.player2 === walletAddress;
          const didWin = isMyGame && game.winner === walletAddress;
          const opponent =
            game.player1 === walletAddress ? game.player2 : game.player1;

          return (
            <div
              key={game.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                didWin
                  ? "border-success/20 bg-success/5"
                  : isMyGame
                    ? "border-danger/20 bg-danger/5"
                    : "border-border-low bg-card/30"
              }`}
            >
              <span className="text-lg">
                {didWin ? "🏆" : isMyGame ? "💀" : "📝"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-foreground truncate">
                    vs {opponent ? formatAddress(opponent) : "—"}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      didWin ? "text-success" : isMyGame ? "text-danger" : "text-muted"
                    }`}
                  >
                    {didWin ? "WIN" : isMyGame ? "LOSE" : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                  <span>{game.betSol} SOL</span>
                  <span>•</span>
                  <span>
                    {game.outcome === "heads" ? "👑 Cara" : "🔵 Cruz"}
                  </span>
                  <span>•</span>
                  <span>{game.resolvedAt ? formatDate(game.resolvedAt) : "—"}</span>
                </div>
              </div>
              {game.winnerTxSig && (
                <a
                  href={`https://solscan.io/tx/${game.winnerTxSig}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-xs hover:underline shrink-0"
                >
                  TX →
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
