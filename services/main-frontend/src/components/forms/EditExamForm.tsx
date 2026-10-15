"use client"

import { css } from "@emotion/css"
import { parseISO } from "date-fns"
import type { TFunction } from "i18next"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { Exam, NewExam } from "@/generated/api/types.generated"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"
import { Checkbox, DateTimeLocalField, TextField } from "@/shared-module/components"

// Shared with EditExamDialog.tsx, whose footer submit button targets this form by id.
export const EDIT_EXAM_FORM_ID = "edit-exam-form"

interface EditExamFormProps {
  initialData: Exam
  organizationId: string
  onEditExam: (form: NewExam) => void
}

interface EditExamFields {
  name: string
  startsAt: string
  endsAt: string
  timeMinutes: number
  automaticCompletionEnabled: boolean
  minimumPointsTreshold: number
  gradeManually: boolean
}

const EditExamForm: React.FC<React.PropsWithChildren<EditExamFormProps>> = ({
  initialData,
  onEditExam,
  organizationId,
}) => {
  const { t } = useTranslation()

  const initialStartsAt = formatDateForDateTimeLocalInputs(initialData.starts_at)
  const initialEndsAt = formatDateForDateTimeLocalInputs(initialData.ends_at)

  const { control, handleSubmit, watch } = useForm<EditExamFields>({
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      name: initialData.name,
      startsAt: initialStartsAt ?? "",
      endsAt: initialEndsAt ?? "",
      timeMinutes: initialData.time_minutes,
      automaticCompletionEnabled: initialData.minimum_points_treshold !== 0,
      minimumPointsTreshold: initialData.minimum_points_treshold,
      gradeManually: initialData.grade_manually,
    },
  })

  const startsAt = watch("startsAt")
  const validateDates = useMemo(() => createValidateDates(t, startsAt), [t, startsAt])

  const onEditExamWrapper = handleSubmit((data) => {
    onEditExam({
      name: data.name,
      starts_at: parseISO(data.startsAt).toISOString(),
      ends_at: parseISO(data.endsAt).toISOString(),
      time_minutes: Number(data.timeMinutes),
      minimum_points_treshold: data.automaticCompletionEnabled
        ? Number(data.minimumPointsTreshold)
        : 0,
      organization_id: organizationId,
      grade_manually: data.gradeManually,
    })
  })

  const automaticEnabled = watch("automaticCompletionEnabled")

  return (
    <div>
      <form id={EDIT_EXAM_FORM_ID} onSubmit={onEditExamWrapper}>
        <div
          className={css`
            display: grid;
            gap: var(--space-4);
          `}
        >
          <TextField
            name="name"
            control={control}
            rules={{ required: t("required-field") }}
            id={"name"}
            label={t("label-name")}
          />
          <DateTimeLocalField
            name="startsAt"
            control={control}
            label={t("label-starts-at")}
            rules={{ required: t("required-field") }}
          />
          <DateTimeLocalField
            name="endsAt"
            control={control}
            label={t("label-ends-at")}
            rules={{ required: t("required-field"), validate: validateDates }}
          />
          <TextField
            name="timeMinutes"
            control={control}
            rules={{ required: t("required-field") }}
            id={"timeMinutes"}
            label={t("label-time-minutes")}
          />
          <Checkbox name="gradeManually" control={control} label={t("label-grade-exam-manually")} />
          <Checkbox
            name="automaticCompletionEnabled"
            control={control}
            label={t("label-related-courses-can-be-completed-automatically")}
          />
          {automaticEnabled && (
            <TextField
              name="minimumPointsTreshold"
              control={control}
              rules={{ required: t("required-field") }}
              id={"minimumPointsTreshold"}
              label={t("label-exam-minimum-points")}
            />
          )}
        </div>
      </form>
    </div>
  )
}
const createValidateDates = (t: TFunction, startsAt: string) => {
  return (endsAt: string): boolean | string => {
    if (parseISO(startsAt) >= parseISO(endsAt)) {
      return t("start-date-must-be-before-end-date")
    }
    return true
  }
}

export default EditExamForm
