"use client"

import { css } from "@emotion/css"
import { parseISO } from "date-fns"
import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import type { NewExam, OrgExam } from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { dateToDateTimeLocalString } from "@/shared-module/common/utils/time"
import { Button, Checkbox, DateTimeLocalField, Select, TextField } from "@/shared-module/components"

interface NewExamFormProps {
  initialData: OrgExam | null
  organizationId: string
  exams: OrgExam[]
  onCreateNewExam: (form: NewExam) => void
  onDuplicateExam: (parentId: string, newExam: NewExam) => void
  onCancel: () => void
}

interface NewExamFields {
  name: string
  startsAt: string
  endsAt: string
  timeMinutes: number
  parentId: string | null
  automaticCompletionEnabled: boolean
  minimumPointsThreshold: number
  manualGradingEnabled: boolean
  duplicateExam: boolean
}

const NewExamForm: React.FC<React.PropsWithChildren<NewExamFormProps>> = ({
  initialData,
  organizationId,
  exams,
  onCreateNewExam,
  onDuplicateExam,
}) => {
  const { t } = useTranslation()
  const [startTimeWarning, setStartTimeWarning] = useState<string | null>(null)

  const { control, handleSubmit, clearErrors, watch, setValue, setError } = useForm<NewExamFields>({
    defaultValues: {
      duplicateExam: false,
      parentId: null,
      manualGradingEnabled: false,
      startsAt: initialData?.starts_at ? dateToDateTimeLocalString(initialData.starts_at) : "",
      endsAt: initialData?.ends_at ? dateToDateTimeLocalString(initialData.ends_at) : "",
    },
  })

  const startsAt = watch("startsAt")

  useEffect(() => {
    try {
      if (startsAt) {
        const start = parseISO(startsAt)
        // Check if it's a valid date
        if (!isNaN(start.getTime())) {
          const now = new Date()
          if (start < now) {
            setStartTimeWarning(t("start-time-in-past-warning"))
          } else {
            setStartTimeWarning(null)
          }
        }
      } else {
        setStartTimeWarning(null)
      }
    } catch (_e) {
      // Invalid date format, clear warning
      setStartTimeWarning(null)
    }
  }, [startsAt, t])

  const validateDates = (data: NewExamFields): boolean => {
    const start = parseISO(data.startsAt)
    const end = parseISO(data.endsAt)

    if (end <= start) {
      setError("endsAt", { message: t("end-date-must-be-after-start") })
      return false
    }

    return true
  }

  const validateForm = (data: NewExamFields): boolean => {
    let isValid = true
    clearErrors(["startsAt", "endsAt", "timeMinutes", "minimumPointsThreshold"])

    // Validate numbers
    if (isNaN(Number(data.timeMinutes))) {
      setError("timeMinutes", { message: t("invalid-number-format") })
      isValid = false
    } else if (!Number.isInteger(Number(data.timeMinutes)) || Number(data.timeMinutes) <= 0) {
      setError("timeMinutes", { message: t("time-must-be-a-positive-integer") })
      isValid = false
    }

    if (data.automaticCompletionEnabled) {
      if (isNaN(Number(data.minimumPointsThreshold))) {
        setError("minimumPointsThreshold", { message: t("invalid-number-format") })
        isValid = false
      } else if (
        !Number.isInteger(Number(data.minimumPointsThreshold)) ||
        Number(data.minimumPointsThreshold) < 0
      ) {
        setError("minimumPointsThreshold", { message: t("points-must-be-a-non-negative-integer") })
        isValid = false
      }
    }

    // Validate dates are parseable
    try {
      parseISO(data.startsAt).toISOString()
      parseISO(data.endsAt).toISOString()
    } catch (_e) {
      setError("startsAt", { message: t("invalid-date-format") })
      setError("endsAt", { message: t("invalid-date-format") })
      isValid = false
    }

    // Validate date logic
    if (isValid && !validateDates(data)) {
      isValid = false
    }

    return isValid
  }

  const onCreateNewExamWrapper = handleSubmit((data) => {
    if (!validateForm(data)) {
      return
    }

    onCreateNewExam({
      organization_id: organizationId,
      name: data.name,
      starts_at: parseISO(data.startsAt).toISOString(),
      ends_at: parseISO(data.endsAt).toISOString(),
      time_minutes: Number(data.timeMinutes),
      minimum_points_treshold: data.automaticCompletionEnabled
        ? Number(data.minimumPointsThreshold)
        : 0,
      grade_manually: data.manualGradingEnabled,
    })
  })

  const onDuplicateExamWrapper = handleSubmit((data) => {
    if (!validateForm(data)) {
      return
    }

    if (!data.parentId) {
      setError("parentId", { type: "manual", message: t("required-field") })
      return
    }

    const exam = exams.find((e) => e.id === data.parentId)
    if (!exam) {
      setError("parentId", { message: t("exam-not-found") })
      return
    }

    const newExam: NewExam = {
      organization_id: organizationId,
      name: data.name,
      starts_at: parseISO(data.startsAt).toISOString(),
      ends_at: parseISO(data.endsAt).toISOString(),
      time_minutes: Number(data.timeMinutes),
      minimum_points_treshold: data.automaticCompletionEnabled
        ? Number(data.minimumPointsThreshold)
        : 0,
      grade_manually: data.manualGradingEnabled,
    }
    onDuplicateExam(data.parentId, newExam)
  })

  const handleSetExamToDuplicate = (examId: string) => {
    clearErrors()
    const selectedExam = exams.find((e) => e.id === examId)
    if (!selectedExam) {
      setError("parentId", { message: t("exam-not-found") })
      return
    }

    setValue("parentId", examId)
  }

  const automaticEnabled = watch("automaticCompletionEnabled")
  const duplicateExam = watch("duplicateExam")

  useEffect(() => {
    if (duplicateExam) {
      if (exams[0]) {
        handleSetExamToDuplicate(exams[0].id)
      }
    } else {
      setValue("parentId", null)
      clearErrors()
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateExam])

  return (
    <div>
      <form onSubmit={duplicateExam ? onDuplicateExamWrapper : onCreateNewExamWrapper}>
        <div
          className={css`
            margin-bottom: 2rem;
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
            {...includeIf(startTimeWarning !== null, { notice: startTimeWarning })}
          />
          <DateTimeLocalField
            name="endsAt"
            control={control}
            label={t("label-ends-at")}
            rules={{ required: t("required-field") }}
          />
          <TextField
            name="timeMinutes"
            control={control}
            rules={{
              required: t("required-field"),
              min: { value: 1, message: t("time-must-be-positive") },
            }}
            id={"timeMinutes"}
            label={t("label-time-minutes")}
            type="number"
          />
          <Checkbox
            name="manualGradingEnabled"
            control={control}
            label={t("label-grade-exam-manually")}
          />
          <Checkbox
            name="automaticCompletionEnabled"
            control={control}
            label={t("label-related-courses-can-be-completed-automatically")}
          />

          {automaticEnabled && (
            <TextField
              name="minimumPointsThreshold"
              control={control}
              rules={{
                required: t("required-field"),
                min: { value: 0, message: t("points-must-be-non-negative") },
              }}
              id={"minimumPointsThreshold"}
              label={t("label-exam-minimum-points")}
              type="number"
            />
          )}

          <Checkbox name="duplicateExam" control={control} label={t("duplicate")} />
          {duplicateExam && exams.length > 0 && (
            <Select
              name="parentId"
              control={control}
              rules={{ required: t("required-field") }}
              id={"parentId"}
              label={t("exam-to-duplicate")}
              options={exams.map((e) => ({
                label: e.name,
                value: e.id,
              }))}
            />
          )}
        </div>

        <Button
          variant="primary"
          size="medium"
          type="submit"
          className={css`
            width: 100%;
          `}
        >
          {t("button-text-submit")}
        </Button>
      </form>
    </div>
  )
}

export default NewExamForm
