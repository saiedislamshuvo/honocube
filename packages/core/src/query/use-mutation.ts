import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { Collection, InferRecord } from "../types/collection.js";
import type { ApiResponse } from "../client/api-client.js";
import { useApiClient } from "./provider.js";
import { queryKeys } from "./keys.js";

export interface UseCollectionMutationResult<TCollection extends Collection<any>> {
  create: UseMutationResult<ApiResponse<InferRecord<TCollection>>, Error, Partial<InferRecord<TCollection>>>;
  update: UseMutationResult<
    ApiResponse<InferRecord<TCollection>>,
    Error,
    { id: string | number; data: Partial<InferRecord<TCollection>> }
  >;
  remove: UseMutationResult<ApiResponse<unknown>, Error, string | number>;
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
    mutationFn: ({ id, data }: { id: string | number; data: Partial<InferRecord<TCollection>> }) =>
      client.patch<InferRecord<TCollection>>(`${endpoint}/${id}`, data),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string | number) => client.delete(`${endpoint}/${id}`),
    onSuccess: invalidate,
  });

  return {
    create,
    update,
    remove,
  };
}
