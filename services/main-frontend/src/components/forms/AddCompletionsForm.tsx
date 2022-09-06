import Papa from "papaparse"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import { CourseModule, TeacherManualCompletionRequest } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import DatePicker from "../../shared-module/components/InputFields/DatePickerField"
import SelectField from "../../shared-module/components/InputFields/SelectField"
import TextAreaField from "../../shared-module/components/InputFields/TextAreaField"

const COMPLETIONS = "completions"
const CSV_HEADER_FORMAT = "user_id[,grade][,completion_date]"
const DATE = "date"

interface AddCompletionsFormProps {
  courseModules: Array<CourseModule>
  onSubmit: (data: TeacherManualCompletionRequest) => void
}

interface AddCompletionsFields {
  completions: string
  course_module_id: string
}

interface RawTeacherManualCompletion {
  user_id: string
  grade: string
  completion_date: string
}

const AddCompletionsForm: React.FC<AddCompletionsFormProps> = ({ courseModules, onSubmit }) => {
  const {
    clearErrors,
    handleSubmit,
    register,
    setError,
    formState: { errors },
  } = useForm<AddCompletionsFields>()
  const [date, setDate] = useState<string | null>(null)
  const { t } = useTranslation()

  const onWrapper = handleSubmit((data) => {
    clearErrors()
    const parsed = Papa.parse(data.completions.trim(), {
      delimiter: ",",
      header: true,
      skipEmptyLines: true,
      transform: (value) => value.trim(),
      transformHeader: (header) => header.trim().toLocaleLowerCase(),
    })
    if (parsed.errors.length > 0) {
      setError(COMPLETIONS, { message: parsed.errors[0].message })
    }
    const defaultDate = date ? new Date(date) : null
    const newCompletions = parsed.data.map((entry) => {
      const completionDate = (entry as RawTeacherManualCompletion).completion_date
      const grade = (entry as RawTeacherManualCompletion).grade
      const userId = (entry as RawTeacherManualCompletion).user_id
      if (!userId) {
        throw new Error(t("user-id-is-missing"))
      }
      return {
        completion_date: completionDate ? new Date(completionDate) : defaultDate,
        grade: grade ? parseInt(grade) : null,
        user_id: userId,
      }
    })
    onSubmit({ course_module_id: data.course_module_id, new_completions: newCompletions })
  })

  return (
    <form onSubmit={onWrapper}>
      <p>{t("label-course-module")}</p>
      <SelectField
        id="select-course-module"
        options={courseModules.map((x) => ({
          value: x.id,
          label: x.name ?? t("label-default"),
        }))}
        register={register("course_module_id", { required: t("required-field") })}
      />
      <p>{t("label-completion-date")}</p>
      <DatePicker label={DATE} onChange={(value) => setDate(value)} />
      <p>
        <Trans t={t} i18nKey="label-csv-completions">
          Format: csv with headers with fields:{" "}
          <code>{{ csvHeaderFormat: CSV_HEADER_FORMAT }}</code> - optional date in ISO format.
        </Trans>
      </p>
      <TextAreaField
        placeholder={CSV_HEADER_FORMAT}
        errorMessage={errors.completions?.message}
        register={register("completions", { required: t("required-field") })}
      />
      <Button variant="primary" size="medium" type="submit" value={t("button-text-submit")}>
        {t("button-text-submit")}
      </Button>
    </form>
  )
}

export default AddCompletionsForm
