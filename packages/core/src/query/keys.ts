import type { QueryParams } from "../client/api-client.js";

export const queryKeys = {
  all: ["honocube"] as const,
  collections: () => [...queryKeys.all, "collections"] as const,
  collection: {
    all: (name: string) => [...queryKeys.collections(), name] as const,
    list: (name: string, params?: QueryParams) =>
      [...queryKeys.collection.all(name), "list", params ?? {}] as const,
    detail: (name: string, id: string | number) =>
      [...queryKeys.collection.all(name), "detail", String(id)] as const,
    aggregate: (name: string, params?: QueryParams) =>
      [...queryKeys.collection.all(name), "aggregate", params ?? {}] as const,
  },
};
