import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { fetchSavedItems, fetchSavedSearches, setItemSaved, type SavedItemType } from "@/lib/saved";

export function useSavedItems() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["saved-items", session?.user.id],
    queryFn: fetchSavedItems,
    enabled: Boolean(session?.user.id),
  });
}

export function useSavedSearches() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["saved-searches", session?.user.id],
    queryFn: fetchSavedSearches,
    enabled: Boolean(session?.user.id),
  });
}

export function useSavedItem(itemType: SavedItemType, itemId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const savedItems = useSavedItems();
  const isSaved = Boolean(savedItems.data?.some((item) => item.item_type === itemType && item.item_id === itemId));
  const mutation = useMutation({
    mutationFn: (next: boolean) => setItemSaved(session!.user.id, itemType, itemId, next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: ["saved-items", session?.user.id] });
      const previous = queryClient.getQueryData(["saved-items", session?.user.id]);
      queryClient.setQueryData<any[]>(["saved-items", session?.user.id], (items = []) => next
        ? [{ id: `optimistic-${itemType}-${itemId}`, user_id: session!.user.id, item_type: itemType, item_id: itemId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...items]
        : items.filter((item) => item.item_type !== itemType || item.item_id !== itemId));
      return { previous };
    },
    onError: (_error, _next, context) => queryClient.setQueryData(["saved-items", session?.user.id], context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["saved-items", session?.user.id] }),
  });
  return {
    isSaved,
    isLoading: mutation.isPending,
    toggle: (next = !isSaved) => {
      if (!session?.user.id || !itemId) return Promise.resolve();
      return mutation.mutateAsync(next);
    },
    error: mutation.error,
  };
}
