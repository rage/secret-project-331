"use client"

import { CheckCircle, MinusCircle, XmarkCircle } from "@vectopus/atlas-icons-react"
import type { ReactNode } from "react"
import type { Control, FieldValues, Path } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { ToggleButtonGroup } from "./ToggleButtonGroup"
import { ToggleButtonGroupButton } from "./ToggleButtonGroupButton"

export interface TriStateToggleProps<T extends FieldValues, N extends Path<T> = Path<T>> {
  name: N
  control: Control<T>
  label: ReactNode
}

export const NOT_SET = "not_set"
export const INCLUDE = "include"
export const EXCLUDE = "exclude"

export type TriStateToggleStates = "not_set" | "include" | "exclude"

export function TriStateToggle<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: TriStateToggleProps<T, N>,
) {
  const { t } = useTranslation()
  const { name, control, label } = props

  return (
    <ToggleButtonGroup
      name={name}
      control={control}
      label={label}
      defaultSelectedKeys={new Set([NOT_SET])}
    >
      <ToggleButtonGroupButton id={INCLUDE} aria-label={t("label-include")}>
        {<CheckCircle />}
      </ToggleButtonGroupButton>
      <ToggleButtonGroupButton id={NOT_SET} aria-label={t("label-null")}>
        {<MinusCircle />}
      </ToggleButtonGroupButton>
      <ToggleButtonGroupButton id={EXCLUDE} aria-label={t("label-exclude")}>
        {<XmarkCircle />}
      </ToggleButtonGroupButton>
    </ToggleButtonGroup>
  )
}
