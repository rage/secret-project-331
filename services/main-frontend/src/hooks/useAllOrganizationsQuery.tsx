"use client"

import { useQuery } from "@tanstack/react-query"

import { getOrganizationsOptions } from "@/generated/api/@tanstack/react-query.generated"

const useAllOrganizationsQuery = () => {
  return useQuery({
    ...getOrganizationsOptions(),
    gcTime: 60000,
  })
}

export default useAllOrganizationsQuery
