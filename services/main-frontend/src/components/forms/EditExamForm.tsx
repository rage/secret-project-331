import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { Exam, NewExam } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import CheckBox from "../../shared-module/components/InputFields/CheckBox"
import DateTimeLocal from "../../shared-module/components/InputFields/DateTimeLocal"
import TextField from "../../shared-module/components/InputFields/TextField"
import { dateToDateTimeLocalString } from "../../shared-module/utils/time"

interface EditExamFormProps {
  initialData: Exam
  organizationId: string
  onEditExam: (form: NewExam) => void
  onCancel: () => void
}

interface EditExamFields {
  id: string
  name: string
  startsAt: Date
  endsAt: Date
  timeMinutes: number
  parentId: string | null
  automaticCompletionEnabled: boolean
  minimumPointsTreshold: number
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
  } = useForm<EditExamFields>()

  const onEditExamWrapper = handleSubmit((data) => {
    onEditExam({
      name: data.name,
      starts_at: new Date(data.startsAt).toISOString(),
      ends_at: new Date(data.endsAt).toISOString(),
      time_minutes: Number(data.timeMinutes),
      minimum_points_treshold: data.automaticCompletionEnabled
        ? Number(data.minimumPointsTreshold)
        : 0,
      organization_id: organizationId,
    })
  })

  const automaticEnabled = watch("automaticCompletionEnabled")

  return (
    <div>
      <form onSubmit={onEditExamWrapper}>
        <TextField
          id={"name"}
          error={errors.name?.message}
          defaultValue={initialData?.name}
          label={t("label-name")}
          {...register("name", { required: t("required-field") })}
        />
        <DateTimeLocal
          error={errors.startsAt?.message}
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
          defaultValue={initialData?.time_minutes}
          label={t("label-time-minutes")}
          {...register("timeMinutes", { required: t("required-field") })}
        />
        <CheckBox
          label={t("label-related-courses-can-be-completed-automatically")}
          {...register("automaticCompletionEnabled")}
        />
        {automaticEnabled && (
          <TextField
            id={"minimumPointsTreshold"}
            error={errors.timeMinutes?.message}
            defaultValue={initialData?.minimum_points_treshold}
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
