"use client"

import React from "react"

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
}

export const RegistrationStatusBadge: React.FC<RegistrationStatusBadgeProps> = ({
  state,
  children,
  className,
}) => {
  const Icon = registrationStatusIcon[state]
  return (
    <Badge
      tone={registrationStatusBadgeTone[state]}
      {...(Icon ? { icon: <Icon size={14} /> } : {})}
      {...(className ? { className } : {})}
    >
      {children}
    </Badge>
  )
}
