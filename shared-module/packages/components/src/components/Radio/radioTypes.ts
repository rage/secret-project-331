import type React from "react"

import { RadioGroupContext } from "../RadioGroup"
import type { FieldSize } from "../primitives/fieldStyles"

export type RadioProps = React.ComponentPropsWithoutRef<"input"> & {
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
