"use client"

import { useQuery } from "@tanstack/react-query"

import { getAuthUserInfo } from "../generated/auth-api/sdk.generated"
import "../init/registerAuthApiClients"

const useUserInfo = () => {
  const query = useQuery({ queryKey: ["user-info"], queryFn: () => getAuthUserInfo() })
  return query
}

export default useUserInfo
