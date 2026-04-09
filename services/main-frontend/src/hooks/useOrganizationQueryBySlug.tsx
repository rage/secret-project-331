"use client"

import { useQuery } from "@tanstack/react-query"

import { getOrganizationBySlugOptions } from "@/generated/api/@tanstack/react-query.generated"

const useOrganizationBySlug = (organizationSlug: string | null) => {
  return useQuery({
    ...getOrganizationBySlugOptions({
      path: {
        organization_slug: organizationSlug!,
      },
    }),
    enabled: !!organizationSlug,
  })
}

export default useOrganizationBySlug
