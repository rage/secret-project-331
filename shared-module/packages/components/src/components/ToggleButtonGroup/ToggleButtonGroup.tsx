"use client"

import { css, cx } from "@emotion/css"
import { useToggleGroupState } from "@react-stately/toggle"
import type { ToggleGroupState } from "@react-stately/toggle"
import { createContext, useId, useRef, type ReactNode } from "react"
import { useToggleButtonGroup, type Key } from "react-aria"
import type { FieldValues, Path } from "react-hook-form"

import { type RhfFieldProps, useRhfField } from "../../lib/types/rhfField"
import { omitUndefined } from "../../lib/utils/nullability"
import type { ButtonSize } from "./toggleButtonStyles"

export type ToggleButtonGroupSelectionMode = "single" | "multiple"

export interface ToggleButtonGroupContextValue {
  state: ToggleGroupState
  fieldSize: ButtonSize
}

export const ToggleButtonGroupContext = createContext<ToggleButtonGroupContextValue | null>(null)

export const labelCss = css`
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.35;
  min-width: 0;
  overflow-wrap: anywhere;
`

const groupCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
`

const buttonGroupCss = css`
  display: flex;
  flex-wrap: wrap;
`

export type ToggleButtonGroupProps<
  T extends FieldValues,
  N extends Path<T> = Path<T>,
> = RhfFieldProps<T, N> & {
  label: ReactNode
  selectionMode?: ToggleButtonGroupSelectionMode
  defaultSelectedKeys?: Set<Key>
  disallowEmptySelection?: boolean
  isDisabled?: boolean
  fieldSize?: ButtonSize
  "aria-label"?: string
  "aria-labelledby"?: string
  className?: string
  children?: ReactNode
}

/**
 * Group of toggle buttons.
 * Uses react-hook-form; pass `name` and `control`.
 *
 * @example
 * <ToggleButtonGroup name="plan" control={control} label="Plan">
 *   <ToggleButtonGroupButton id="a">
 *     {t("a")}
 *   </ToggleButtonGroupButton>
 * </ToggleButtonGroup >
 */
export function ToggleButtonGroup<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: ToggleButtonGroupProps<T, N>,
) {
  const {
    name,
    control,
    rules,
    label,
    selectionMode = "single",
    defaultSelectedKeys,
    disallowEmptySelection = true,
    isDisabled = false,
    fieldSize = "small",
    className,
    children,
    "aria-label": ariaLabelProp,
    "aria-labelledby": labelledByProp,
  } = props

  const { field } = useRhfField({ name, control, rules })
  let ref = useRef<HTMLDivElement>(null)

  const labelId = useId()
  const userAriaLabel = ariaLabelProp
  const userLabelledBy = labelledByProp
  const labelledBy = userAriaLabel ? undefined : (userLabelledBy ?? labelId)

  const state = useToggleGroupState({
    ...omitUndefined({
      selectedKeys: field.value,
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
        "aria-label": userAriaLabel,
        "aria-labelledby": labelledBy,
      }),
      selectionMode,
      isDisabled,
    },
    state,
    ref,
  )

  return (
    <div {...groupProps} ref={ref} className={cx(groupCss, className)}>
      <ToggleButtonGroupContext.Provider value={{ state, fieldSize }}>
        <div className={buttonGroupCss}>{children}</div>
      </ToggleButtonGroupContext.Provider>
      <span id={labelId} className={labelCss}>
        {label}
      </span>
    </div>
  )
}
