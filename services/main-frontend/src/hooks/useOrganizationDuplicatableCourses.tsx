"use client"

import { useQuery } from "@tanstack/react-query"

import { getOrganizationDuplicatableCoursesOptions } from "../services/backend/organizations"

export const useOrganizationDuplicatableCourses = (organizationId: string | null) => {
  const getDuplicatableCourses = useQuery({
    ...getOrganizationDuplicatableCoursesOptions(organizationId ?? ""),
    enabled: !!organizationId,
  })

  return getDuplicatableCourses
}
