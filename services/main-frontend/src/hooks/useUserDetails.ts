import { useQuery } from "@tanstack/react-query"

import { getUserDetails } from "../services/backend/user-details"

import { UserDetail } from "@/shared-module/common/bindings"

export const useUserDetails = (userId: string) => {
  return useQuery<UserDetail>({
    queryKey: ["user-details", userId],
    queryFn: () => getUserDetails(userId),
  })
}
