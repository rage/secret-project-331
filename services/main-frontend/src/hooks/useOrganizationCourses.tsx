"use client"

import { QueryClient, useQuery } from "@tanstack/react-query"

import { getOrganizationCoursesOptions } from "../services/backend/organizations"

export const invalidateOrganizationCourses = (
  queryClient: QueryClient,
  _organizationId: string,
) => {
  // eslint-disable-next-line i18next/no-literal-string
  queryClient.invalidateQueries({ queryKey: ["getOrganizationCourses"] })
}

export const useOrganizationCourses = (
  organizationId: string | null,
  page: number,
  limit: number,
) => {
  const getOrgCourses = useQuery({
    ...getOrganizationCoursesOptions(organizationId ?? "", page, limit),
    enabled: !!organizationId,
  })

  return getOrgCourses
}
