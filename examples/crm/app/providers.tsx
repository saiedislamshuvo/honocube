"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider, ThemeProvider } from "@honocube/app";
import { app } from "@/lib/cube.app";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" defaultPreset="zinc">
        <AppProvider app={app}>{children}</AppProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
