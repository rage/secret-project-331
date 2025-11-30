import { useQuery } from "@tanstack/react-query"

import { fetchEvents } from "../services/backend/status"

import { EventInfo } from "@/shared-module/common/bindings"

export const useStatusEvents = () => {
  return useQuery<EventInfo[]>({
    queryKey: ["status", "events"],
    queryFn: () => fetchEvents(),
    refetchInterval: 10000,
  })
}
