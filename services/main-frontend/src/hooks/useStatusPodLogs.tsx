"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusPodLogsOptions } from "@/generated/api/@tanstack/react-query.generated"
import { omitUndefined } from "@/shared-module/common/utils/nullability"

export const useStatusPodLogs = (
  podName: string | null | undefined,
  container?: string,
  tail?: number,
) => {
  return useQuery({
    ...getStatusPodLogsOptions({
      path: {
        // oxlint-disable-next-line typescript/no-non-null-assertion -- enabled guard ensures podName is set when it runs
        pod_name: podName!,
      },
      query: {
        ...omitUndefined({ container, tail }),
      },
    }),
    enabled: !!podName,
    refetchInterval: 10000,
  })
}
