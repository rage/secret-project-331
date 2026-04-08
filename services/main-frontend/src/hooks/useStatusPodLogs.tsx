"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusPodLogsOptions } from "../services/backend/status"

export const useStatusPodLogs = (
  podName: string | null | undefined,
  container?: string,
  tail?: number,
) => {
  return useQuery({
    ...getStatusPodLogsOptions(podName ?? "", container, tail),
    enabled: !!podName,
    refetchInterval: 10000,
  })
}
