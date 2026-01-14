"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchPodDisruptionBudgets } from "../services/backend/status"

import { PodDisruptionBudgetInfo } from "@/shared-module/common/bindings"

export const useStatusPodDisruptionBudgets = () => {
  return useQuery<PodDisruptionBudgetInfo[]>({
    queryKey: ["status", "pod-disruption-budgets"],
    queryFn: () => fetchPodDisruptionBudgets(),
    refetchInterval: 10000,
  })
}
