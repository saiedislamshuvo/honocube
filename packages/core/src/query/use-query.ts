import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import type { Collection, InferRecord } from "../types/collection.js";
import type { ApiResponse, QueryParams } from "../client/api-client.js";
import { useApiClient } from "./provider.js";
import { queryKeys } from "./keys.js";

export interface UseCollectionListOptions<TCollection extends Collection<any>> {
  collection: TCollection;
  id?: never;
  params?: QueryParams;
  queryOptions?: Omit<UseQueryOptions<ApiResponse<InferRecord<TCollection>[]>>, "queryKey" | "queryFn">;
}

export interface UseCollectionDetailOptions<TCollection extends Collection<any>> {
  collection: TCollection;
  id: string | number;
  params?: QueryParams;
  queryOptions?: Omit<UseQueryOptions<ApiResponse<InferRecord<TCollection>>>, "queryKey" | "queryFn">;
}

export type UseCollectionQueryOptions<TCollection extends Collection<any>> =
  | UseCollectionListOptions<TCollection>
  | UseCollectionDetailOptions<TCollection>;

export function useCollectionQuery<TCollection extends Collection<any>>(
  options: UseCollectionDetailOptions<TCollection>
): UseQueryResult<ApiResponse<InferRecord<TCollection>>>;

export function useCollectionQuery<TCollection extends Collection<any>>(
  options: UseCollectionListOptions<TCollection>
): UseQueryResult<ApiResponse<InferRecord<TCollection>[]>>;

export function useCollectionQuery<TCollection extends Collection<any>>(
  options: UseCollectionQueryOptions<TCollection>
): UseQueryResult<any> {
  const client = useApiClient();
  const { collection, id, params, queryOptions } = options;

  const isDetail = id !== undefined && id !== null && id !== "";
  const endpoint = collection.endpoint || `/api/${collection.name}`;
  const requestPath = isDetail ? `${endpoint}/${id}` : endpoint;

  const queryKey = isDetail
    ? queryKeys.collection.detail(collection.name, id)
    : queryKeys.collection.list(collection.name, params);

  return useQuery({
    queryKey,
    queryFn: () => client.get<any>(requestPath, isDetail ? undefined : params),
    ...queryOptions,
  } as any);
}
