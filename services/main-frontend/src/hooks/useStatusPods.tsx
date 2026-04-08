"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusPodsOptions } from "../services/backend/status"

export const useStatusPods = () => {
  return useQuery({
    ...getStatusPodsOptions(),
    refetchInterval: 10000,
  })
}
