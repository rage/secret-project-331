import { css } from "@emotion/css"
import { parseISO } from "date-fns"
import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { NewExam, OrgExam } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import DateTimeLocal from "@/shared-module/common/components/InputFields/DateTimeLocal"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { dateToDateTimeLocalString } from "@/shared-module/common/utils/time"

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

  const {
    register,
    handleSubmit,
    formState: { errors },
    clearErrors,
    watch,
    setError,
  } = useForm<NewExamFields>()

  const [exam, setExam] = useState(initialData)
  const [parentId, setParentId] = useState<string | null>(null)
  const [duplicateExam, setDuplicateExam] = useState(false)

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

    if (duplicateExam && !parentId) {
      setError("parentId", { type: "manual", message: t("required-field") })
      return
    }

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
    const examId = String(parentId)
    onDuplicateExam(examId, newExam)
  })

  const handleSetExamToDuplicate = (examId: string) => {
    clearErrors()
    const selectedExam = exams.find((e) => e.id === examId)
    if (!selectedExam) {
      setError("parentId", { message: t("exam-not-found") })
      return
    }

    setParentId(examId)
    setExam(selectedExam)
  }

  const automaticEnabled = watch("automaticCompletionEnabled")

  const handleDuplicateToggle = () => {
    if (!duplicateExam) {
      // Switching to duplicate mode
      setDuplicateExam(true)
      if (exams.length > 0) {
        handleSetExamToDuplicate(exams[0].id)
      }
    } else {
      // Switching back to create mode
      setDuplicateExam(false)
      setParentId(null)
      setExam(null)
      clearErrors()
    }
  }

  return (
    <div>
      <form onSubmit={duplicateExam ? onDuplicateExamWrapper : onCreateNewExamWrapper}>
        <div
          className={css`
            margin-bottom: 2rem;
          `}
        >
          <TextField
            id={"name"}
            error={errors.name?.message}
            label={t("label-name")}
            {...register("name", { required: t("required-field") })}
          />
          <DateTimeLocal
            error={errors.startsAt?.message}
            warning={startTimeWarning ?? undefined}
            defaultValue={
              initialData?.starts_at ? dateToDateTimeLocalString(initialData?.starts_at) : undefined
            }
            label={t("label-starts-at")}
            {...register("startsAt", { required: t("required-field") })}
          />
          <DateTimeLocal
            error={errors.endsAt?.message}
            defaultValue={
              initialData?.ends_at ? dateToDateTimeLocalString(initialData?.ends_at) : undefined
            }
            label={t("label-ends-at")}
            {...register("endsAt", { required: t("required-field") })}
          />
          <TextField
            id={"timeMinutes"}
            error={errors.timeMinutes?.message}
            label={t("label-time-minutes")}
            type="number"
            {...register("timeMinutes", {
              required: t("required-field"),
              min: { value: 1, message: t("time-must-be-positive") },
              valueAsNumber: true,
            })}
          />
          <CheckBox label={t("label-grade-exam-manually")} {...register("manualGradingEnabled")} />
          <CheckBox
            label={t("label-related-courses-can-be-completed-automatically")}
            {...register("automaticCompletionEnabled")}
          />

          {automaticEnabled && (
            <TextField
              id={"minimumPointsThreshold"}
              error={errors.minimumPointsThreshold?.message}
              label={t("label-exam-minimum-points")}
              type="number"
              {...register("minimumPointsThreshold", {
                required: t("required-field"),
                min: { value: 0, message: t("points-must-be-non-negative") },
                valueAsNumber: true,
              })}
            />
          )}

          <CheckBox
            checked={duplicateExam}
            label={t("duplicate")}
            onChange={handleDuplicateToggle}
          />
          {duplicateExam && exams.length > 0 && (
            <SelectField
              id={"parentId"}
              error={errors.parentId?.message}
              onChangeByValue={(value) => handleSetExamToDuplicate(value)}
              options={exams.map((e) => ({
                label: e.name,
                value: e.id,
              }))}
              defaultValue={exams[0].id}
            />
          )}
        </div>

        <Button
          variant="primary"
          size="medium"
          type="submit"
          value={t("button-text-submit")}
          fullWidth
        >
          {t("button-text-submit")}
        </Button>
      </form>
    </div>
  )
}

export default NewExamForm
