"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusSystemHealthOptions } from "../services/backend/status"

export const useSystemHealth = () => {
  return useQuery({
    ...getStatusSystemHealthOptions(),
    refetchInterval: 10000,
  })
}
