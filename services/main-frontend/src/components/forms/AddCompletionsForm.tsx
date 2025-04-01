import styled from "@emotion/styled"
import Papa from "papaparse"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { CourseModule, TeacherManualCompletionRequest } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import DatePicker from "@/shared-module/common/components/InputFields/DatePickerField"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import { baseTheme } from "@/shared-module/common/styles"
import { makeDateStringTimezoneErrorsLessLikely } from "@/shared-module/common/utils/dateUtil"

const FormatInstructions = styled.div`
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  padding: 1.5rem;
  border: 1px solid ${baseTheme.colors.green[200]};
  border-radius: 4px;
  background-color: rgb(249 255 251);
`

const FormatTitle = styled.p`
  font-weight: bold;
  margin-bottom: 0.75rem;
  color: ${baseTheme.colors.gray[700]};
`

const ColumnList = styled.ul`
  margin-left: 1.5rem;
  margin-top: 0.5rem;
  margin-bottom: 1rem;
`

const ExampleTitle = styled.p`
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: ${baseTheme.colors.gray[700]};
`

// eslint-disable-next-line i18next/no-literal-string
const CodeExample = styled.pre`
  background-color: ${baseTheme.colors.clear[200]};
  padding: 0.75rem;
  border-radius: 4px;
  margin-top: 0.5rem;
  font-family: monospace;
  overflow-x: auto;
`

const Note = styled.p`
  margin-top: 1rem;
  font-size: 0.9em;
  font-style: italic;
  color: ${baseTheme.colors.gray[600]};
`

const ErrorMessage = styled.p`
  color: ${baseTheme.colors.red[600]};
  margin-bottom: 0.5rem;
`

const COMPLETIONS = "completions"
const CSV_HEADER_FORMAT = "user_id,grade[,completion_date]"
const DATE = "date"

const CSV_EXAMPLE = `user_id,grade,completion_date
00000000-0000-0000-0000-000000000000,5,2024-03-15
00000000-0000-0000-0000-000000000001,pass,2024-03-16`

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
        throw new Error(t("header-missing-or-invalid"))
      }
      requiredHeaders.forEach((header) => {
        if (!parsed.meta.fields?.includes(header)) {
          if (header === FIELD_NAME_USER_ID) {
            throw new Error(t("header-missing-or-invalid"))
          }
          if (header === FIELD_NAME_GRADE) {
            throw new Error(t("header-missing-or-invalid"))
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
          throw new Error(t("header-missing-or-invalid"))
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

      <p>{t("label-csv-completion-date")}</p>
      <DatePicker label={DATE} onChangeByValue={(value) => setDate(value)} />

      <FormatInstructions>
        <FormatTitle>{t("label-csv-completions-format")}</FormatTitle>
        <p>{t("label-csv-completions-header")}</p>
        <ColumnList>
          <li>{t("label-csv-completions-user-id")}</li>
          <li>{t("label-csv-completions-grade")}</li>
          <li>{t("label-csv-completions-date-optional")}</li>
        </ColumnList>
        <ExampleTitle>{t("label-csv-completions-example")}</ExampleTitle>
        <CodeExample>{CSV_EXAMPLE}</CodeExample>
        <Note>{t("label-csv-completions-note")}</Note>
      </FormatInstructions>

      {errors.completions?.message && <ErrorMessage>{errors.completions.message}</ErrorMessage>}
      <TextAreaField
        placeholder={CSV_HEADER_FORMAT}
        label={t("label-csv")}
        autoResize
        {...register("completions", { required: t("required-field") })}
      />
      <Button variant="primary" size="medium" type="submit" value={t("button-text-submit")}>
        {submitText ?? t("button-text-submit")}
      </Button>
    </form>
  )
}

export default AddCompletionsForm
