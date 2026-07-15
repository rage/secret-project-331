import type React from "react"

import type { FieldSize } from "../fieldStyles"

export type SegmentedFieldKind = "date" | "time" | "datetime"

export interface SegmentedFieldCommonProps {
  id?: string
  className?: string
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  notice?: React.ReactNode
  fieldSize?: FieldSize
  iconStart?: React.ReactNode
  iconEnd?: React.ReactNode
  value: string
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  onValueChange?: (value: string) => void
  onBlur?: React.FocusEventHandler<HTMLElement>
  onFocus?: React.FocusEventHandler<HTMLElement>
  inputRef?: React.Ref<HTMLInputElement>
  isDisabled?: boolean
  isReadOnly?: boolean
  isRequired?: boolean
  isInvalid?: boolean
}

export type SegmentedTemporalFieldProps = SegmentedFieldCommonProps & {
  min?: string
  max?: string
  step?: number | string
  hourCycle?: 12 | 24
}

export type SegmentedDateInputFieldProps = SegmentedTemporalFieldProps & {
  kind: SegmentedFieldKind
  layout?: "floating" | "stacked"
}

export type DateLikeFieldProps = SegmentedDateInputFieldProps & {
  kind: "date" | "datetime"
}

export type TimeOnlyFieldProps = SegmentedDateInputFieldProps & {
  kind: "time"
}
