import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { Exam, NewExam } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import TimePicker from "../../shared-module/components/InputFields/DateTimeLocal"
import FormField from "../FormField"

interface NewExamFormProps {
  initialData: Exam | null
  organization: string
  onSubmit: (form: NewExam) => void
  onCancel: () => void
}

interface NewExamFields {
  name: string
  instructions: string
  startsAt: Date
  endsAt: Date
  timeMinutes: number
}

const NewExamForm: React.FC<NewExamFormProps> = ({ initialData, organization, onSubmit }) => {
  const { t } = useTranslation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewExamFields>()

  const [startsAt, setStartsAt] = useState<Date | null>(null)
  const [endsAt, setEndsAt] = useState<Date | null>(null)

  const onSubmitWrapper = handleSubmit((data) => {
    onSubmit({
      id: v4(),
      organization_id: organization,
      name: data.name,
      instructions: data.instructions,
      starts_at: startsAt,
      ends_at: endsAt,
      time_minutes: Number(data.timeMinutes),
    })
  })

  return (
    <div>
      <form onSubmit={onSubmitWrapper}>
        <FormField
          id={"name"}
          error={errors["name"]}
          defaultValue={initialData?.name}
          placeholder={t("text-field-label-name")}
          register={register}
        />
        <FormField
          id={"instructions"}
          error={errors["instructions"]}
          defaultValue={initialData?.instructions}
          placeholder={t("text-field-label-instructions")}
          register={register}
        />
        <TimePicker
          placeholder={t("text-field-label-starts-at")}
          label={t("text-field-label-starts-at")}
          onChange={(time) => setStartsAt(new Date(time))}
        />
        <TimePicker
          placeholder={t("text-field-label-ends-at")}
          label={t("text-field-label-ends-at")}
          onChange={(time) => setEndsAt(new Date(time))}
        />
        <FormField
          id={"timeMinutes"}
          error={errors["timeMinutes"]}
          defaultValue={String(initialData?.time_minutes || "")}
          placeholder={t("text-field-label-time-minutes")}
          register={register}
        />
        <br />
        <br />
        <Button variant="primary" size="medium" type="submit" value={t("button-text-submit")}>
          {t("button-text-submit")}
        </Button>
      </form>
    </div>
  )
}

export default NewExamForm
