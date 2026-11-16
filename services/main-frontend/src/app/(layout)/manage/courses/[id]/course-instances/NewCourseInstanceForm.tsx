"use client"

import { css } from "@emotion/css"
import React, { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { CourseInstance, CourseInstanceForm } from "@/generated/api/types.generated"
import type { CanonicalApiIssue } from "@/shared-module/common/errors/AppApiError"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"
import { DateTimeLocalField, TextField } from "@/shared-module/components"

// Shared with NewCourseInstanceDialog.tsx, whose footer submit button targets this form by id.
export const NEW_COURSE_INSTANCE_FORM_ID = "new-course-instance-form"

interface FormProps {
  initialData: CourseInstance | null
  onSubmit: (form: CourseInstanceForm) => void
  /** Issues from a rejected save; those naming a field are shown on that field. */
  serverIssues?: CanonicalApiIssue[]
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ISSUE_PATH_TO_FIELD = {
  name: "name",
  description: "description",
  support_email: "supportEmail",
  teacher_in_charge_name: "teacherName",
  teacher_in_charge_email: "teacherEmail",
  opening_time: "openingTime",
  closing_time: "closingTime",
} as const

interface Fields {
  name: string
  description: string
  supportEmail: string
  teacherName: string
  teacherEmail: string
  openingTime: string
  closingTime: string
}

const NewCourseInstanceForm: React.FC<React.PropsWithChildren<FormProps>> = ({
  initialData,
  onSubmit,
  serverIssues,
}) => {
  const { t } = useTranslation()
  const { control, handleSubmit, setError } = useForm<Fields>({
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      supportEmail: initialData?.support_email || "",
      teacherName: initialData?.teacher_in_charge_name || "",
      teacherEmail: initialData?.teacher_in_charge_email || "",
      openingTime: formatDateForDateTimeLocalInputs(initialData?.starts_at) ?? "",
      closingTime: formatDateForDateTimeLocalInputs(initialData?.ends_at) ?? "",
    },
  })
  useEffect(() => {
    for (const issue of serverIssues ?? []) {
      const field = Object.entries(ISSUE_PATH_TO_FIELD).find(([path]) => issue.path === path)?.[1]
      if (field) {
        setError(field, { type: "server", message: issue.message })
      }
    }
  }, [serverIssues, setError])

  const onSubmitWrapper = handleSubmit((data) => {
    onSubmit({
      name: data.name || null,
      description: data.description || null,
      support_email: data.supportEmail || null,
      teacher_in_charge_name: data.teacherName,
      teacher_in_charge_email: data.teacherEmail,
      opening_time: data.openingTime ? new Date(data.openingTime).toISOString() : null,
      closing_time: data.closingTime ? new Date(data.closingTime).toISOString() : null,
    })
  })

  return (
    <form id={NEW_COURSE_INSTANCE_FORM_ID} onSubmit={onSubmitWrapper}>
      <div
        className={css`
          display: grid;
          gap: var(--space-4);
        `}
      >
        <TextField name="name" control={control} label={t("text-field-label-name")} />
        <TextField name="description" control={control} label={t("text-field-label-description")} />
        <TextField
          name="supportEmail"
          control={control}
          label={t("support-email")}
          rules={{
            pattern: { value: EMAIL_PATTERN, message: t("enter-a-valid-email") },
          }}
        />
        <TextField name="teacherName" control={control} label={t("teacher-in-charge-name")} />
        <TextField
          name="teacherEmail"
          control={control}
          label={t("teacher-in-charge-email")}
          rules={{
            pattern: { value: EMAIL_PATTERN, message: t("enter-a-valid-email") },
          }}
        />
        <DateTimeLocalField
          name="openingTime"
          control={control}
          data-testid="course-instance-opening-time-field"
          label={t("opening-time")}
        />
        <DateTimeLocalField
          name="closingTime"
          control={control}
          data-testid="course-instance-closing-time-field"
          label={t("closing-time")}
        />
      </div>
    </form>
  )
}

export default NewCourseInstanceForm
