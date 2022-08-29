import React from "react"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import Button from "../../shared-module/components/Button"
import DatePicker from "../../shared-module/components/InputFields/DatePickerField"
import TextField from "../../shared-module/components/InputFields/TextField"

const CSV_HEADER_FORMAT = "user_id[,grade][,completion_date]"
const DATE = "date"

interface AddCompletionsFormProps {
  onSubmit: (data: unknown) => void
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
    // TODO: Parse csv before submitting
    onSubmit(data)
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
      <TextField
        error={errors.completions?.message}
        register={register("completions", { required: t("required-field") })}
      />
      <Button variant="primary" size="medium" type="submit" value={t("button-text-submit")}>
        {t("button-text-submit")}
      </Button>
    </form>
  )
}

export default AddCompletionsForm
