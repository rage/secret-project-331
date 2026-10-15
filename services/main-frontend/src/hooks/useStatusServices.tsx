"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusServicesOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useStatusServices = () => {
  return useQuery({
    ...getStatusServicesOptions(),
    refetchInterval: 10000,
  })
}
