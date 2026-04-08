"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusDeploymentsOptions } from "../services/backend/status"

export const useStatusDeployments = () => {
  return useQuery({
    ...getStatusDeploymentsOptions(),
    refetchInterval: 10000,
  })
}
