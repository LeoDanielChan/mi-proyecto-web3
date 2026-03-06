"use client";

import { SolanaProvider } from "@solana/react-hooks";
import { type PropsWithChildren, useMemo } from "react";
import { autoDiscover, createClient } from "@solana/client";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export function Providers({ children }: PropsWithChildren) {
  const client = useMemo(
    () =>
      createClient({
        endpoint: RPC_URL,
        walletConnectors: autoDiscover(),
      }),
    [],
  );

  return <SolanaProvider client={client}>{children}</SolanaProvider>;
}
