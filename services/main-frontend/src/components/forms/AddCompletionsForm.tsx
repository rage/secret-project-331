import Papa from "papaparse"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import { CourseModule, TeacherManualCompletionRequest } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import DatePicker from "@/shared-module/common/components/InputFields/DatePickerField"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import { makeDateStringTimezoneErrorsLessLikely } from "@/shared-module/common/utils/dateUtil"

const COMPLETIONS = "completions"
const CSV_HEADER_FORMAT = "user_id[,grade][,completion_date]"
const DATE = "date"

interface AddCompletionsFormProps {
  courseModules: Array<CourseModule>
  onSubmit: (data: TeacherManualCompletionRequest) => void
  /* Text shown in place of the submit button. */
  submitText?: string
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

const FIELD_NAME_USER_ID = "user_id"
const FIELD_NAME_GRADE = "grade"

const AddCompletionsForm: React.FC<AddCompletionsFormProps> = ({
  courseModules,
  onSubmit,
  submitText,
}) => {
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
    try {
      const parsed = Papa.parse(data.completions.trim(), {
        delimiter: ",",
        header: true,
        skipEmptyLines: true,
        transform: (value) => value.trim(),
        transformHeader: (header) => header.trim().toLowerCase(),
      })

      // Validate header row
      const requiredHeaders = [FIELD_NAME_USER_ID, FIELD_NAME_GRADE]
      if (!parsed.meta.fields) {
        throw new Error(t("header-missing"))
      }
      requiredHeaders.forEach((header) => {
        if (!parsed.meta.fields?.includes(header)) {
          if (header === FIELD_NAME_USER_ID) {
            throw new Error(t("header-missing-for-user_id"))
          }
          if (header === FIELD_NAME_GRADE) {
            throw new Error(t("header-missing-for-grade"))
          }
        }
      })

      if (parsed.errors.length > 0) {
        setError(COMPLETIONS, { message: parsed.errors[0].message })
        return
      }

      const defaultDate = date ? makeDateStringTimezoneErrorsLessLikely(date) : null

      const newCompletions = parsed.data.map((entry) => {
        const { user_id, grade, completion_date } = entry as RawTeacherManualCompletion

        // If a row is missing user_id, then the issue is likely with the header or the data row.
        if (!user_id) {
          throw new Error(t("header-missing-for-user_id"))
        }

        // Validate the grade field.
        let validatedGrade = null
        if (grade) {
          const numericGrade = parseInt(grade, 10)
          if (!isNaN(numericGrade)) {
            if (numericGrade < 0 || numericGrade > 5) {
              throw new Error(t("grade-out-of-range"))
            }
            validatedGrade = numericGrade
          } else {
            const gradeLower = grade.toLowerCase()
            if (gradeLower !== "pass" && gradeLower !== "fail") {
              throw new Error(t("invalid-grade-format"))
            }
            validatedGrade = gradeLower
          }
        }

        // Validate and process the completion date.
        let processedDate = null
        if (completion_date) {
          processedDate = makeDateStringTimezoneErrorsLessLikely(completion_date)
          // Optionally, add additional checks here to verify a valid date.
        } else {
          processedDate = defaultDate
        }

        return {
          user_id,
          grade: typeof validatedGrade === "string" ? null : validatedGrade,
          completion_date: processedDate,
          passed:
            validatedGrade === "pass" || (typeof validatedGrade === "number" && validatedGrade > 0),
        }
      })

      onSubmit({
        course_module_id: data.course_module_id,
        new_completions: newCompletions,
        skip_duplicate_completions: false,
      })
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(COMPLETIONS, { message: e.message })
      } else {
        setError(COMPLETIONS, { message: String(e) })
      }
    }
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
        {...register("course_module_id", { required: t("required-field") })}
        aria-label={t("select-course-module")}
      />
      <p>{t("label-completion-date")}</p>
      <DatePicker label={DATE} onChangeByValue={(value) => setDate(value)} />
      <p>
        <Trans t={t} i18nKey="label-csv-completions">
          Format: csv with headers with fields:{" "}
          <code>{{ csvHeaderFormat: CSV_HEADER_FORMAT }}</code> - optional date in ISO format.
        </Trans>
      </p>
      {errors.completions?.message && <p>{errors.completions.message}</p>}
      <TextAreaField
        placeholder={CSV_HEADER_FORMAT}
        {...register("completions", { required: t("required-field") })}
      />
      <Button variant="primary" size="medium" type="submit" value={t("button-text-submit")}>
        {submitText ?? t("button-text-submit")}
      </Button>
    </form>
  )
}

export default AddCompletionsForm
