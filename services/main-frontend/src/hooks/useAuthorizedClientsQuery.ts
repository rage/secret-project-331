import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useContext } from "react"

import { getAuthorizedClientInfos, revokeAuthorizedClient } from "../services/backend/users"

import { AuthorizedClientInfo } from "@/shared-module/common/bindings"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"

const useAuthorizedClientsQuery = () => {
  const loginStateContext = useContext(LoginStateContext)
  const queryClient = useQueryClient()

  const listQuery = useQuery<AuthorizedClientInfo[]>({
    queryKey: ["authorized-clients"],
    queryFn: () => getAuthorizedClientInfos(),
    enabled: loginStateContext.signedIn === true,
  })

  const revokeMutation = useMutation({
    mutationFn: (clientId: string) => revokeAuthorizedClient(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authorized-clients"] })
    },
  })

  return { listQuery, revokeMutation }
}

export default useAuthorizedClientsQuery
