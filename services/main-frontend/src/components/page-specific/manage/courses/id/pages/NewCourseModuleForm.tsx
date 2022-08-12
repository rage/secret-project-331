import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Button from "../../../../../../shared-module/components/Button"
import SelectField from "../../../../../../shared-module/components/InputFields/SelectField"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"

interface Props {
  chapters: Array<number>
  onSubmitForm: (fields: Fields) => void
}

interface Fields {
  name: string
  starts: number
  ends: number
}

const NewCourseModuleForm: React.FC<Props> = ({ chapters, onSubmitForm }) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    reset,
  } = useForm<Fields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      name: "",
      starts: chapters.length > 0 ? chapters[0] : 1,
      ends: chapters.length > 0 ? chapters[chapters.length - 1] : 1,
    },
  })

  const onSubmitFormWrapper = (fields: Fields) => {
    onSubmitForm(fields)
    reset()
  }

  return (
    <form
      className={css`
        min-width: 60%;
        padding: 2rem;
        border: 0.1rem solid rgba(205, 205, 205, 0.8);
        margin-bottom: 2rem;
      `}
      onSubmit={handleSubmit(onSubmitFormWrapper)}
    >
      <TextField
        label={t("create-module")}
        placeholder={t("name-of-module")}
        register={register("name", { required: t("required-field") })}
        error={errors["name"]?.message}
      />
      <div>{t("select-module-start-end-chapters")}</div>
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
          flex-direction: row;
          justify-content: space-between;
        `}
      >
        <div
          className={css`
            display: flex;
            flex-direction: row;
            align-items: center;
          `}
        >
          <SelectField
            className={css`
              min-width: 5rem;
              margin-right: 1rem;
            `}
            id="new-module-start"
            label={t("starts")}
            options={chapters.map((c) => {
              return { value: c.toString(), label: c.toString() }
            })}
            register={register("starts", { required: t("required-field"), valueAsNumber: true })}
            error={errors["starts"]?.message}
          />
          <SelectField
            className={css`
              min-width: 5rem;
            `}
            id="new-module-ends"
            label={t("ends")}
            options={chapters.map((c) => {
              return { value: c.toString(), label: c.toString() }
            })}
            register={register("ends", { required: t("required-field"), valueAsNumber: true })}
            error={errors["ends"]?.message}
          />
        </div>
        <div
          className={css`
            display: flex;
            flex-direction: row;
            justify-content: end;
          `}
        >
          <Button
            className={css`
              max-height: 3rem;
              align-self: flex-end;
              margin: 1rem;
            `}
            size="medium"
            variant="tertiary"
            disabled={!isValid || isSubmitting}
          >
            {t("confirm")}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default NewCourseModuleForm
