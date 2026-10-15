"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"

import { getUserDetailsForAuthenticatedUserOptions } from "@/generated/api/@tanstack/react-query.generated"

export const useUserDetailsForUserQuery = () => {
  return useQuery({
    ...getUserDetailsForAuthenticatedUserOptions(),
  })
}

export const refetchUserDetailsForUser = async (queryClient: QueryClient) => {
  await queryClient.refetchQueries({
    queryKey: getUserDetailsForAuthenticatedUserOptions().queryKey,
  })
}
