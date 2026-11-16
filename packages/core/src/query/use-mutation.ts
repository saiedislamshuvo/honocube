import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { Collection, InferRecord } from "../types/collection.js";
import type { ApiResponse } from "../client/api-client.js";
import { useApiClient } from "./provider.js";
import { queryKeys } from "./keys.js";

export interface UpdateMutationVariables<TData> {
  id: string | number;
  data: Partial<TData>;
  headers?: Record<string, string>;
  ifMatch?: string | number;
}

export type RemoveMutationVariables =
  | string
  | number
  | { id: string | number; headers?: Record<string, string>; ifMatch?: string | number };

export interface UseCollectionMutationResult<TCollection extends Collection<any>> {
  create: UseMutationResult<ApiResponse<InferRecord<TCollection>>, Error, Partial<InferRecord<TCollection>>>;
  update: UseMutationResult<
    ApiResponse<InferRecord<TCollection>>,
    Error,
    UpdateMutationVariables<InferRecord<TCollection>>
  >;
  remove: UseMutationResult<ApiResponse<unknown>, Error, RemoveMutationVariables>;
}

export function useCollectionMutation<TCollection extends Collection<any>>(
  collection: TCollection
): UseCollectionMutationResult<TCollection> {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const endpoint = collection.endpoint || `/api/${collection.name}`;

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.collection.all(collection.name),
    });
  };

  const create = useMutation({
    mutationFn: (data: Partial<InferRecord<TCollection>>) => client.post<InferRecord<TCollection>>(endpoint, data),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, data, headers, ifMatch }: UpdateMutationVariables<InferRecord<TCollection>>) => {
      const customHeaders: Record<string, string> = { ...(headers || {}) };
      if (ifMatch !== undefined && ifMatch !== null) {
        customHeaders["If-Match"] =
          typeof ifMatch === "string" && (ifMatch.startsWith("W/") || ifMatch.startsWith('"'))
            ? ifMatch
            : `W/"${ifMatch}"`;
      }
      return Object.keys(customHeaders).length > 0
        ? client.patch<InferRecord<TCollection>>(`${endpoint}/${id}`, data, { headers: customHeaders })
        : client.patch<InferRecord<TCollection>>(`${endpoint}/${id}`, data);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (param: RemoveMutationVariables) => {
      const id = typeof param === "object" ? param.id : param;
      const headers = typeof param === "object" ? param.headers : undefined;
      const ifMatch = typeof param === "object" ? param.ifMatch : undefined;
      const customHeaders: Record<string, string> = { ...(headers || {}) };
      if (ifMatch !== undefined && ifMatch !== null) {
        customHeaders["If-Match"] =
          typeof ifMatch === "string" && (ifMatch.startsWith("W/") || ifMatch.startsWith('"'))
            ? ifMatch
            : `W/"${ifMatch}"`;
      }
      return Object.keys(customHeaders).length > 0
        ? client.delete(`${endpoint}/${id}`, { headers: customHeaders })
        : client.delete(`${endpoint}/${id}`);
    },
    onSuccess: invalidate,
  });

  return {
    create,
    update,
    remove,
  };
}
