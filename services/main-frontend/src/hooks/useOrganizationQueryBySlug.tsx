"use client"

import { useQuery } from "@tanstack/react-query"

import { getOrganizationBySlugOptions } from "@/generated/api/@tanstack/react-query.generated"

const useOrganizationBySlug = (organizationSlug: string | null) => {
  return useQuery({
    ...getOrganizationBySlugOptions({
      path: {
        // oxlint-disable-next-line typescript/no-non-null-assertion -- enabled: !!organizationSlug guards this query, so organizationSlug is set when it runs
        organization_slug: organizationSlug!,
      },
    }),
    enabled: !!organizationSlug,
  })
}

export default useOrganizationBySlug
