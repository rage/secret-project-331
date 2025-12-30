import { useQuery } from "@tanstack/react-query"

import { fetchDeployments } from "../services/backend/status"

import { DeploymentInfo } from "@/shared-module/common/bindings"

export const useStatusDeployments = () => {
  return useQuery<DeploymentInfo[]>({
    queryKey: ["status", "deployments"],
    queryFn: () => fetchDeployments(),
    refetchInterval: 10000,
  })
}
