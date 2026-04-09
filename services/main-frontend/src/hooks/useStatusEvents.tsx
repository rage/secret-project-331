"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusEventsOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useStatusEvents = () => {
  return useQuery({
    ...getStatusEventsOptions(),
    refetchInterval: 10000,
  })
}
