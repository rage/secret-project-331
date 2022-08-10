import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { NewExam, OrgExam } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import CheckBox from "../../shared-module/components/InputFields/CheckBox"
import DateTimeLocal from "../../shared-module/components/InputFields/DateTimeLocal"
import SelectField from "../../shared-module/components/InputFields/SelectField"
import TextField from "../../shared-module/components/InputFields/TextField"
import { dateToDateTimeLocalString } from "../../shared-module/utils/time"

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
  startsAt: Date
  endsAt: Date
  timeMinutes: number
  parentId: string | null
}

const NewExamForm: React.FC<React.PropsWithChildren<NewExamFormProps>> = ({
  initialData,
  organizationId,
  exams,
  onCreateNewExam,
  onDuplicateExam,
  onCancel,
}) => {
  const { t } = useTranslation()

  const {
    register,
    handleSubmit,
    formState: { errors },
    clearErrors,
    setValue,
    getValues,
  } = useForm<NewExamFields>()

  const [exam, setExam] = useState(initialData)
  const [parentId, setParentId] = useState<string | null>(null)
  const [duplicateExam, setDuplicateExam] = useState(false)

  const onCreateNewExamWrapper = handleSubmit((data) => {
    onCreateNewExam({
      organization_id: organizationId,
      name: data.name,
      starts_at: new Date(data.startsAt),
      ends_at: new Date(data.endsAt),
      time_minutes: Number(data.timeMinutes),
    })
  })

  const onDuplicateExamWrapper = handleSubmit((data) => {
    if (exam) {
      const newExam: NewExam = {
        organization_id: organizationId,
        name: data.name,
        starts_at: new Date(data.startsAt),
        ends_at: new Date(data.endsAt),
        time_minutes: Number(data.timeMinutes),
      }
      const examId = String(parentId)
      onDuplicateExam(examId, newExam)
    }
  })

  const handleSetExamToDuplicate = (examId: string) => {
    clearErrors()
    setParentId(examId)
    const exam = exams.filter((e) => e.id === examId)[0]
    setExam(exam)
    if (getValues("timeMinutes").toString() === "") {
      setValue("timeMinutes", exam.time_minutes)
    }
  }

  return (
    <div>
      <form onSubmit={duplicateExam ? onDuplicateExamWrapper : onCreateNewExamWrapper}>
        <TextField
          id={"name"}
          error={errors.name?.message}
          label={t("label-name")}
          register={register("name", { required: t("required-field") })}
        />
        <DateTimeLocal
          error={errors.startsAt?.message}
          defaultValue={
            initialData?.starts_at ? dateToDateTimeLocalString(initialData?.starts_at) : undefined
          }
          label={t("label-starts-at")}
          register={register("startsAt", { required: t("required-field") })}
        />
        <DateTimeLocal
          error={errors.endsAt?.message}
          defaultValue={
            initialData?.ends_at ? dateToDateTimeLocalString(initialData?.ends_at) : undefined
          }
          label={t("label-ends-at")}
          register={register("endsAt", { required: t("required-field") })}
        />
        <TextField
          id={"timeMinutes"}
          error={errors.timeMinutes?.message}
          label={t("label-time-minutes")}
          register={register("timeMinutes", {
            required: t("required-field"),
          })}
        />
        <br />
        <CheckBox
          checked={duplicateExam}
          label={t("duplicate")}
          onChange={() => setDuplicateExam(!duplicateExam)}
        />
        {duplicateExam && (
          <SelectField
            id={"parentId"}
            onChange={(value) => handleSetExamToDuplicate(value)}
            options={exams.map((e) => {
              return { label: e.name, value: e.id }
            })}
            defaultValue={exams[0].id}
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

export default NewExamForm
