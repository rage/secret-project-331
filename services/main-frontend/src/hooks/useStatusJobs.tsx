"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusJobsOptions } from "../services/backend/status"

export const useStatusJobs = () => {
  return useQuery({
    ...getStatusJobsOptions(),
    refetchInterval: 10000,
  })
}
