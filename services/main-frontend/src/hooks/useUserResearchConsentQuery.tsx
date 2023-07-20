import { useQuery } from "@tanstack/react-query"
import { useContext } from "react"

import { getResearchConsentByUserId } from "../services/backend/users"
import LoginStateContext from "../shared-module/contexts/LoginStateContext"

const useUserResearchConsentQuery = () => {
  const loginStateContext = useContext(LoginStateContext)

  return useQuery([`users-get-user-research-consent`], () => getResearchConsentByUserId(), {
    enabled: loginStateContext.signedIn === true,
  })
}

export default useUserResearchConsentQuery
