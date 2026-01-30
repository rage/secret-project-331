"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchOrganizationDuplicatableCourses } from "../services/backend/organizations"

import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const useOrganizationDuplicatableCourses = (organizationId: string | null) => {
  const getDuplicatableCourses = useQuery({
    queryKey: [`organization-duplicatable-courses`, organizationId],
    queryFn: () => fetchOrganizationDuplicatableCourses(assertNotNullOrUndefined(organizationId)),
    enabled: !!organizationId,
  })

  return getDuplicatableCourses
}
