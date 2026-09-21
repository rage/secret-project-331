"use client"

import React from "react"

import { includeIf } from "../../lib/utils/nullability"
import { Badge, type BadgeSize } from "../Badge"
import {
  registrationStatusTone,
  registrationStatusIcon,
  type RegistrationStatusState,
} from "./registrationStatusState"

export interface RegistrationStatusBadgeProps {
  state: RegistrationStatusState
  /** The translated label. */
  children: React.ReactNode
  size?: BadgeSize
  className?: string
}

const ICON_SIZE: Record<BadgeSize, number> = {
  default: 14,
  compact: 12,
}

export const RegistrationStatusBadge: React.FC<RegistrationStatusBadgeProps> = ({
  state,
  children,
  size = "default",
  className,
}) => {
  const Icon = registrationStatusIcon[state]
  const icon = Icon ? <Icon size={ICON_SIZE[size]} /> : undefined
  return (
    <Badge
      tone={registrationStatusTone[state]}
      size={size}
      {...includeIf(Icon, { icon })}
      {...includeIf(className, { className })}
    >
      {children}
    </Badge>
  )
}
