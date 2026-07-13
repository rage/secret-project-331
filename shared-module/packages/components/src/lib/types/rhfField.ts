import type { ReactNode } from "react"
import type { Control, FieldValues, Path, RegisterOptions } from "react-hook-form"
import { useController } from "react-hook-form"

/** Shared react-hook-form wiring for public field components. */
export interface RhfFieldProps<T extends FieldValues, N extends Path<T> = Path<T>> {
  name: N
  control: Control<T>
  rules?: RegisterOptions<T, N>
}

type UseRhfFieldArgs<T extends FieldValues, N extends Path<T>> = RhfFieldProps<T, N> & {
  errorMessage?: ReactNode
}

/** Wires react-hook-form controller and resolves error/invalid state for field UI. */
export function useRhfField<T extends FieldValues, N extends Path<T> = Path<T>>(
  props: UseRhfFieldArgs<T, N>,
) {
  const { name, control, rules, errorMessage } = props
  const { field, fieldState } = useController({ name, control, rules })
  const resolvedError = errorMessage ?? fieldState.error?.message
  const isInvalid = fieldState.invalid || Boolean(resolvedError)
  return { field, fieldState, resolvedError, isInvalid }
}
