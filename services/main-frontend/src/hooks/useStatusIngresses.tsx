"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusIngressesOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useStatusIngresses = () => {
  return useQuery({
    ...getStatusIngressesOptions(),
    refetchInterval: 10000,
  })
}
