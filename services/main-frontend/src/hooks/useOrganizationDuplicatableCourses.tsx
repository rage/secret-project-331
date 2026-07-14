"use client"

import { useQuery } from "@tanstack/react-query"

import { getOrganizationDuplicatableCoursesOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useOrganizationDuplicatableCourses = (organizationId: string | null) => {
  const getDuplicatableCourses = useQuery({
    ...getOrganizationDuplicatableCoursesOptions({
      path: {
        // oxlint-disable-next-line typescript/no-non-null-assertion -- enabled guard ensures organizationId is set when it runs
        organization_id: organizationId!,
      },
    }),
    enabled: !!organizationId,
  })

  return getDuplicatableCourses
}
