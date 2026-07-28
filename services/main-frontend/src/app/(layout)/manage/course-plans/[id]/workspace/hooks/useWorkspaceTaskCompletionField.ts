import { useEffect } from "react"
import { useForm } from "react-hook-form"

/** Syncs task completion checkbox form state with server value and dispatches toggles. */
export function useWorkspaceTaskCompletionField(
  isCompleted: boolean,
  onToggle: (is_completed: boolean) => void,
) {
  const { control, setValue, watch } = useForm<{ isCompleted: boolean }>({
    defaultValues: { isCompleted },
  })

  useEffect(() => {
    setValue("isCompleted", isCompleted)
  }, [isCompleted, setValue])

  useEffect(() => {
    const subscription = watch((values, meta) => {
      if (meta.name !== "isCompleted") {
        return
      }
      if (values.isCompleted !== isCompleted) {
        onToggle(Boolean(values.isCompleted))
      }
    })
    return () => subscription.unsubscribe()
  }, [isCompleted, onToggle, watch])

  return { control }
}
