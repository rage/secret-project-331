import { css } from "@emotion/css"
import CancelIcon from "@mui/icons-material/Cancel"
import CheckIcon from "@mui/icons-material/Check"
import DeleteIcon from "@mui/icons-material/Delete"
import EditIcon from "@mui/icons-material/Edit"
import { IconButton } from "@mui/material"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Checkbox from "../../../../../../shared-module/components/InputFields/CheckBox"
import SelectField from "../../../../../../shared-module/components/InputFields/SelectField"
import TextField from "../../../../../../shared-module/components/InputFields/TextField"
import { baseTheme, theme } from "../../../../../../shared-module/styles"
import { respondToOrLarger } from "../../../../../../shared-module/styles/respond"

import { ModuleView } from "./CourseModules"

interface Props {
  module: ModuleView
  chapters: Array<number>
  onSubmitForm: (id: string, fields: Fields) => void
  onDeleteModule: (id: string) => void
}

interface Fields {
  name: string | null
  starts: number
  ends: number
  ects_credits: number | null
  uh_course_code: string | null
  automatic_completion: boolean
  automatic_completion_points_treshold: number | null
  automatic_completion_exercises_attempted_treshold: number | null
}

const EditCourseModuleForm: React.FC<Props> = ({
  module,
  chapters,
  onSubmitForm,
  onDeleteModule,
}) => {
  console.log(module)
  const { t } = useTranslation()
  const [active, setActive] = useState(false)
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
      name: module.name,
      starts: module.firstChapter ?? (chapters.length > 0 ? chapters[0] : 1),
      ends: module.lastChapter ?? (chapters.length > 0 ? chapters[chapters.length - 1] : 1),
      ects_credits: module.ects_credits ?? 0,
      uh_course_code: module.uh_course_code ?? "",
      automatic_completion: module.automatic_completion ?? false,
      automatic_completion_points_treshold: module.automatic_completion_points_treshold ?? null,
      automatic_completion_exercises_attempted_treshold:
        module.automatic_completion_exercises_attempted_treshold ?? null,
    },
  })

  const onSubmitFormWrapper = (fields: Fields) => {
    setActive(false)
    onSubmitForm(module.id, fields)
  }

  const isChecked = watch("automatic_completion")

  return (
    <form
      onSubmit={handleSubmit(onSubmitFormWrapper)}
      className={css`
        display: flex;
        flex-wrap: wrap;
        background-color: ${theme.primary.bg};
        color: ${theme.primary.text};
        align-items: center;
        margin-bottom: 0.5rem;
        justify-content: space-between;
      `}
    >
      <div
        className={css`
          text-transform: uppercase;
          font-weight: 600;
          margin: 1rem;
          flex-grow: 1;
          ${respondToOrLarger.sm} {
            max-width: 16rem;
          }
        `}
      >
        {module.name ? (
          active ? (
            <TextField
              label={t("edit-module")}
              labelStyle={css`
                color: ${baseTheme.colors.clear[100]};
              `}
              placeholder={t("name-of-module")}
              register={register("name", { required: true })}
              error={errors["name"]?.message}
            />
          ) : (
            `${module.order_number}: ${module.name}`
          )
        ) : (
          t("default-module")
        )}
      </div>
      <div
        className={css`
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          flex-grow: 1;
          justify-content: space-between;
        `}
      >
        {active ? (
          <div
            className={css`
              display: grid;
              grid-template-columns: repeat(4, minmax(5rem, 1fr));
              gap: 10px;
              margin-left: 1rem;
              margin-right: 1rem;
              margin-bottom: 1rem;
            `}
          >
            <SelectField
              className={css`
                min-width: 5rem;
              `}
              id="editing-module-start"
              label={t("starts")}
              labelStyle={css`
                color: ${baseTheme.colors.clear[100]};
              `}
              options={chapters.map((c) => {
                return { value: c.toString(), label: c.toString() }
              })}
              register={register("starts", { required: true, valueAsNumber: true })}
              error={errors["starts"]?.message}
            />
            <SelectField
              className={css`
                min-width: 5rem;
                margin-left: 1rem;
              `}
              id="editing-module-ends"
              label={t("ends")}
              labelStyle={css`
                color: ${baseTheme.colors.clear[100]};
              `}
              options={chapters.map((cn) => {
                return { value: cn.toString(), label: cn.toString() }
              })}
              register={register("ends", { required: true, valueAsNumber: true })}
              error={errors["ends"]?.message}
            />
            <TextField
              label={t("course-code")}
              placeholder={t("course-code")}
              labelStyle={css`
                color: #fff;
              `}
              register={register("uh_course_code")}
              error={errors["name"]?.message}
            />
            <TextField
              label={t("ects-credits")}
              labelStyle={css`
                color: #fff;
              `}
              placeholder={t("ects-credits")}
              register={register("ects_credits")}
            />
            <Checkbox
              label={t("enable-automatic-completion")}
              register={register("automatic_completion")}
              className={css`
                margin-top: 24px;
                label {
                  color: #fff !important;
                }
              `}
            />
            <TextField
              label={t("automatic-completion-points-treshold")}
              labelStyle={css`
                color: #fff;
              `}
              placeholder={t("automatic-completion-points-treshold")}
              type="number"
              register={register("automatic_completion_points_treshold", {
                valueAsNumber: true,
                disabled: !isChecked,
              })}
              error={errors["name"]?.message}
            />
            <TextField
              label={t("automatic-completion-exercise-treshold")}
              labelStyle={css`
                color: #fff;
              `}
              placeholder={t("automatic-completion-exercise-treshold")}
              type="number"
              register={register("automatic_completion_exercises_attempted_treshold", {
                valueAsNumber: true,
                disabled: !isChecked,
              })}
              error={errors["name"]?.message}
            />
          </div>
        ) : (
          <div></div>
        )}
        <div
          className={css`
            display: flex;
            align-items: flex-end;
          `}
        >
          {active ? (
            <>
              <IconButton
                aria-label={t("button-text-save")}
                className={css`
                  background-color: ${baseTheme.colors.green[400]};
                  border-radius: 0;
                  height: 3.5rem;
                  width: 3.5rem;
                `}
                disabled={!isValid || isSubmitting}
                type={"submit"}
              >
                <CheckIcon />
              </IconButton>
              <IconButton
                aria-label={t("button-text-cancel")}
                className={css`
                  background-color: ${baseTheme.colors.green[400]};
                  border-radius: 0;
                  height: 3.5rem;
                  width: 3.5rem;
                `}
                onClick={() => {
                  setActive(false)
                  reset()
                }}
                disabled={isSubmitting}
              >
                <CancelIcon />
              </IconButton>
            </>
          ) : (
            <IconButton
              aria-label={t("edit")}
              className={css`
                background-color: ${baseTheme.colors.green[400]};
                border-radius: 0;
                height: 3.5rem;
                width: 3.5rem;
              `}
              onClick={() => setActive(true)}
            >
              <EditIcon />
            </IconButton>
          )}
          {module.name !== null && (
            <IconButton
              aria-label={t("button-text-delete")}
              className={css`
                background-color: ${baseTheme.colors.green[300]};
                border-radius: 0;
                height: 3.5rem;
                width: 3.5rem;
              `}
              onClick={() => onDeleteModule(module.id)}
              disabled={isSubmitting}
            >
              <DeleteIcon />
            </IconButton>
          )}
        </div>
      </div>
    </form>
  )
}

export default EditCourseModuleForm
