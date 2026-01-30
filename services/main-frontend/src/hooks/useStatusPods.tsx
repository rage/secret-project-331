"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchPods } from "../services/backend/status"

import { PodInfo } from "@/shared-module/common/bindings"

export const useStatusPods = () => {
  return useQuery<PodInfo[]>({
    queryKey: ["status", "pods"],
    queryFn: () => fetchPods(),
    refetchInterval: 10000,
  })
}
