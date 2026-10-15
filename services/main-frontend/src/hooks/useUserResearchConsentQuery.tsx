"use client"

import type { QueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getUserResearchConsentOptions } from "@/generated/api/@tanstack/react-query.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"

const useUserResearchConsentQuery = () => {
  const loginStateContext = useContext(LoginStateContext)

  return useQuery({
    ...getUserResearchConsentOptions(),
    enabled: loginStateContext.signedIn === true,
  })
}

export const refetchUserResearchConsent = async (queryClient: QueryClient) => {
  await queryClient.refetchQueries({
    queryKey: getUserResearchConsentOptions().queryKey,
  })
}

export default useUserResearchConsentQuery
