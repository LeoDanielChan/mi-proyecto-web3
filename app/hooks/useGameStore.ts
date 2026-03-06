"use client";

import { createContext, useContext } from "react";

export type GameGuess = "heads" | "tails";

export interface Game {
  id: string;
  player1: string;
  player1Guess: GameGuess;
  betSol: number;
  player2?: string;
  player2Guess?: GameGuess;
  winner?: string;
  loser?: string;
  winnerTxSig?: string;
  outcome?: GameGuess;
  status: "waiting" | "matched" | "flipping" | "resolved" | "paid";
  createdAt: number;
  resolvedAt?: number;
}

export interface GameStoreState {
  games: Game[];
  currentGame: Game | null;
  history: Game[];
}

export interface GameStoreActions {
  createGame: (game: Game) => void;
  updateGame: (gameId: string, updates: Partial<Game>) => void;
  setCurrentGame: (game: Game | null) => void;
  addToHistory: (game: Game) => void;
  removeGame: (gameId: string) => void;
}

export type GameStore = GameStoreState & GameStoreActions;

export const GameStoreContext = createContext<GameStore | null>(null);

export function useGameStore(): GameStore {
  const ctx = useContext(GameStoreContext);
  if (!ctx)
    throw new Error("useGameStore must be used within GameStoreProvider");
  return ctx;
}

export function generateGameId(): string {
  return `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function saveHistory(history: Game[]) {
  try {
    localStorage.setItem("solflip_history", JSON.stringify(history));
  } catch {
    // ignore
  }
}

export function loadHistory(): Game[] {
  try {
    const data = localStorage.getItem("solflip_history");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}
