"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusHealthOptions } from "../services/backend/status"

export const useSystemHealthDetailed = () => {
  return useQuery({
    ...getStatusHealthOptions(),
    refetchInterval: 10000,
  })
}
