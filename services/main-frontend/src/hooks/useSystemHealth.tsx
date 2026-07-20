"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusSystemHealthOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useSystemHealth = () => {
  return useQuery({
    ...getStatusSystemHealthOptions(),
    refetchInterval: 10000,
  })
}
