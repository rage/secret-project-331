import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { postCourseCompletionRequirement } from "../../../../../../services/backend/course-modules"
import Button from "../../../../../../shared-module/components/Button"
import Checkbox from "../../../../../../shared-module/components/InputFields/CheckBox"
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
  ects_credits: number | null
  uh_course_code: string
  automatic_completion: boolean
  automatic_completion_points_treshold: number | null
  automatic_completion_exercises_attempted_treshold: number | null
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

  const onSubmitFormWrapper = async (fields: Fields) => {
    if (fields.ects_credits) {
      await postCourseCompletionRequirement({
        uh_course_code: fields.uh_course_code,
        ects_credits: fields.ects_credits,
        automatic_completion: fields.automatic_completion,
        automatic_completion_points_treshold: fields.automatic_completion_points_treshold,
        automatic_completion_exercises_attempted_treshold:
          fields.automatic_completion_exercises_attempted_treshold,
      })
    }
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
            padding: 1rem;
          `}
        >
          <h5
            className={css`
              margin-bottom: 0.5rem;
            `}
          >
            {t("configure-completion-requirement")}
          </h5>
          <TextField
            label={t("course-code")}
            placeholder={t("course-code")}
            register={register("name", { required: t("required-field") })}
            error={errors["name"]?.message}
          />
          <TextField label={t("ect-credits")} placeholder={t("ect-credits")} />
          <Checkbox
            label={t("automatic-completion")}
            register={register("name", { required: t("required-field") })}
          />
          <TextField
            label={t("automatic-completion-points-treshold")}
            placeholder={t("automatic-completion-points-treshold")}
            register={register("name", { required: t("required-field") })}
            error={errors["name"]?.message}
          />
          <TextField
            label={t("automatic-completion-exercise-treshold")}
            placeholder={t("automatic-completion-exercise-treshold")}
            register={register("name", { required: t("required-field") })}
            error={errors["name"]?.message}
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
