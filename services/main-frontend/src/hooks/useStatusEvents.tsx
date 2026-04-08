"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusEventsOptions } from "../services/backend/status"

export const useStatusEvents = () => {
  return useQuery({
    ...getStatusEventsOptions(),
    refetchInterval: 10000,
  })
}
