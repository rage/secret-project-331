import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { NewExam, OrgExam } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import CheckBox from "../../shared-module/components/InputFields/CheckBox"
import TimePicker from "../../shared-module/components/InputFields/DateTimeLocal"
import SelectMenu from "../../shared-module/components/InputFields/SelectField"
import FormField from "../FormField"

interface NewExamFormProps {
  initialData: OrgExam | null
  organization: string
  exams: OrgExam[]
  onCreateNewExam: (form: NewExam) => void
  onDuplicateExam: (parentId: string, newExam: NewExam) => void
  onCancel: () => void
}

interface NewExamFields {
  name: string
  instructions: string
  startsAt: Date
  endsAt: Date
  timeMinutes: number
  parentId: string | null
}

const NewExamForm: React.FC<NewExamFormProps> = ({
  initialData,
  organization,
  exams,
  onCreateNewExam,
  onDuplicateExam,
}) => {
  const { t } = useTranslation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewExamFields>()

  const [exam, setExam] = useState(initialData)
  const [parentId, setParentId] = useState<string | null>(null)
  const [startsAt, setStartsAt] = useState<Date | null>(null)
  const [endsAt, setEndsAt] = useState<Date | null>(null)
  const [duplicateExam, setDuplicateExam] = useState(false)

  const onCreateNewExamWrapper = handleSubmit((data) => {
    if (exam) {
      onCreateNewExam({
        id: v4(),
        organization_id: organization,
        name: data.name,
        instructions: data.instructions,
        starts_at: startsAt,
        ends_at: endsAt,
        time_minutes: Number(data.timeMinutes),
      })
    }
  })

  const onDuplicateExamWrapper = handleSubmit((data) => {
    if (exam) {
      const newExam: NewExam = {
        id: v4(),
        organization_id: organization,
        name: data.name,
        instructions: data.instructions,
        starts_at: startsAt,
        ends_at: endsAt,
        time_minutes: Number(data.timeMinutes),
      }
      const examId = String(parentId)
      onDuplicateExam(examId, newExam)
    }
  })

  const handleSetExamToDuplicate = (examId: string) => {
    setParentId(examId)
    setExam(exams.filter((e) => e.id === examId)[0])
    setStartsAt(exams.filter((e) => e.id === examId)[0].starts_at)
    setEndsAt(exams.filter((e) => e.id === examId)[0].ends_at)
  }

  return (
    <div>
      <form onSubmit={duplicateExam ? onDuplicateExamWrapper : onCreateNewExamWrapper}>
        <FormField
          id={"name"}
          error={errors["name"]}
          defaultValue={exam?.name}
          placeholder={t("text-field-label-name")}
          register={register}
        />
        <FormField
          id={"instructions"}
          error={errors["instructions"]}
          defaultValue={exam?.instructions}
          placeholder={t("text-field-label-instructions")}
          register={register}
        />
        <FormField
          id={"startsAt"}
          error={errors["startsAt"]}
          defaultValue={null}
          value={exam?.starts_at?.toISOString().slice(0, 16)}
          placeholder={t("text-field-label-starts-at")}
          register={register}
          type="datetime-local"
        />
        <FormField
          id={"endsAt"}
          error={errors.endsAt}
          defaultValue={null}
          value={exam?.ends_at?.toISOString().slice(0, 16)}
          placeholder={t("text-field-label-ends-at")}
          register={register}
          type="datetime-local"
        />
        <FormField
          id={"timeMinutes"}
          error={errors["timeMinutes"]}
          defaultValue={String(exam?.time_minutes || "")}
          placeholder={t("text-field-label-time-minutes")}
          register={register}
        />
        <br />
        <CheckBox
          checked={duplicateExam}
          label={t("main-frontend:duplicate")}
          onChange={() => setDuplicateExam(!duplicateExam)}
        />
        <br />
        {duplicateExam && (
          <SelectMenu
            id={"parentId"}
            onBlur={() => {
              // no-op
            }}
            onChange={(value) => handleSetExamToDuplicate(value)}
            options={exams.map((e) => {
              return { label: e.name, value: e.id }
            })}
            defaultValue={exams[0].id}
          />
        )}
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
