import { useQuery } from "@tanstack/react-query"

import { getUserDetails } from "@/services/backend"

export const useUserDetails = () => {
  const query = useQuery({
    queryKey: ["user-details/user"],
    queryFn: () => {
      return getUserDetails()
    },
  })
  return query
}
