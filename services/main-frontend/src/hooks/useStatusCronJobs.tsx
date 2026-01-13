"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchCronJobs } from "../services/backend/status"

import { CronJobInfo } from "@/shared-module/common/bindings"

export const useStatusCronJobs = () => {
  return useQuery<CronJobInfo[]>({
    queryKey: ["status", "cronjobs"],
    queryFn: () => fetchCronJobs(),
    refetchInterval: 10000,
  })
}
