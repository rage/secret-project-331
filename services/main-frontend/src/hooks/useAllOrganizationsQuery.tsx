"use client"

import { useQuery } from "@tanstack/react-query"

import { getOrganizationsOptions } from "../services/backend/organizations"

const useAllOrganizationsQuery = () => {
  return useQuery({
    ...getOrganizationsOptions(),
    gcTime: 60000,
  })
}

export default useAllOrganizationsQuery
