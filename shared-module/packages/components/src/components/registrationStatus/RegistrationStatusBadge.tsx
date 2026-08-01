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
  /** The translated label; this component never invents copy. */
  children: React.ReactNode
  className?: string
}

/** A registration's state as a pill, using the same shapes and tones as the stepper's markers. */
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
