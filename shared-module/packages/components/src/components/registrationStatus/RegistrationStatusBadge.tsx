"use client"

import React from "react"

import { includeIf } from "../../lib/utils/nullability"
import { Badge } from "../Badge"
import {
  registrationStatusBadgeTone,
  registrationStatusIcon,
  type RegistrationStatusState,
} from "./registrationStatusState"

export interface RegistrationStatusBadgeProps {
  state: RegistrationStatusState
  /** The translated label. */
  children: React.ReactNode
  className?: string
  "data-testid"?: string | undefined
}

export const RegistrationStatusBadge: React.FC<RegistrationStatusBadgeProps> = ({
  state,
  children,
  className,
  "data-testid": dataTestId,
}) => {
  const Icon = registrationStatusIcon[state]
  const icon = Icon ? <Icon size={14} /> : undefined
  return (
    <Badge
      tone={registrationStatusBadgeTone[state]}
      {...includeIf(Icon, { icon })}
      {...includeIf(className, { className })}
      data-testid={dataTestId}
    >
      {children}
    </Badge>
  )
}
