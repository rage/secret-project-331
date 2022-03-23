import React from "react"
import { useQuery } from "react-query"

import { Action, Resource } from "../shared-module/bindings"
import { authorize } from "../shared-module/services/backend/auth"

interface ComponentProps {
  action: Action
  resource: Resource
}

const RenderIfPermissions: React.FC<ComponentProps> = ({ action, resource, children }) => {
  const data = useQuery(
    "action-on-resource-authorization",
    () => {
      if (action && resource) {
        return authorize({ action, resource })
      }
      return null
    },
    { enabled: true },
  )

  if (!data.isLoading && !data.isError) {
    return <>{children}</>
  }
  return <></>
}

export default RenderIfPermissions
