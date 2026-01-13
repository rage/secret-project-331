"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchPodLogs } from "../services/backend/status"

export const useStatusPodLogs = (
  podName: string | null | undefined,
  container?: string,
  tail?: number,
) => {
  return useQuery<string>({
    queryKey: ["status", "pods", podName, "logs", container, tail],
    queryFn: () => fetchPodLogs(podName!, container, tail),
    enabled: !!podName,
    refetchInterval: 10000,
  })
}
