import { parseISO } from "date-fns"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Exam, NewExam } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import DateTimeLocal from "@/shared-module/common/components/InputFields/DateTimeLocal"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { formatDateForDateTimeLocalInputs } from "@/shared-module/common/utils/time"

interface EditExamFormProps {
  initialData: Exam
  organizationId: string
  onEditExam: (form: NewExam) => void
  onCancel: () => void
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
  onCancel,
  organizationId,
}) => {
  const { t } = useTranslation()

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<EditExamFields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      name: initialData.name,
      startsAt: formatDateForDateTimeLocalInputs(initialData.starts_at),
      endsAt: formatDateForDateTimeLocalInputs(initialData.ends_at),
      timeMinutes: initialData.time_minutes,
      automaticCompletionEnabled: initialData.minimum_points_treshold !== 0,
      minimumPointsTreshold: initialData.minimum_points_treshold,
      gradeManually: initialData.grade_manually,
    },
  })

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
      <form onSubmit={onEditExamWrapper}>
        <TextField
          id={"name"}
          error={errors.name?.message}
          label={t("label-name")}
          {...register("name", { required: t("required-field") })}
        />
        <DateTimeLocal
          error={errors.startsAt?.message}
          label={t("label-starts-at")}
          {...register("startsAt", { required: t("required-field") })}
        />
        <DateTimeLocal
          error={errors.endsAt?.message}
          label={t("label-ends-at")}
          {...register("endsAt", { required: t("required-field") })}
        />
        <TextField
          id={"timeMinutes"}
          error={errors.timeMinutes?.message}
          label={t("label-time-minutes")}
          {...register("timeMinutes", { required: t("required-field") })}
        />
        <CheckBox label={t("label-grade-exam-manually")} {...register("gradeManually")} />
        <CheckBox
          label={t("label-related-courses-can-be-completed-automatically")}
          {...register("automaticCompletionEnabled")}
        />
        {automaticEnabled && (
          <TextField
            id={"minimumPointsTreshold"}
            error={errors.timeMinutes?.message}
            label={t("label-exam-minimum-points")}
            {...register("minimumPointsTreshold", { required: t("required-field") })}
          />
        )}
        <br />
        <Button variant="primary" size="medium" type="submit" value={t("button-text-submit")}>
          {t("button-text-submit")}
        </Button>
        <Button variant="secondary" size="medium" type="button" onClick={onCancel}>
          {t("button-text-close")}
        </Button>
      </form>
    </div>
  )
}

export default EditExamForm
