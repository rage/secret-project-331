import { useQuery } from "@tanstack/react-query"

import { fetchSystemHealthDetailed } from "../services/backend/status"

import { SystemHealthStatus } from "@/shared-module/common/bindings"

export const useSystemHealthDetailed = () => {
  return useQuery<SystemHealthStatus>({
    queryKey: ["status", "system-health-detailed"],
    queryFn: () => fetchSystemHealthDetailed(),
    refetchInterval: 10000,
  })
}
