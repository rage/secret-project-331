import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getUserDetails } from "@/services/course-material/backend"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"

export const useUserDetails = () => {
  const loginContext = useContext(LoginStateContext)

  const query = useQuery({
    queryKey: ["user-details/user"],
    queryFn: () => {
      return getUserDetails()
    },
    enabled: loginContext.signedIn === true,
  })
  return query
}
