import { useEffect } from "react"
import { useForm } from "react-hook-form"

/** Keeps a single RHF text field in sync with external wizard controller state. */
export function useWizardTextField(
  fieldName: string,
  externalValue: string,
  onExternalChange: (value: string) => void,
) {
  const { control, setValue, watch } = useForm<Record<string, string>>({
    defaultValues: { [fieldName]: externalValue },
  })

  useEffect(() => {
    setValue(fieldName, externalValue)
  }, [externalValue, fieldName, setValue])

  useEffect(() => {
    const subscription = watch((values, meta) => {
      if (meta.name === fieldName) {
        onExternalChange(values[fieldName] ?? "")
      }
    })
    return () => subscription.unsubscribe()
  }, [fieldName, onExternalChange, watch])

  return { control, fieldName }
}

import type { CourseDesignerCourseSize } from "@/generated/api/types.generated"

type SetupStepFormValues = {
  courseSize: CourseDesignerCourseSize
  startsOnMonth: string
}

/** Keeps setup-step RHF fields in sync with the wizard controller. */
export function useSetupStepFields(options: {
  courseSize: CourseDesignerCourseSize
  startsOnMonth: string
  onCourseSizeChange: (value: CourseDesignerCourseSize) => void
  onStartsOnMonthChange: (value: string) => void
}) {
  const { courseSize, startsOnMonth, onCourseSizeChange, onStartsOnMonthChange } = options
  const { control, setValue, watch } = useForm<SetupStepFormValues>({
    defaultValues: { courseSize, startsOnMonth },
  })

  useEffect(() => {
    setValue("courseSize", courseSize)
  }, [courseSize, setValue])

  useEffect(() => {
    setValue("startsOnMonth", startsOnMonth)
  }, [setValue, startsOnMonth])

  useEffect(() => {
    const subscription = watch((formValues, meta) => {
      if (meta.name === "courseSize" && formValues.courseSize) {
        onCourseSizeChange(formValues.courseSize)
      }
      if (meta.name === "startsOnMonth") {
        onStartsOnMonthChange(formValues.startsOnMonth ?? "")
      }
    })
    return () => subscription.unsubscribe()
  }, [onCourseSizeChange, onStartsOnMonthChange, watch])

  return { control }
}
