import { useQuery } from "@tanstack/react-query"
import React from "react"

import { Action, Resource } from "../bindings"
import { authorize } from "../services/backend/auth"

interface ComponentProps {
  action: Action
  resource: Resource
}

const OnlyRenderIfPermissions: React.FC<ComponentProps> = ({ action, resource, children }) => {
  const data = useQuery([
    `action-${JSON.stringify(action)}-on-resource-${JSON.stringify(resource)}-authorization`
  ], () => {
    return authorize({ action, resource })
  }, // 15 minutes
  { cacheTime: 15 * 60 * 1000 })

  if (data.isLoading || data.isError || !data.data) {
    return null
  }
  return <>{children}</>
}

export default OnlyRenderIfPermissions
