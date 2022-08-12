import React from "react"
import { useQuery } from "react-query"

import { Action, Resource } from "../bindings"
import { authorize } from "../services/backend/auth"

interface ComponentProps {
  action: Action
  resource: Resource
}

const RenderIfPermissions: React.FC<ComponentProps> = ({ action, resource, children }) => {
  const data = useQuery(
    `action-${JSON.stringify(action)}-on-resource-${JSON.stringify(resource)}-authorization`,
    () => {
      return authorize({ action, resource })
    },
  )

  if (data.isLoading || data.isError || !data.data) {
    return null
  }
  return <>{children}</>
}

export default RenderIfPermissions
