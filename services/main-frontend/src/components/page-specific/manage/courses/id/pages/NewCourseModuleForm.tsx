import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Button from "../../../../../../shared-module/components/Button"
import Checkbox from "../../../../../../shared-module/components/InputFields/CheckBox"
import SelectField from "../../../../../../shared-module/components/InputFields/SelectField"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"
import { baseTheme } from "../../../../../../shared-module/styles"

interface Props {
  chapters: Array<number>
  onSubmitForm: (fields: Fields) => void
}

export interface Fields {
  name: string
  starts: number
  ends: number
  ects_credits: number | null
  uh_course_code: string | null
  automatic_completion: boolean
  automatic_completion_number_of_points_treshold: number | null
  automatic_completion_number_of_exercises_attempted_treshold: number | null
  override_completion_link: boolean
  completion_registration_link_override: string
}

const NewCourseModuleForm: React.FC<Props> = ({ chapters, onSubmitForm }) => {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    reset,
    watch,
  } = useForm<Fields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      name: "",
      starts: chapters.length > 0 ? chapters[0] : 1,
      ends: chapters.length > 0 ? chapters[chapters.length - 1] : 1,
      ects_credits: null,
      automatic_completion: false,
      uh_course_code: "",
      automatic_completion_number_of_points_treshold: null,
      automatic_completion_number_of_exercises_attempted_treshold: null,
    },
  })

  const onSubmitFormWrapper = (fields: Fields) => {
    onSubmitForm(fields)
    reset()
  }

  const isChecked = watch("automatic_completion")

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
      <div>
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
        </div>
        <div
          className={css`
            background: #f5f6f7;
            padding: 1rem 1.4rem;
          `}
        >
          <span
            className={css`
              margin-bottom: 0.6rem;
              display: inline-block;
              font-size: 18px;
              color: ${baseTheme.colors.grey[700]};
            `}
          >
            {t("configure-completion-requirements")}
          </span>
          <div
            className={css`
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              grid-template-areas:
                "a b"
                "c c"
                "d e"
                "f g";
              column-gap: 10px;
            `}
          >
            <TextField
              className={css`
                grid-area: a;
              `}
              label={t("course-code")}
              placeholder={t("course-code")}
              register={register("uh_course_code")}
              error={errors["name"]?.message}
            />
            <TextField
              className={css`
                grid-area: b;
              `}
              label={t("ects-credits")}
              placeholder={t("ects-credits")}
              type="number"
              register={register("ects_credits", { valueAsNumber: true })}
            />
            <Checkbox
              label={t("enable-automatic-completion")}
              register={register("automatic_completion")}
              className={css`
                grid-area: c;
              `}
            />
            <TextField
              className={css`
                grid-area: d;
              `}
              label={t("automatic-completion-exercise-points-treshold")}
              placeholder={t("automatic-completion-exercise-points-treshold")}
              type="number"
              register={register("automatic_completion_number_of_points_treshold", {
                valueAsNumber: true,
                disabled: !isChecked,
              })}
              error={errors["name"]?.message}
            />
            <TextField
              className={css`
                grid-area: e;
              `}
              label={t("automatic-completion-exercise-treshold")}
              placeholder={t("automatic-completion-exercise-treshold")}
              type="number"
              register={register("automatic_completion_number_of_exercises_attempted_treshold", {
                valueAsNumber: true,
                disabled: !isChecked,
              })}
              error={errors["name"]?.message}
            />
          </div>
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
