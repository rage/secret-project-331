import { isEqual } from "lodash"
import { useEffect } from "react"
import { type FieldValues, type Path, type UseFormReturn, useForm } from "react-hook-form"

/**
 * A form that mirrors block `values` and reports user edits, with the changed field name, through `onValuesChange`.
 * Outside changes such as undo flow into the fields and are not reported back.
 */
export function useAttributeForm<T extends FieldValues>(
  values: T,
  onValuesChange: (values: T, changedName: Path<T>) => void,
): UseFormReturn<T> {
  const form = useForm<T>({ values })
  const { watch } = form

  // Re-subscribed every render so the comparison never uses stale `values`.
  useEffect(() => {
    const subscription = watch((formValues, { name }) => {
      if (name !== undefined && !isEqual(formValues, values)) {
        onValuesChange(formValues as T, name as Path<T>)
      }
    })
    return () => subscription.unsubscribe()
  })

  return form
}
