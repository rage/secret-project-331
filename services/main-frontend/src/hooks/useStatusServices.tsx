"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusServicesOptions } from "../services/backend/status"

export const useStatusServices = () => {
  return useQuery({
    ...getStatusServicesOptions(),
    refetchInterval: 10000,
  })
}
