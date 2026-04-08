"use client"

import { useQuery } from "@tanstack/react-query"

import { getOrganizationBySlugOptions } from "../services/backend/organizations"

const useOrganizationBySlug = (organizationSlug: string | null) => {
  return useQuery({
    ...getOrganizationBySlugOptions(organizationSlug ?? ""),
    enabled: organizationSlug !== null,
  })
}

export default useOrganizationBySlug
