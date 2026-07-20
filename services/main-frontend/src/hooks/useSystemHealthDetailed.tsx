"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusHealthOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useSystemHealthDetailed = () => {
  return useQuery({
    ...getStatusHealthOptions(),
    refetchInterval: 10000,
  })
}
