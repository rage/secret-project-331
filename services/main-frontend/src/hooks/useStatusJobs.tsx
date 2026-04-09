"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusJobsOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useStatusJobs = () => {
  return useQuery({
    ...getStatusJobsOptions(),
    refetchInterval: 10000,
  })
}
