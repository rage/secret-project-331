"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchIngresses } from "../services/backend/status"

import { IngressInfo } from "@/shared-module/common/bindings"

export const useStatusIngresses = () => {
  return useQuery<IngressInfo[]>({
    queryKey: ["status", "ingresses"],
    queryFn: () => fetchIngresses(),
    refetchInterval: 10000,
  })
}
