"use client"

import { css } from "@emotion/css"
import React from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"
import { Button, Checkbox, Select, TextField } from "@/shared-module/components"

interface Props {
  chapters: number[]
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
  enable_registering_completion_to_uh_open_university: boolean
}

// `Select` options carry string values, so `starts`/`ends` are strings here and converted back to
// the numbers `Fields` declares when the form submits.
type NewModuleFormValues = Omit<Fields, "starts" | "ends"> & { starts: string; ends: string }

const NewCourseModuleForm: React.FC<Props> = ({ chapters, onSubmitForm }) => {
  const { t } = useTranslation()
  const {
    control,
    handleSubmit,
    formState: { isValid, isSubmitting },
    reset,
    watch,
  } = useForm<NewModuleFormValues>({
    // oxlint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: {
      name: "",
      starts: String(chapters[0] ?? 1),
      ends: String(chapters.at(-1) ?? 1),
      ects_credits: null,
      automatic_completion: false,
      uh_course_code: "",
      automatic_completion_number_of_points_treshold: null,
      automatic_completion_number_of_exercises_attempted_treshold: null,
    },
  })

  const onSubmitFormWrapper = (fields: NewModuleFormValues) => {
    onSubmitForm({ ...fields, starts: Number(fields.starts), ends: Number(fields.ends) })
    reset()
  }

  const isChecked = watch("automatic_completion")

  return (
    <form
      className={css`
        min-width: 100%;
        padding: 1.25rem;
        background: #f7f8f9;
        border-radius: 6px;
        margin: 2rem 0;
      `}
      onSubmit={handleSubmit(onSubmitFormWrapper)}
    >
      <div>
        <TextField
          name="name"
          control={control}
          label={t("create-module")}
          rules={{ required: t("required-field") }}
        />
        <div
          className={css`
            font-size: 0.875rem;
            font-weight: 400;
            margin-bottom: 0.4rem;
          `}
        >
          {t("select-module-start-end-chapters")}
        </div>
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
              margin-bottom: 0.6rem;
            `}
          >
            <Select
              className={css`
                min-width: 5rem;
                margin-right: 1rem;
              `}
              id="new-module-start"
              name="starts"
              control={control}
              label={t("starts")}
              options={chapters.map((c) => {
                return { value: c.toString(), label: c.toString() }
              })}
              rules={{ required: t("required-field") }}
            />
            <Select
              className={css`
                min-width: 5rem;
              `}
              id="new-module-ends"
              name="ends"
              control={control}
              label={t("ends")}
              options={chapters.map((c) => {
                return { value: c.toString(), label: c.toString() }
              })}
              rules={{ required: t("required-field") }}
            />
          </div>
        </div>
        <div
          className={css`
            background: #fff;
            padding: 1rem 1.4rem;
            border-radius: 4px;
          `}
        >
          <span
            className={css`
              margin-bottom: 1rem;
              display: inline-block;
              font-weight: 500;
              font-size: 18px;
              color: ${baseTheme.colors.gray[700]};
            `}
          >
            {t("configure-completion-requirements")}
          </span>
          <div
            className={css`
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              grid-template-areas:
                "c c"
                "d e"
                "f f"
                "a b";
              column-gap: 10px;
            `}
          >
            <Checkbox
              name="automatic_completion"
              control={control}
              label={t("enable-automatic-completion")}
              className={css`
                grid-area: c;
                font-size: 15px;
              `}
            />

            <TextField
              className={css`
                grid-area: d;
              `}
              name="automatic_completion_number_of_points_treshold"
              control={control}
              label={t("automatic-completion-points-treshold")}
              type="number"
              isDisabled={!isChecked}
            />
            <TextField
              className={css`
                grid-area: e;
              `}
              name="automatic_completion_number_of_exercises_attempted_treshold"
              control={control}
              label={t("automatic-completion-exercise-treshold")}
              type="number"
              isDisabled={!isChecked}
            />
            <Checkbox
              name="enable_registering_completion_to_uh_open_university"
              control={control}
              label={t("label-enable-registering-completion-to-uh-open-university")}
              className={css`
                grid-area: f;
                font-size: 15px;
                margin-top: 0.6rem;
              `}
            />
            <TextField
              className={css`
                grid-area: a;
              `}
              name="uh_course_code"
              control={control}
              label={t("uh-course-code")}
            />
            <TextField
              className={css`
                grid-area: b;
              `}
              name="ects_credits"
              control={control}
              label={t("ects-credits")}
              type="number"
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
