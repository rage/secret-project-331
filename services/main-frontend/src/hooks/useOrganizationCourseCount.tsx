"use client"

import { QueryClient, useQuery } from "@tanstack/react-query"

import { getOrganizationCourseCountOptions } from "../services/backend/organizations"

export const invalidateOrganizationCourseCount = (
  queryClient: QueryClient,
  _organizationId: string,
) => {
  // eslint-disable-next-line i18next/no-literal-string
  queryClient.invalidateQueries({ queryKey: ["getOrganizationCourseCount"] })
}

export const useOrganizationCourseCount = (organizationId: string | null) => {
  const getOrgCourseCount = useQuery({
    ...getOrganizationCourseCountOptions(organizationId ?? ""),
    enabled: !!organizationId,
  })

  return getOrgCourseCount
}
