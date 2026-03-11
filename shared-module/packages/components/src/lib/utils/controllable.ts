import React from "react"

type SetValueAction<T> = T | ((currentValue: T) => T)

type UseControllableStateOptions<T> = {
  value?: T
  defaultValue: T
  onChange?: (value: T) => void
}

export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: UseControllableStateOptions<T>) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
  const isControlled = value !== undefined
  const resolvedValue = isControlled ? value : uncontrolledValue

  const setValue = React.useCallback(
    (nextValue: SetValueAction<T>) => {
      const valueToSet =
        typeof nextValue === "function"
          ? (nextValue as (currentValue: T) => T)(resolvedValue)
          : nextValue

      if (!isControlled) {
        setUncontrolledValue(valueToSet)
      }

      if (!Object.is(resolvedValue, valueToSet)) {
        onChange?.(valueToSet)
      }
    },
    [isControlled, onChange, resolvedValue],
  )

  return [resolvedValue, setValue] as const
}
