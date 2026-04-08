"use client"

import { useQuery } from "@tanstack/react-query"

import { getStatusIngressesOptions } from "../services/backend/status"

export const useStatusIngresses = () => {
  return useQuery({
    ...getStatusIngressesOptions(),
    refetchInterval: 10000,
  })
}
