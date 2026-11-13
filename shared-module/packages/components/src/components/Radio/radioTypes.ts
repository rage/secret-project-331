import type React from "react"

import type { FieldSize } from "../primitives/fieldStyles"
import type { RadioGroupContext } from "../RadioGroup"

export type RadioNestedContentVariant = "rule" | "indent"

export type RadioProps = Omit<React.ComponentPropsWithoutRef<"input">, "type"> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
  /** A `Badge` shown after the label, e.g. "Recommended". */
  badge?: React.ReactNode
  /**
   * `RadioGroup` list only: content revealed under the option while it is selected. It sits
   * outside the option's `<label>`, so it may hold fields and links of its own.
   */
  nestedContent?: React.ReactNode
  /** `rule`, the default, draws an accent line beside `nestedContent`; `indent` only indents it. */
  nestedContentVariant?: RadioNestedContentVariant
  /**
   * `RadioGroup` list only: animates the option out of the list. Hide options that don't apply
   * rather than disabling them; moving the value off a hidden option is the caller's job.
   */
  isHidden?: boolean
  "data-testid"?: string | undefined
}

export type RadioContextValue = NonNullable<React.ContextType<typeof RadioGroupContext>>

export type RadioInnerProps = RadioProps & {
  forwardedRef: React.ForwardedRef<HTMLInputElement>
}
