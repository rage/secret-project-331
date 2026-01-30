"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"

import { getUserDetailsForUser } from "@/services/backend/user-details"
import { UserDetail } from "@/shared-module/common/bindings"

export const useUserDetailsForUserQuery = () => {
  return useQuery<UserDetail>({
    queryKey: [`user-details`],
    queryFn: () => getUserDetailsForUser(),
  })
}

export const refetchUserDetailsForUser = async (queryClient: QueryClient) => {
  await queryClient.refetchQueries({
    // eslint-disable-next-line i18next/no-literal-string
    queryKey: [`user-details`],
  })
}
