import { css } from "@emotion/css"
import CancelIcon from "@mui/icons-material/Cancel"
import CheckIcon from "@mui/icons-material/Check"
import DeleteIcon from "@mui/icons-material/Delete"
import EditIcon from "@mui/icons-material/Edit"
import { IconButton } from "@mui/material"
import React, { useEffect, useState } from "react"
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
  onSubmitForm: (id: string, fields: EditCourseModuleFormFields) => void
  onDeleteModule: (id: string) => void
}

export interface EditCourseModuleFormFields {
  name: string | null
  starts: number
  ends: number
  ects_credits: number | null
  uh_course_code: string | null
  automatic_completion: boolean
  automatic_completion_number_of_points_treshold: number | null
  automatic_completion_number_of_exercises_attempted_treshold: number | null
  automatic_completion_requires_exam: boolean
  override_completion_link: boolean
  completion_registration_link_override: string
  enable_registering_completion_to_uh_open_university: boolean
}

const makeDefaultValues = (module: ModuleView, chapters: number[]): EditCourseModuleFormFields => {
  return {
    name: module.name,
    starts: module.firstChapter ?? (chapters.length > 0 ? chapters[0] : 1),
    ends: module.lastChapter ?? (chapters.length > 0 ? chapters[chapters.length - 1] : 1),
    ects_credits: Number(module.ects_credits) || 0,
    uh_course_code: module.uh_course_code ?? "",
    automatic_completion: module.automatic_completion ?? false,
    automatic_completion_number_of_points_treshold:
      Number(module.automatic_completion_number_of_points_treshold) ?? null,
    automatic_completion_number_of_exercises_attempted_treshold:
      Number(module.automatic_completion_number_of_exercises_attempted_treshold) ?? null,
    automatic_completion_requires_exam: module.automatic_completion_requires_exam,
    override_completion_link: module.completion_registration_link_override !== null,
    completion_registration_link_override: module.completion_registration_link_override ?? "",
    enable_registering_completion_to_uh_open_university:
      module.enable_registering_completion_to_uh_open_university,
  }
}

const EditCourseModuleForm: React.FC<Props> = ({
  module,
  chapters,
  onSubmitForm,
  onDeleteModule,
}) => {
  const { t } = useTranslation()
  const [active, setActive] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    reset,
    watch,
  } = useForm<EditCourseModuleFormFields>({
    // eslint-disable-next-line i18next/no-literal-string
    mode: "onChange",
    defaultValues: makeDefaultValues(module, chapters),
  })
  useEffect(() => {
    reset(makeDefaultValues(module, chapters))
  }, [reset, module, chapters])

  const onSubmitFormWrapper = (fields: EditCourseModuleFormFields) => {
    setActive(false)
    onSubmitForm(module.id, fields)
  }

  const isChecked = watch("automatic_completion")
  const overrideLink = watch("override_completion_link")

  return (
    <form
      onSubmit={handleSubmit(onSubmitFormWrapper)}
      className={css`
        display: flex;
        flex-direction: row;
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
          ${active && `width: 100%;`}
        `}
      >
        {active && (
          <div
            className={css`
              margin-left: 1rem;
              margin-right: 1rem;
              margin-bottom: 1rem;
            `}
          >
            <div
              className={css`
                display: flex;
                flex-wrap: wrap;
                flex-direction: column;
                justify-content: left;
                column-gap: 1rem;
                margin-bottom: 1rem;

                ${respondToOrLarger.md} {
                  align-items: flex-end;
                  flex-direction: row;
                }
              `}
            >
              <div
                className={css`
                  column-gap: 1rem;
                  display: flex;
                  flex: 2;
                `}
              >
                <SelectField
                  className={css`
                    flex: 1;
                    min-width: 5rem;
                    margin-bottom: 0;
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
                    flex: 1;
                    min-width: 5rem;
                    margin-bottom: 0;
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
              </div>
            </div>

            <Checkbox
              label={t("enable-automatic-completion")}
              register={register("automatic_completion")}
              className={css`
                label {
                  color: #fff !important;
                }
              `}
            />
            <div
              className={css`
                align-items: center;
                display: flex;
                column-gap: 1rem;
                margin-bottom: 1rem;
              `}
            >
              <TextField
                className={css`
                  flex: 1;
                  margin-bottom: 0;
                `}
                type="number"
                label={t("automatic-completion-points-treshold")}
                labelStyle={css`
                  color: #fff;
                `}
                placeholder={t("automatic-completion-points-treshold")}
                register={register("automatic_completion_number_of_points_treshold", {
                  valueAsNumber: true,
                  disabled: !isChecked,
                })}
                error={errors["name"]?.message}
              />
              <TextField
                className={css`
                  flex: 1;
                  margin-bottom: 0;
                `}
                label={t("automatic-completion-exercise-treshold")}
                labelStyle={css`
                  color: #fff;
                `}
                placeholder={t("automatic-completion-exercise-treshold")}
                type="number"
                register={register("automatic_completion_number_of_exercises_attempted_treshold", {
                  valueAsNumber: true,
                  disabled: !isChecked,
                })}
                error={errors["name"]?.message}
              />
              {/* Only for default module */}
              {!module.name && (
                <div
                  className={css`
                    flex: 1;
                  `}
                >
                  <Checkbox
                    label={t("automatic-completion-requires-exam")}
                    register={register("automatic_completion_requires_exam", {
                      disabled: !isChecked,
                    })}
                    className={css`
                      margin-bottom: 0;
                      position: relative;
                      top: 10px;

                      label {
                        color: #fff !important;
                      }
                    `}
                  />
                </div>
              )}
            </div>
            <div
              className={css`
                margin-top: 1rem;
                margin-bottom: 1rem;
              `}
            >
              <Checkbox
                label={t("override-completion-registration-link")}
                register={register("override_completion_link")}
                className={css`
                  label {
                    color: #fff !important;
                  }
                `}
              />
              <TextField
                label={t("completion-registration-link")}
                placeholder={t("completion-registration-link")}
                labelStyle={css`
                  color: #fff;
                `}
                className={css`
                  margin-bottom: 0;
                `}
                register={register("completion_registration_link_override", {
                  disabled: !overrideLink,
                  minLength: 10,
                })}
                error={errors["completion_registration_link_override"]?.message}
              />
            </div>
            <Checkbox
              label={t("label-enable-registering-completion-to-uh-open-university")}
              register={register("enable_registering_completion_to_uh_open_university")}
              className={css`
                label {
                  color: #fff !important;
                }
              `}
            />
            <div
              className={css`
                display: flex;
                flex-wrap: wrap;
                flex-direction: column;
                justify-content: left;
                column-gap: 1rem;

                ${respondToOrLarger.md} {
                  align-items: flex-end;
                  flex-direction: row;
                }
              `}
            >
              <TextField
                className={css`
                  flex: 1;
                  min-width: 8rem;
                  margin-bottom: 0;
                `}
                label={t("uh-course-code")}
                placeholder={t("uh-course-code")}
                labelStyle={css`
                  color: #fff;
                `}
                register={register("uh_course_code")}
                error={errors["name"]?.message}
              />
              <TextField
                className={css`
                  flex: 1;
                  min-width: 8rem;
                  margin-bottom: 0;
                `}
                label={t("ects-credits")}
                labelStyle={css`
                  color: #fff;
                `}
                placeholder={t("ects-credits")}
                type="number"
                register={register("ects_credits", {
                  valueAsNumber: true,
                })}
              />
            </div>
          </div>
        )}
        <div
          className={css`
            display: flex;
            align-items: flex-end;
          `}
        >
          <div
            className={css`
              flex-grow: 1;
            `}
          />
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
