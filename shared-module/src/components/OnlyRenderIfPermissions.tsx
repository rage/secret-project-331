import { useQuery } from "@tanstack/react-query"
import React, { useContext } from "react"

import { Action, Resource } from "../bindings"
import LoginStateContext from "../contexts/LoginStateContext"
import { authorize } from "../services/backend/auth"

interface ComponentProps {
  action: Action
  resource: Resource
  elseRender?: React.ReactNode
}

const OnlyRenderIfPermissions: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<ComponentProps>>
> = ({ action, resource, children, elseRender }) => {
  const loginState = useContext(LoginStateContext)
  const data = useQuery({
    queryKey: [
      `action-${JSON.stringify(action)}-on-resource-${JSON.stringify(resource)}-authorization`,
    ],
    queryFn: () => {
      return authorize({ action, resource })
    },
    cacheTime: 15 * 60 * 1000,
    enabled: loginState.signedIn === true,
  })

  if (loginState.signedIn !== true || data.isLoading || data.isError || !data.data) {
    if (elseRender) {
      return <>{elseRender}</>
    }
    return null
  }
  return <>{children}</>
}

export default OnlyRenderIfPermissions
