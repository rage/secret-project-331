"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusCronJobsOptions } from "../services/backend/status"

export const useStatusCronJobs = () => {
  return useQuery({
    ...getStatusCronJobsOptions(),
    refetchInterval: 10000,
  })
}
