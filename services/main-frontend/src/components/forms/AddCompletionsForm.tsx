import React from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import { TeacherManualCompletion } from "../../shared-module/bindings"
import Button from "../../shared-module/components/Button"
import DatePicker from "../../shared-module/components/InputFields/DatePickerField"
import TextAreaField from "../../shared-module/components/InputFields/TextAreaField"

const CSV_HEADER_FORMAT = "user_id[,grade][,completion_date]"
const DATE = "date"

interface AddCompletionsFormProps {
  onSubmit: (data: TeacherManualCompletion[]) => void
}

interface AddCompletionsFields {
  date: Date
  completions: string
}

const AddCompletionsForm: React.FC<AddCompletionsFormProps> = ({ onSubmit }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddCompletionsFields>()
  const { t } = useTranslation()

  const onWrapper = handleSubmit((data) => {
    const parsed = parseCsv(data.completions)
    console.log(parsed)
    onSubmit(parsed)
  })

  return (
    <form onSubmit={onWrapper}>
      <p>{t("label-completion-date")}</p>
      <DatePicker
        label={DATE}
        onChange={() => register("date", { required: t("required-field") })}
      />
      <p>
        <Trans t={t} i18nKey="label-csv-completions">
          Format: csv with headers with fields:{" "}
          <code>{{ csvHeaderFormat: CSV_HEADER_FORMAT }}</code> - optional date in ISO format. At
          least one comma in header required, so if only user_id is given, please give header as
          user_id,
        </Trans>
      </p>
      <TextAreaField
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

interface TheBit {
  studentId: string
  grade: string | undefined
  completionDate: Date | undefined
}

function parseCsv(input: string): TeacherManualCompletion[] {
  const lines = input.split(/\n/)
  const header = lines.shift()
  if (!header) {
    // eslint-disable-next-line i18next/no-literal-string
    throw new Error("Header missing.")
  }
  const parser = headerToParser(header)
  return lines.map((line) => parser(line))
}

function headerToParser(header: string): (input: string) => TeacherManualCompletion {
  if (header.length === 0) {
    // eslint-disable-next-line i18next/no-literal-string
    throw new Error("Header missing.")
  }
  const columns = header
    .toLocaleLowerCase()
    .split(",")
    .map((x) => x.trim())
  if (columns[0] !== "user_id") {
    // eslint-disable-next-line i18next/no-literal-string
    throw new Error("Malformed header.")
  }
  if (columns.length === 1) {
    return parseToId
  } else if (columns.length === 3) {
    return parseToIdGradeAndDate
  } else if (columns[1] === "grade") {
    return parseToIdAndGrade
  } else if (columns[1] === "completion_date") {
    return parseToIdAndDate
  } else {
    // eslint-disable-next-line i18next/no-literal-string
    throw new Error("Failed to parse row.")
  }
}

function parseToId(input: string): TeacherManualCompletion {
  return { user_id: input, grade: null, completion_date: null }
}

function parseToIdAndGrade(input: string): TeacherManualCompletion {
  const asd = input.split(",")
  return { user_id: asd[0], grade: parseInt(asd[1]), completion_date: null }
}

function parseToIdAndDate(input: string): TeacherManualCompletion {
  const asd = input.split(",")
  return { user_id: asd[0], grade: null, completion_date: new Date(asd[1]) }
}

function parseToIdGradeAndDate(input: string): TeacherManualCompletion {
  const asd = input.split(",")
  return { user_id: asd[0], grade: parseInt(asd[1]), completion_date: new Date(asd[2]) }
}
