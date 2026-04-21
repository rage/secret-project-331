"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusPodLogsOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useStatusPodLogs = (
  podName: string | null | undefined,
  container?: string,
  tail?: number,
) => {
  return useQuery({
    ...getStatusPodLogsOptions({
      path: {
        pod_name: podName!,
      },
      query: {
        container,
        tail,
      },
    }),
    enabled: !!podName,
    refetchInterval: 10000,
  })
}
