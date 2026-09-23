"use client"

import { css, cx } from "@emotion/css"
import { useToggleGroupState } from "@react-stately/toggle"
import type { ToggleGroupState } from "@react-stately/toggle"
import type { Key } from "@react-types/shared"
import React, { useRef } from "react"
import { useToggleButtonGroup } from "react-aria"
import type { FieldValues, Path } from "react-hook-form"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import { omitUndefined } from "../lib/utils/nullability"
import type { ButtonSize } from "./primitives/buttonStyles"
import { checkableLabelCss } from "./primitives/checkableStyles"

export type ToggleButtonGroupSelectionMode = "single" | "multiple"

export interface ToggleButtonGroupContextValue {
  state: ToggleGroupState
  fieldSize: ButtonSize
}

export const ToggleButtonGroupContext = React.createContext<ToggleButtonGroupContextValue | null>(
  null,
)

const groupCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: anchor-center;
`

const groupVerticalCss = css`
  flex-direction: column;
  align-items: flex-start;
`

export type ToggleButtonGroupProps<
  T extends FieldValues,
  N extends Path<T> = Path<T>,
> = RhfFieldProps<T, N> & {
  label: React.ReactNode
  selectionMode?: ToggleButtonGroupSelectionMode
  selectedKeys?: Set<Key>
  defaultSelectedKeys?: Set<Key>
  disallowEmptySelection?: boolean
  isDisabled?: boolean
  orientation?: "horizontal" | "vertical"
  fieldSize?: ButtonSize
  "aria-label"?: string
  "aria-labelledby"?: string
  className?: string
  children?: React.ReactNode
}

export function ToggleButtonGroup<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: ToggleButtonGroupProps<T, N>,
) {
  const {
    name,
    control,
    rules,
    label,
    selectionMode = "single",
    selectedKeys,
    defaultSelectedKeys,
    disallowEmptySelection = true,
    isDisabled = false,
    orientation = "horizontal",
    fieldSize = "small",
    className,
    children,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
  } = props

  const { field } = useRhfField({ name, control, rules })
  let ref = useRef<HTMLDivElement>(null)

  const state = useToggleGroupState({
    ...omitUndefined({
      selectedKeys,
      defaultSelectedKeys,
      onSelectionChange: (v: Set<Key>) => {
        field.onChange(v)
      },
    }),
    selectionMode,
    disallowEmptySelection,
    isDisabled,
  })

  const { groupProps } = useToggleButtonGroup(
    {
      ...omitUndefined({
        "aria-label": ariaLabel,
        "aria-labelledby": ariaLabelledBy,
      }),
      selectionMode,
      isDisabled,
      orientation,
    },
    state,
    ref,
  )

  return (
    <div
      {...groupProps}
      className={cx(groupCss, orientation === "vertical" ? groupVerticalCss : undefined, className)}
      data-orientation={orientation}
    >
      <ToggleButtonGroupContext.Provider value={{ state, fieldSize }}>
        {children}
      </ToggleButtonGroupContext.Provider>
      <span className={checkableLabelCss}>{label}</span>
    </div>
  )
}
