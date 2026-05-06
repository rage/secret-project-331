"use client"

import { useQuery } from "@tanstack/react-query"

import { getOrganizationDuplicatableCoursesOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useOrganizationDuplicatableCourses = (organizationId: string | null) => {
  const getDuplicatableCourses = useQuery({
    ...getOrganizationDuplicatableCoursesOptions({
      path: {
        organization_id: organizationId!,
      },
    }),
    enabled: !!organizationId,
  })

  return getDuplicatableCourses
}
