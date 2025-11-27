import { useQuery } from "@tanstack/react-query"

import { fetchSystemHealth } from "../services/backend/status"

export const useSystemHealth = () => {
  return useQuery<boolean>({
    queryKey: ["status", "system-health"],
    queryFn: () => fetchSystemHealth(),
    refetchInterval: 10000,
  })
}
