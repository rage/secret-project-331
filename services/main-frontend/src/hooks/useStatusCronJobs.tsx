"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusCronjobsOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useStatusCronJobs = () => {
  return useQuery({
    ...getStatusCronjobsOptions(),
    refetchInterval: 10000,
  })
}
