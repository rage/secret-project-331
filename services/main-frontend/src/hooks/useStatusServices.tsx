import { useQuery } from "@tanstack/react-query"

import { fetchServices } from "../services/backend/status"

import { ServiceInfo } from "@/shared-module/common/bindings"

export const useStatusServices = () => {
  return useQuery<ServiceInfo[]>({
    queryKey: ["status", "services"],
    queryFn: () => fetchServices(),
    refetchInterval: 10000,
  })
}
