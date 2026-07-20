"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusDeploymentsOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useStatusDeployments = () => {
  return useQuery({
    ...getStatusDeploymentsOptions(),
    refetchInterval: 10000,
  })
}
