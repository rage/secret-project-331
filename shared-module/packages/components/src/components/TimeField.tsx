"use client"

import React from "react"
import type { FieldValues, Path } from "react-hook-form"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"

import { SegmentedDateInputField } from "./primitives/SegmentedDateInputField"
import type { FieldSize } from "./primitives/fieldStyles"

// oxlint-disable-next-line i18next/no-literal-string
const floatingLayout = "floating" as const
// oxlint-disable-next-line i18next/no-literal-string
const timeFieldKind = "time" as const

/**
 * Segmented time input; value is a time string compatible with the segmented serializer.
 * Uses react-hook-form; pass `name` and `control`.
 *
 * @example
 * <TimeField name="startTime" control={control} label="Time" />
 */
export type TimeFieldProps<T extends FieldValues, N extends Path<T> = Path<T>> = RhfFieldProps<
  T,
  N
> & {
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

export function TimeField<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: TimeFieldProps<T, N>,
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
  const { field, resolvedError, isInvalid } = useRhfField({ name, control, rules, errorMessage })
  const value = (field.value as string | undefined) ?? ""

  return (
    <SegmentedDateInputField
      ref={field.ref}
      kind={timeFieldKind}
      layout={floatingLayout}
      label={label}
      description={description}
      errorMessage={resolvedError}
      notice={notice}
      {...(fieldSize !== undefined ? { fieldSize } : {})}
      iconStart={iconStart}
      iconEnd={iconEnd}
      {...(isDisabled !== undefined ? { isDisabled } : {})}
      {...(isReadOnly !== undefined ? { isReadOnly } : {})}
      {...(isRequired !== undefined ? { isRequired } : {})}
      isInvalid={isInvalid}
      {...(id !== undefined ? { id } : {})}
      {...(className !== undefined ? { className } : {})}
      {...(min !== undefined ? { min } : {})}
      {...(max !== undefined ? { max } : {})}
      {...(step !== undefined ? { step } : {})}
      {...(hourCycle !== undefined ? { hourCycle } : {})}
      {...(inputRef !== undefined ? { inputRef } : {})}
      value={value}
      onChange={(e) => {
        field.onChange(e.target.value)
      }}
      onBlur={field.onBlur}
    />
  )
}
