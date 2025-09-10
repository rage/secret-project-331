import { useQuery } from "@tanstack/react-query"

import { getUserDetails } from "../services/backend/user-details"

import { UserDetail } from "@/shared-module/common/bindings"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"

export const useUserDetails = (userId: string | null | undefined) => {
  return useQuery<UserDetail>({
    queryKey: ["user-details/user", userId],
    queryFn: () => getUserDetails(assertNotNullOrUndefined(userId)),
    enabled: !!userId,
  })
}
