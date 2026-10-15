"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusPodsOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useStatusPods = () => {
  return useQuery({
    ...getStatusPodsOptions(),
    refetchInterval: 10000,
  })
}
