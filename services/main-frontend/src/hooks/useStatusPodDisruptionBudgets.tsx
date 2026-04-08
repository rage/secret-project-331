"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusPodDisruptionBudgetsOptions } from "../services/backend/status"

export const useStatusPodDisruptionBudgets = () => {
  return useQuery({
    ...getStatusPodDisruptionBudgetsOptions(),
    refetchInterval: 10000,
  })
}
