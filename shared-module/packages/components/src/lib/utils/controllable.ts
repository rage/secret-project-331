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
  const resolvedValueRef = React.useRef(resolvedValue)
  const isControlledRef = React.useRef(isControlled)
  const onChangeRef = React.useRef(onChange)

  React.useEffect(() => {
    resolvedValueRef.current = resolvedValue
  }, [resolvedValue])

  React.useEffect(() => {
    isControlledRef.current = isControlled
  }, [isControlled])

  React.useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const setValue = React.useCallback((nextValue: SetValueAction<T>) => {
    const currentValue = resolvedValueRef.current
    const valueToSet =
      typeof nextValue === "function"
        ? (nextValue as (currentValue: T) => T)(currentValue)
        : nextValue

    if (!isControlledRef.current) {
      setUncontrolledValue(valueToSet)
    }

    if (!Object.is(currentValue, valueToSet)) {
      onChangeRef.current?.(valueToSet)
    }
  }, [])

  return [resolvedValue, setValue] as const
}
