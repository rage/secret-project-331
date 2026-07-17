"use client"

import React from "react"
import type { FieldValues, Path } from "react-hook-form"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"
import { omitUndefined } from "../lib/utils/nullability"
import type { FieldSize } from "./primitives/fieldStyles"
import { SegmentedDateInputField } from "./primitives/SegmentedDateInputField"

// oxlint-disable-next-line i18next/no-literal-string
const floatingLayout = "floating" as const
// oxlint-disable-next-line i18next/no-literal-string
const dateTimeFieldKind = "datetime" as const

/**
 * Segmented local date-time input with calendar; value is an ISO-like datetime string.
 * Uses react-hook-form; pass `name` and `control`.
 *
 * @example
 * <DateTimeLocalField name="dueAt" control={control} label="Due" />
 */
export type DateTimeLocalFieldProps<
  T extends FieldValues,
  N extends Path<T> = Path<T>,
> = RhfFieldProps<T, N> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  notice?: React.ReactNode
  fieldSize?: FieldSize
  iconStart?: React.ReactNode
  iconEnd?: React.ReactNode
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  id?: string
  className?: string
  min?: string
  max?: string
  step?: number | string
  hourCycle?: 12 | 24
  inputRef?: React.Ref<HTMLInputElement>
}

export function DateTimeLocalField<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: DateTimeLocalFieldProps<T, N>,
) {
  const {
    name,
    control,
    rules,
    label,
    description,
    errorMessage,
    notice,
    fieldSize,
    iconStart,
    iconEnd,
    isDisabled,
    isReadOnly,
    isRequired,
    id,
    className,
    min,
    max,
    step,
    hourCycle,
    inputRef,
  } = props
  const { field, resolvedError, isInvalid } = useRhfField({
    name,
    control,
    ...omitUndefined({ rules }),
    errorMessage,
  })
  const value = (field.value as string | undefined) ?? ""

  return (
    <SegmentedDateInputField
      ref={field.ref}
      kind={dateTimeFieldKind}
      layout={floatingLayout}
      label={label}
      description={description}
      errorMessage={resolvedError}
      notice={notice}
      iconStart={iconStart}
      iconEnd={iconEnd}
      isInvalid={isInvalid}
      {...omitUndefined({ fieldSize })}
      {...omitUndefined({ isDisabled })}
      {...omitUndefined({ isReadOnly })}
      {...omitUndefined({ isRequired })}
      {...omitUndefined({ id })}
      {...omitUndefined({ className })}
      {...omitUndefined({ min })}
      {...omitUndefined({ max })}
      {...omitUndefined({ step })}
      {...omitUndefined({ hourCycle })}
      {...omitUndefined({ inputRef })}
      value={value}
      onChange={(e) => {
        field.onChange(e.target.value)
      }}
      onBlur={field.onBlur}
    />
  )
}
