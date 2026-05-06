import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getCourseMaterialAuthenticatedUserDetailsOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"

export const useUserDetails = () => {
  const loginContext = useContext(LoginStateContext)

  const query = useQuery({
    ...getCourseMaterialAuthenticatedUserDetailsOptions(),
    enabled: loginContext.signedIn === true,
  })
  return query
}
