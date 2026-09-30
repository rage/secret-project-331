"use client"

import { CheckCircle, MinusCircle, XmarkCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import type { Control, FieldValues, Path } from "react-hook-form"

import { GroupedToggleButton } from "./GroupedToggleButton"
import { ToggleButtonGroup } from "./ToggleButtonGroup"

export interface TriStateToggleProps<T extends FieldValues, N extends Path<T> = Path<T>> {
  name: N
  control: Control<T>
  label: React.ReactNode
}

export const OFF = "off"
export const INCLUDE = "include"
export const EXCLUDE = "exclude"

export function TriStateToggle<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: TriStateToggleProps<T, N>,
) {
  const { name, control, label } = props

  return (
    <ToggleButtonGroup
      name={name}
      control={control}
      label={label}
      defaultSelectedKeys={new Set([OFF])}
    >
      <GroupedToggleButton id="include">{<CheckCircle />}</GroupedToggleButton>
      <GroupedToggleButton id="off">{<MinusCircle />}</GroupedToggleButton>
      <GroupedToggleButton id="exclude">{<XmarkCircle />}</GroupedToggleButton>
    </ToggleButtonGroup>
  )
}
