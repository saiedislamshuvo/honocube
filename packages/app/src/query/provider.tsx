import React, { createContext, useContext, useMemo } from "react";
import type { AppInstance } from "../types/app.js";
import { ApiClient, type ApiClientOptions, createApiClient } from "../client/api-client.js";

export interface AppContextValue {
  app: AppInstance;
  client: ApiClient;
}

export const AppContext = createContext<AppContextValue | null>(null);

export interface AppProviderProps {
  app: AppInstance;
  client?: ApiClient;
  clientOptions?: Partial<ApiClientOptions>;
  children: React.ReactNode;
}

export function AppProvider({ app, client, clientOptions, children }: AppProviderProps): React.JSX.Element {
  const apiClient = useMemo(() => {
    if (client) return client;
    return createApiClient({
      ...app,
      ...clientOptions,
    });
  }, [app, client, clientOptions]);

  const value = useMemo(() => ({ app, client: apiClient }), [app, apiClient]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an <AppProvider>.");
  }
  return context;
}

export function useApiClient(): ApiClient {
  return useApp().client;
}
