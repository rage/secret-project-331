"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusPodDisruptionBudgetsOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useStatusPodDisruptionBudgets = () => {
  return useQuery({
    ...getStatusPodDisruptionBudgetsOptions(),
    refetchInterval: 10000,
  })
}
