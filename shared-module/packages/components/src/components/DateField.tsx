"use client"

import React from "react"
import type { FieldValues, Path } from "react-hook-form"

import { type RhfFieldProps, useRhfField } from "../lib/types/rhfField"

import { SegmentedDateInputField } from "./primitives/SegmentedDateInputField"
import type { FieldSize } from "./primitives/fieldStyles"

// oxlint-disable-next-line i18next/no-literal-string
const floatingLayout = "floating" as const
// oxlint-disable-next-line i18next/no-literal-string
const dateFieldKind = "date" as const

/**
 * Segmented date input with optional calendar; value is an ISO date string (`yyyy-mm-dd`).
 * Uses react-hook-form; pass `name` and `control`.
 *
 * @example
 * <DateField name="startDate" control={control} label="Start" />
 */
export type DateFieldProps<T extends FieldValues, N extends Path<T> = Path<T>> = RhfFieldProps<
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
  inputRef?: React.Ref<HTMLInputElement>
}

export function DateField<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: DateFieldProps<T, N>,
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
    inputRef,
  } = props
  const { field, resolvedError, isInvalid } = useRhfField({
    name,
    control,
    ...(rules !== undefined ? { rules } : {}),
    errorMessage,
  })
  const value = (field.value as string | undefined) ?? ""

  return (
    <SegmentedDateInputField
      ref={field.ref}
      kind={dateFieldKind}
      layout={floatingLayout}
      label={label}
      description={description}
      errorMessage={resolvedError}
      notice={notice}
      iconStart={iconStart}
      iconEnd={iconEnd}
      isInvalid={isInvalid}
      {...(fieldSize !== undefined ? { fieldSize } : {})}
      {...(isDisabled !== undefined ? { isDisabled } : {})}
      {...(isReadOnly !== undefined ? { isReadOnly } : {})}
      {...(isRequired !== undefined ? { isRequired } : {})}
      {...(id !== undefined ? { id } : {})}
      {...(className !== undefined ? { className } : {})}
      {...(min !== undefined ? { min } : {})}
      {...(max !== undefined ? { max } : {})}
      {...(inputRef !== undefined ? { inputRef } : {})}
      value={value}
      onChange={(e) => {
        field.onChange(e.target.value)
      }}
      onBlur={field.onBlur}
    />
  )
}
