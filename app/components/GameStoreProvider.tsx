// app/components/GameStoreProvider.tsx
"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";
import {
  GameStoreContext,
  type Game,
  loadHistory,
  saveHistory,
} from "../hooks/useGameStore";

export function GameStoreProvider({ children }: { children: ReactNode }) {
  const [games, setGames] = useState<Game[]>([]);
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [history, setHistory] = useState<Game[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const createGame = useCallback((game: Game) => {
    setGames((prev) => [...prev, game]);
  }, []);

  const updateGame = useCallback((gameId: string, updates: Partial<Game>) => {
    setGames((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, ...updates } : g)),
    );
    setCurrentGame((prev) =>
      prev?.id === gameId ? { ...prev, ...updates } : prev,
    );
  }, []);

  const addToHistory = useCallback((game: Game) => {
    setHistory((prev) => {
      const updated = [game, ...prev].slice(0, 50); // keep last 50
      saveHistory(updated);
      return updated;
    });
  }, []);

  const removeGame = useCallback((gameId: string) => {
    setGames((prev) => prev.filter((g) => g.id !== gameId));
  }, []);

  return (
    <GameStoreContext.Provider
      value={{
        games,
        currentGame,
        history,
        createGame,
        updateGame,
        setCurrentGame,
        addToHistory,
        removeGame,
      }}
    >
      {children}
    </GameStoreContext.Provider>
  );
}
