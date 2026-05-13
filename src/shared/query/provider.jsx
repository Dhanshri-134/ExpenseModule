"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/shared/query/client";

export function AppQueryProvider({ children }) {
  const queryClient = getQueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
