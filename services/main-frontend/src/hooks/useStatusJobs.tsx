import { useQuery } from "@tanstack/react-query"

import { fetchJobs } from "../services/backend/status"

import { JobInfo } from "@/shared-module/common/bindings"

export const useStatusJobs = () => {
  return useQuery<JobInfo[]>({
    queryKey: ["status", "jobs"],
    queryFn: () => fetchJobs(),
    refetchInterval: 10000,
  })
}
