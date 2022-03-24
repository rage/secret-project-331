import { css } from "@emotion/css"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { NewExam, OrgExam } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import CheckBox from "../../shared-module/components/InputFields/CheckBox"
import SelectMenu from "../../shared-module/components/InputFields/SelectField"
import { dateToString } from "../../shared-module/utils/time"
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
    onCreateNewExam({
      id: v4(),
      organization_id: organization,
      name: data.name,
      starts_at: new Date(data.startsAt),
      ends_at: new Date(data.endsAt),
      time_minutes: Number(data.timeMinutes),
    })
  })

  const onDuplicateExamWrapper = handleSubmit((data) => {
    if (exam) {
      const newExam: NewExam = {
        id: v4(),
        organization_id: organization,
        name: data.name,
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
      <form
        onSubmit={duplicateExam ? onDuplicateExamWrapper : onCreateNewExamWrapper}
        className={css`
          width: 15rem;
        `}
      >
        <FormField
          id={"name"}
          error={errors["name"]}
          defaultValue={exam?.name}
          placeholder={t("label-name")}
          register={register}
        />
        <FormField
          id={"startsAt"}
          error={errors["startsAt"]}
          defaultValue={null}
          value={exam?.starts_at?.toISOString().slice(0, 16)}
          placeholder={t("label-starts-at")}
          register={register}
          type="datetime-local"
        />
        <FormField
          id={"endsAt"}
          error={errors.endsAt}
          defaultValue={null}
          value={exam?.ends_at?.toISOString().slice(0, 16)}
          placeholder={t("label-ends-at")}
          register={register}
          type="datetime-local"
        />
        <FormField
          id={"timeMinutes"}
          error={errors["timeMinutes"]}
          defaultValue={String(exam?.time_minutes || "")}
          placeholder={t("label-time-minutes")}
          register={register}
        />
        <br />
        <CheckBox
          checked={duplicateExam}
          label={t("duplicate")}
          onChange={() => setDuplicateExam(!duplicateExam)}
        />
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
        <Button variant="primary" size="medium" type="submit" value={t("button-text-submit")}>
          {t("button-text-submit")}
        </Button>
      </form>
    </div>
  )
}

export default NewExamForm
