import type React from "react"

import type { RadioGroupContext } from "../RadioGroup"
import type { FieldSize } from "../primitives/fieldStyles"

export type RadioProps = Omit<React.ComponentPropsWithoutRef<"input">, "type"> & {
  label: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  fieldSize?: FieldSize
  isDisabled?: boolean
}

export type RadioContextValue = NonNullable<React.ContextType<typeof RadioGroupContext>>

export type RadioInnerProps = RadioProps & {
  forwardedRef: React.ForwardedRef<HTMLInputElement>
}
