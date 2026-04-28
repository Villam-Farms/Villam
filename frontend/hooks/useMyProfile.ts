import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/context/auth-context";
import { getMe } from "@/lib/follows";

export function useMyProfile() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const userId = session?.user.id ?? null;

  return useQuery({
    queryKey: ["me", userId],
    queryFn: async () => {
      if (!accessToken) return null;
      const response = await getMe(accessToken);
      return response.profile;
    },
    enabled: Boolean(accessToken && userId),
    staleTime: 1000 * 60,
  });
}
